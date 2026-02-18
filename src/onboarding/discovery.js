/**
 * Discovery Engine — Crawls websites to discover organizational structure.
 * Port of V1 Python DiscoveryEngine to Node.js using fetch + cheerio.
 */

const { randomUUID } = require("crypto");
const { load: cheerioLoad } = require("cheerio");

// Title patterns for detecting executives and department heads
const EXECUTIVE_PATTERNS = [
  /mayor/i,
  /city\s*manager/i,
  /chief\s*(of\s*staff|executive|operating|financial|administrative)/i,
  /deputy\s*mayor/i,
  /city\s*administrator/i,
];

const DEPARTMENT_HEAD_PATTERNS = [
  /director/i,
  /commissioner/i,
  /superintendent/i,
  /chief\s*(of\s*police|of\s*fire)?/i,
  /secretary/i,
  /administrator/i,
  /manager/i,
];

// Common municipal department keywords → template suggestions
const DEPARTMENT_KEYWORDS = {
  "public-health": ["health", "public health", "cdph", "epidemiology", "clinic"],
  hr: ["human resources", "hr", "personnel", "civil service", "employee"],
  finance: ["finance", "treasury", "fiscal", "budget", "accounting", "procurement"],
  building: ["building", "housing", "permits", "inspections", "code enforcement"],
  "311": ["311", "citizen services", "constituent services", "call center"],
  strategy: ["planning", "development", "economic development", "strategy"],
  "public-safety": ["police", "public safety", "law enforcement"],
  fire: ["fire", "emergency services", "ems", "emergency management"],
  parks: ["parks", "recreation", "community centers"],
  "public-works": ["public works", "streets", "utilities", "water", "sewer", "sanitation"],
  law: ["law", "legal", "city attorney", "solicitor"],
  it: ["technology", "it", "information technology", "innovation"],
  communications: ["communications", "public affairs", "media relations"],
};

// Open data portal patterns
const DATA_PORTAL_PATTERNS = [
  { pattern: /data\.[^/]+\.(gov|org|us)/i, type: "socrata" },
  { pattern: /opendata\.[^/]+/i, type: "socrata" },
  { pattern: /hub\.arcgis\.com/i, type: "arcgis" },
  { pattern: /[^/]+\.arcgis\.com\/home/i, type: "arcgis" },
  { pattern: /ckan/i, type: "ckan" },
  { pattern: /opendatasoft\.com/i, type: "opendatasoft" },
];

const SKIP_EXTENSIONS = new Set([
  ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".css", ".js",
  ".xml", ".json", ".zip", ".mp4", ".mp3", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".eot",
]);

const PRIORITY_PATHS = [
  "/government", "/departments", "/directory", "/mayor",
  "/city-hall", "/about", "/about-us", "/leadership",
  "/officials", "/administration", "/services", "/team",
  "/our-team", "/staff", "/contact", "/contact-us",
];

const PRIORITY_LINK_KEYWORDS = [
  "department", "government", "director", "office",
  "team", "about", "leadership", "staff", "contact",
  "executive", "management", "board", "council",
];

class DiscoveryEngine {
  /**
   * @param {object} opts
   * @param {number} [opts.maxPages=100] - Max pages to crawl
   * @param {number} [opts.rateLimitMs=500] - Delay between requests
   * @param {number} [opts.timeoutMs=30000] - Per-request timeout
   */
  constructor(opts = {}) {
    this.maxPages = opts.maxPages || 100;
    this.rateLimitMs = opts.rateLimitMs || 500;
    this.timeoutMs = opts.timeoutMs || 30000;

    // In-memory job store (persisted in DB by the wizard)
    this._jobs = new Map();
  }

  /**
   * Start a background discovery job. Returns a job ID immediately.
   */
  startDiscovery(url) {
    const jobId = randomUUID().slice(0, 12);
    const job = {
      id: jobId,
      status: "crawling",
      startedAt: new Date().toISOString(),
      completedAt: null,
      sourceUrl: url,
      municipality: null,
      executive: null,
      chiefOfficers: [],
      departments: [],
      dataPortals: [],
      governanceDocs: [],
      pagesCrawled: 0,
      error: null,
    };
    this._jobs.set(jobId, job);

    // Run asynchronously — don't block
    this._runDiscovery(jobId, url).catch((err) => {
      job.status = "failed";
      job.error = err.message;
      job.completedAt = new Date().toISOString();
    });

    return jobId;
  }

