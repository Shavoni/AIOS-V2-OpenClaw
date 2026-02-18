# Deep Research Pipeline — Technical Reference

## Overview

The Deep Research Pipeline processes complex queries through 4 stages with configurable concurrency, timeout handling, and cancellation support. Each stage is an independent worker class extending `BaseWorker`.

```
Query → [Decomposition] → [Retrieval] → [Scoring] → [Synthesis] → Report
```

**Max Concurrency:** 3 (configurable via `RESEARCH_MAX_CONCURRENCY`)
**Default TTL:** 86,400 seconds (24 hours)
**Worker Timeout:** 60,000 ms per LLM call

---

## Stage 1: Decomposition

**File:** `src/research/workers/decomposition.js`
**Input:** Original query string
**Output:** Array of 1-8 sub-questions

**Process:**
1. Send query to LLM with structured prompt requesting JSON array of sub-questions
2. Parse JSON response (falls back to original query on parse failure)
3. Strip numbered prefixes ("1. What is..." → "What is...")
4. Deduplicate identical sub-questions
5. Prepend original query as first item
6. Cap total at 8 sub-questions

**Fallback:** If LLM fails or returns invalid JSON, returns `[originalQuery]`

---

## Stage 2: Retrieval

**File:** `src/research/workers/retrieval.js`
**Input:** Array of sub-questions, job ID
**Output:** Array of source objects

**Process:**
1. For each sub-question:
   - Search RAG index (local documents) for matching chunks
   - Search Tavily API (web) for relevant pages
2. Merge and deduplicate results by URL
3. Normalize source objects to standard format

**Source Object:**
```javascript
{
  id: "source-uuid",
  text: "Content excerpt...",
  url: "https://...",
  title: "Page Title",
  publishedAt: "2025-01-15T...",  // if available
  relevanceScore: 0.85,           // from search
  credibilityTier: "AUTHORITATIVE",
  domainAuthority: 80,
  retrievalMethod: "rag" | "web"
}
```

---

## Stage 3: Scoring

**File:** `src/research/workers/scoring.js`
**Input:** Sources array, original query
**Output:** `{ scoredSources, scoredClaims, jobConfidence }`

### Source Scoring (`src/research/scoring-engine.js` — SourceScorer)

Each source is scored on 4 weighted dimensions:

| Dimension | Weight | Range | Calculation |
|-----------|--------|-------|-------------|
| Domain Authority | 25% | 0-100 → 0-1 | `domainAuthority / 100` |
| Recency | 20% | 0-1 | `exp(-daysSincePublished / 180)` or 0.5 if unknown |
| Relevance | 35% | 0-1 | Pass-through from retrieval search score |
| Credibility | 20% | 0-1 | Mapped from credibility tier (see below) |

**Composite Score:** `(da * 0.25) + (rec * 0.2) + (rel * 0.35) + (cred * 0.2)` clamped to [0, 1]

**Credibility Tiers:**

| Tier | Score | Examples |
|------|-------|---------|
| PRIMARY_SOURCE | 1.0 | .gov, .edu, peer-reviewed journals |
| AUTHORITATIVE | 0.85 | Major news outlets, established publishers |
| SECONDARY | 0.65 | Wikipedia, encyclopedias, aggregators |
| UNVERIFIED | 0.3 | Blogs, forums, unknown sites |
| FLAGGED | 0.0 | Known disinformation, blacklisted domains |

### Claim Extraction (LLM-powered)

Sources are sent to the LLM with a structured prompt requesting:
```json
[
  {
    "text": "Factual claim statement",
    "supportingIndices": [0, 2, 5],      // Source indices that support this claim
    "contradictingIndices": [3]           // Source indices that contradict this claim
  }
]
```

### Claim Scoring (`src/research/scoring-engine.js` — ClaimScorer)

| Field | Calculation |
|-------|-------------|
| `supportStrength` | Mean of supporting sources' composite scores |
| `contradictionFlag` | `contradictingIndices.length > 0` |
| `confidenceScore` | `clamp(min(supportStrength + supportCount * 0.05, 1.0) - contradictCount * 0.15, [0, 1])` |

### Job Confidence (`src/research/scoring-engine.js` — JobConfidenceCalculator)

| Field | Calculation |
|-------|-------------|
| `confidence` | `clamp(avgClaimConfidence * min(sourceCount / 10, 1.0), [0, 1])` |
| `claimCount` | Number of extracted claims |
| `sourceCount` | Number of scored sources |
| `hasContradictions` | Any claim has contradictionFlag = true |

---

## Stage 4: Synthesis

**File:** `src/research/workers/synthesis.js`
**Input:** `{ query, scoredSources, scoredClaims, jobConfidence }`
**Output:** `{ synthesis, tokenUsage }`

**Process:**
1. Build system prompt with:
   - Source list with URLs for citation
   - Claim list with confidence scores
   - Contradiction warnings (if any)
   - Overall confidence level (e.g., "92% confidence")
2. Send to LLM requesting structured markdown report
3. Return synthesis text and token usage

**Fallback:** If LLM fails, returns `{ synthesis: "Synthesis failed...", error: err.message }`

---

## Job Lifecycle

### Status Flow
```
QUEUED → PROCESSING → COMPLETED
                    → FAILED
                    → CANCELLED
                    → EXPIRED
```

### Cancellation
Between each stage, the queue service checks `_isCancelled(jobId)`. If the job has been cancelled (or reached any terminal state), processing stops immediately and subsequent workers are not invoked.

### Progress Events
Each stage emits progress events via the EventBus:
```javascript
eventBus.emit("research:progress", {
  jobId: "...",
  stage: "scoring",    // decomposition, retrieval, scoring, synthesis
  progress: 0.75       // 0-1.0
})
```

### Concurrency Control
The `_drainQueue()` method maintains a count of active jobs. When a job completes, it checks the queue for the next pending job and starts it if below `maxConcurrency`.

---

## Database Storage

### research_jobs
Stores job metadata, status, and progress. Updated at each stage transition.

### research_results
Created at the end of Stage 4. Stores the synthesis markdown, source citations, extracted claims, and token usage — all as JSON fields.

### research_sources
Created during Stage 3. One row per source per job with all scoring dimensions stored individually for audit and analysis.

---

## API Endpoints

```
POST   /api/research/jobs           Submit job (rate limited: 10/15min)
GET    /api/research/jobs           List user's jobs
GET    /api/research/jobs/:id       Job status + progress
GET    /api/research/jobs/:id/result   Completed synthesis report
GET    /api/research/jobs/:id/sources  Scored sources
POST   /api/research/jobs/:id/cancel   Cancel running job
GET    /api/research/queue/summary     Queue status counts
```

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `RESEARCH_MAX_CONCURRENCY` | 3 | Max simultaneous research jobs |
| `TAVILY_API_KEY` | - | Required for web search in retrieval |
| Worker timeout | 60,000 ms | Per-LLM-call timeout |
| Max sub-questions | 8 | Cap on decomposition output |
| Default TTL | 86,400s | Job expiration time |
