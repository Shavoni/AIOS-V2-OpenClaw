/**
 * Skills CRUD Routes — TDD tests
 * GET/POST/PUT/DELETE /skills, POST /skills/:id/upload
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { SkillEngine } = require("../../src/skills");
const { createSkillRoutes } = require("../../src/skills/routes");

function makeApp(router) {
  const app = express();
  app.use(express.json({ limit: "5mb" }));
  app.use("/skills", router);
  return app;
}

async function request(app, method, url, body) {
  return new Promise((resolve, reject) => {
    const http = require("http");
    const server = app.listen(0, () => {
      const port = server.address().port;
      const opts = {
        hostname: "127.0.0.1",
        port,
        path: url,
        method: method.toUpperCase(),
        headers: { "Content-Type": "application/json" },
      };

      const req = http.request(opts, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          server.close();
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      });
      req.on("error", (err) => { server.close(); reject(err); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

describe("Skills CRUD Routes", () => {
  let root, engine, app;

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-routes-"));
    fs.mkdirSync(path.join(root, "skills"), { recursive: true });
    engine = new SkillEngine(root);

    // Seed one skill for GET/PUT/DELETE tests
    engine.createSkill({ id: "seed-skill", name: "Seed Skill", description: "Pre-existing", tags: ["test"] });

    const router = createSkillRoutes(engine, { projectRoot: root });
    app = makeApp(router);
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("GET /skills returns array of skills", async () => {
    const res = await request(app, "GET", "/skills");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].id).toBe("seed-skill");
  });

  test("GET /skills/:id returns skill detail with readme", async () => {
    const res = await request(app, "GET", "/skills/seed-skill");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Seed Skill");
    expect(res.body.readme).toBeDefined();
    expect(res.body.readme).toContain("Seed Skill");
  });

  test("POST /skills creates a new skill (201)", async () => {
    const res = await request(app, "POST", "/skills", {
      id: "new-route-skill",
      name: "Route Created",
      description: "Created via API",
      tags: ["api"],
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("new-route-skill");
    expect(res.body.name).toBe("Route Created");
  });

  test("POST /skills rejects missing name (400)", async () => {
    const res = await request(app, "POST", "/skills", {
      id: "no-name-skill",
    });
    expect(res.status).toBe(400);
  });

  test("POST /skills rejects duplicate id (409)", async () => {
    const res = await request(app, "POST", "/skills", {
      id: "seed-skill",
      name: "Duplicate",
    });
    expect(res.status).toBe(409);
  });

  test("PUT /skills/:id updates skill fields", async () => {
    const res = await request(app, "PUT", "/skills/seed-skill", {
      name: "Updated Seed",
      description: "Now updated",
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Seed");
    expect(res.body.description).toBe("Now updated");
  });

  test("PUT /skills/:id returns 404 for missing skill", async () => {
    const res = await request(app, "PUT", "/skills/ghost-skill", {
      name: "Nope",
    });
    expect(res.status).toBe(404);
  });

  test("DELETE /skills/:id removes skill", async () => {
    // Create a skill to delete
    engine.createSkill({ id: "to-delete", name: "Delete Me" });

    const res = await request(app, "DELETE", "/skills/to-delete");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(engine.getSkill("to-delete")).toBeNull();
  });

  test("DELETE /skills/:id returns 404 for missing skill", async () => {
    const res = await request(app, "DELETE", "/skills/nonexistent");
    expect(res.status).toBe(404);
  });

  test("POST /skills/:id/upload imports SKILL.md content (201)", async () => {
    const mdContent = [
      "---",
      "name: Uploaded Skill",
      "description: Via upload",
      "version: 1.0.0",
      "tags: []",
      "---",
      "",
      "# Uploaded",
      "",
      "Uploaded content.",
    ].join("\n");

    const res = await request(app, "POST", "/skills/uploaded-skill/upload", {
      content: mdContent,
      fileType: "md",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("uploaded-skill");
    expect(res.body.name).toBe("Uploaded Skill");
  });
});