  getStatus(jobId) {
    return this._jobs.get(jobId) || null;
  }

  /**
   * Run discovery synchronously (for wizard API).
   * Returns the complete result.
   */
  async discover(url) {
    const jobId = randomUUID().slice(0, 12);
    const job = {
      id: jobId,
      status: "crawling",
      startedAt: new Date().toISOString(),
      completedAt: null,
      sourceUrl: url,
      municipality: null,
      executive: null,
      chiefOfficers: [],
      departments: [],
      dataPortals: [],
      governanceDocs: [],
      pagesCrawled: 0,
      error: null,
    };
    this._jobs.set(jobId, job);
    await this._runDiscovery(jobId, url);
    return this._jobs.get(jobId);
  }

  // ─── Internal ─────────────────────────────────────────────

  async _runDiscovery(jobId, url) {
    const job = this._jobs.get(jobId);

    try {
      const parsed = new URL(url);
      const baseUrl = `${parsed.protocol}//${parsed.host}`;

      // Crawl
      const pages = await this._crawlSite(baseUrl, url, job);
      job.pagesCrawled = Object.keys(pages).length;

      // Extract
      job.status = "extracting";
      this._extractMunicipality(job, pages, baseUrl);
      this._extractExecutive(job, pages);
      this._extractDepartments(job, pages, baseUrl);
      this._extractDataPortals(job, pages, baseUrl);
      this._extractGovernanceDocs(job, pages, baseUrl);

      job.status = "completed";
      job.completedAt = new Date().toISOString();
    } catch (err) {
      job.status = "failed";
      job.error = err.message;
      job.completedAt = new Date().toISOString();
    }
  }

  async _crawlSite(baseUrl, startUrl, job) {
    const visited = new Set();
    const toVisit = [startUrl];
    const pages = {};

    // Add priority paths
    for (const p of PRIORITY_PATHS) {
      toVisit.push(new URL(p, baseUrl).href);
    }

    let errorsCount = 0;
    const maxErrors = 10;

    while (toVisit.length && Object.keys(pages).length < this.maxPages && errorsCount < maxErrors) {
      let url = toVisit.shift();

      // Normalize: strip fragment and query, trailing slash
      try {
        const u = new URL(url);
        u.hash = "";
        u.search = "";
        url = u.href.replace(/\/+$/, "") || u.origin;
      } catch {
        continue;
      }

      if (visited.has(url)) continue;
      if (!url.startsWith(baseUrl)) continue;

      // Skip non-content URLs
      const lower = url.toLowerCase();
      let skip = false;
      for (const ext of SKIP_EXTENSIONS) {
        if (lower.endsWith(ext)) { skip = true; break; }
      }
      if (skip) continue;

      visited.add(url);

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
          redirect: "follow",
        });
        clearTimeout(timer);

        const contentType = response.headers.get("content-type") || "";
        if (response.ok && contentType.includes("text/html")) {
          const html = await response.text();
          pages[url] = html;
          errorsCount = 0;
          job.pagesCrawled = Object.keys(pages).length;

          // Extract links
          const $ = cheerioLoad(html);
          $("a[href]").each((_, el) => {
            const href = $(el).attr("href");
            if (!href) return;
            if (href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) return;

            let fullUrl;
            try { fullUrl = new URL(href, url).href; } catch { return; }

            if (!fullUrl.startsWith(baseUrl)) return;
            if (visited.has(fullUrl)) return;

            // Prioritize org-relevant links
            const lowerUrl = fullUrl.toLowerCase();
            if (PRIORITY_LINK_KEYWORDS.some((kw) => lowerUrl.includes(kw))) {
              toVisit.unshift(fullUrl);
            } else {
              toVisit.push(fullUrl);
            }
          });
        } else if (response.status >= 400) {
          errorsCount++;
        }

        // Rate limit
        await this._sleep(this.rateLimitMs);
      } catch {
        errorsCount++;
        await this._sleep(1000);
      }
    }

    return pages;
  }

  _extractMunicipality(job, pages, baseUrl) {
    // Try homepage title
    const homeHtml = pages[baseUrl] || pages[baseUrl + "/"] || "";
    if (!homeHtml) {
      // Fallback from domain name
      const parsed = new URL(baseUrl);
      const name = parsed.hostname.replace(/^www\./, "").split(".")[0].replace(/-/g, " ");
      job.municipality = { name: this._titleCase(name), state: null, website: baseUrl, population: null };
      return;
    }

    const $ = cheerioLoad(homeHtml);
    const titleText = $("title").text() || "";

    let cityName = "";
    let state = null;

    // "City of X"
    let match = titleText.match(/City\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    if (match) {
      cityName = `City of ${match[1]}`;
    } else {
      match = titleText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+City/);
      if (match) cityName = `${match[1]} City`;
    }

    // State
    const stateMatch = titleText.match(/,\s*([A-Z]{2}|[A-Z][a-z]+)\s*$/);
    if (stateMatch) state = stateMatch[1];

    // Fallback
    if (!cityName) {
      const parsed = new URL(baseUrl);
      const name = parsed.hostname.replace(/^www\./, "").split(".")[0].replace(/-/g, " ");
      cityName = this._titleCase(name);
    }

    job.municipality = { name: cityName, state, website: baseUrl, population: null };
  }

  _extractExecutive(job, pages) {
    for (const [url, html] of Object.entries(pages)) {
      const $ = cheerioLoad(html);
      const text = $.text().toLowerCase();

      // Look for mayor
      if (!job.executive && text.includes("mayor")) {
        for (const pat of [
          /Mayor\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)/,
          /([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+),?\s+Mayor/,
        ]) {
          const match = html.match(pat);
          if (match) {
            job.executive = {
              name: match[1].trim(),
              title: "Mayor",
              office: "Office of the Mayor",
              url,
            };
            break;
          }
        }
      }

      // Look for chief officers (skip mayor pattern)
      for (let i = 1; i < EXECUTIVE_PATTERNS.length; i++) {
        const pat = EXECUTIVE_PATTERNS[i];
        if (pat.test(text)) {
          // Try to extract name near the pattern
          const namePatterns = [
            new RegExp(`(${pat.source})\\s+([A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+)`, "i"),
            new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+),?\\s+(${pat.source})`, "i"),
          ];
          for (const np of namePatterns) {
            const m = html.match(np);
            if (m) {
              const name = (m[2] || m[1]).trim();
              const title = (m[1] || m[2]).trim();
              if (name && name.split(/\s+/).length >= 2) {
                if (!job.chiefOfficers.some((o) => o.name === name)) {
                  job.chiefOfficers.push({
                    name,
                    title: this._titleCase(title),
                    office: "Executive Office",
                    url,
                  });
                }
                break;
              }
            }
          }
        }
      }
    }
  }

  _extractDepartments(job, pages, baseUrl) {
    const seen = new Set();

    for (const [url, html] of Object.entries(pages)) {
      const $ = cheerioLoad(html);

      // Look for department patterns in links and headings
      $("a, h1, h2, h3, h4").each((_, el) => {
        const text = $(el).text().trim();
        if (!text || text.length > 100) return;

        const textLower = text.toLowerCase();

        for (const [templateId, keywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
          if (keywords.some((kw) => textLower.includes(kw))) {
            const deptKey = textLower.slice(0, 50);
            if (seen.has(deptKey)) return;
            seen.add(deptKey);

            const deptId = textLower.replace(/[^a-z0-9]+/g, "-").slice(0, 30).replace(/^-|-$/g, "");

            let deptUrl = null;
            if (el.tagName === "a" || el.name === "a") {
              const href = $(el).attr("href");
              if (href) {
                try { deptUrl = new URL(href, baseUrl).href; } catch { /* skip */ }
              }
            }

            // Try to find director from surrounding content
            let directorName = null;
            let directorTitle = null;
            const parent = $(el).parent();
            if (parent.length) {
              const parentText = parent.text();
              for (const headPat of DEPARTMENT_HEAD_PATTERNS) {
                const m = parentText.match(
                  new RegExp(`(${headPat.source})[:\\s]+([A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+)`, "i")
                );
                if (m) {
                  directorTitle = this._titleCase(m[1].trim());
                  directorName = m[2].trim();
                  break;
                }
              }
            }

            job.departments.push({
              id: deptId,
              name: text,
              director: directorName,
              directorTitle,
              url: deptUrl,
              description: null,
              suggestedTemplate: templateId,
              keywordsMatched: keywords.filter((kw) => textLower.includes(kw)),
              contact: { email: null, phone: null, address: null },
            });

            return false; // break out of keywords loop via early return
          }
        }
      });
    }
  }

  _extractDataPortals(job, pages, baseUrl) {
    const seen = new Set();

    for (const [pageUrl, html] of Object.entries(pages)) {
      const $ = cheerioLoad(html);

      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;

        let fullUrl;
        try { fullUrl = new URL(href, baseUrl).href; } catch { return; }

        for (const { pattern, type } of DATA_PORTAL_PATTERNS) {
          if (pattern.test(fullUrl)) {
            const parsed = new URL(fullUrl);
            const portalUrl = `${parsed.protocol}//${parsed.host}`;

            if (!seen.has(portalUrl)) {
              seen.add(portalUrl);

              let apiEndpoint = null;
              if (type === "socrata") apiEndpoint = `${portalUrl}/resource/`;
              else if (type === "ckan") apiEndpoint = `${portalUrl}/api/3/`;

              job.dataPortals.push({
                type,
                url: portalUrl,
                apiEndpoint,
                detectedVia: pageUrl,
              });
            }
            return; // only first match per link
          }
        }
      });

      // Check for "open data" mentions
      const text = $.text().toLowerCase();
      if (text.includes("open data") || text.includes("data portal")) {
        $("a[href]").each((_, el) => {
          const linkText = $(el).text().toLowerCase();
          if (linkText.includes("data") || linkText.includes("open")) {
            const href = $(el).attr("href");
            if (!href) return;
            let fullUrl;
            try { fullUrl = new URL(href, baseUrl).href; } catch { return; }
            if (!seen.has(fullUrl) && fullUrl.toLowerCase().includes("data")) {
              seen.add(fullUrl);
              job.dataPortals.push({ type: "unknown", url: fullUrl, apiEndpoint: null, detectedVia: pageUrl });
            }
          }
        });
      }
    }
  }

  _extractGovernanceDocs(job, pages, baseUrl) {
    const docPatterns = {
      charter: [/city\s*charter/i, /municipal\s*charter/i],
      ordinance: [/ordinance/i, /codified\s*ordinances/i, /municipal\s*code/i],
      policy: [/policy/i, /policies/i, /administrative\s*rules/i],
      budget: [/budget/i, /annual\s*budget/i, /financial\s*report/i],
    };
    const seen = new Set();

    for (const [, html] of Object.entries(pages)) {
      const $ = cheerioLoad(html);

      $("a[href]").each((_, el) => {
        const linkText = $(el).text().toLowerCase();
        const href = $(el).attr("href");
        if (!href) return;

        for (const [docType, patterns] of Object.entries(docPatterns)) {
          if (patterns.some((p) => p.test(linkText))) {
            let fullUrl;
            try { fullUrl = new URL(href, baseUrl).href; } catch { return; }

            if (!seen.has(fullUrl)) {
              seen.add(fullUrl);
              job.governanceDocs.push({
                type: docType,
                title: $(el).text().trim(),
                url: fullUrl,
              });
            }
            return;
          }
        }
      });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  _titleCase(str) {
    return str.replace(/\b\w+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { DiscoveryEngine, DEPARTMENT_KEYWORDS };
