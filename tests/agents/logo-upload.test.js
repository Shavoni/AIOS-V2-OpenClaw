/**
 * Agent Logo Upload — TDD tests
 * POST /agents/:id/logo and PUT /agents/:id/branding
 */

const express = require("express");
const { createAgentRoutes } = require("../../src/agents/routes");
const { createTestDb } = require("../fixtures/test-db");
const { AgentManagerService } = require("../../src/agents/manager");
const { IntentClassifier } = require("../../src/governance");
const path = require("path");
const fs = require("fs");
const os = require("os");

function makeApp(router) {
  const app = express();
  app.use(express.json({ limit: "5mb" }));
  app.use("/agents", router);
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

describe("Agent Logo Upload & Branding", () => {
  let db, manager, app, agentId;

  beforeAll(async () => {
    db = await createTestDb();
    manager = new AgentManagerService(db, jest.fn());
    const classifier = new IntentClassifier();
    const router = createAgentRoutes(manager, classifier, {});
    app = makeApp(router);

    const agent = manager.createAgent({ name: "Logo Test Agent", domain: "General", status: "active" });
    agentId = agent.id;
  });

  afterAll(() => {
    if (db) db.close();
    // Cleanup uploaded files
    const uploadsDir = path.resolve(__dirname, "../../public/uploads/agents");
    if (fs.existsSync(uploadsDir)) {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    }
  });

  // --- POST /agents/:id/logo ---
  test("POST /agents/:id/logo uploads a base64 image and sets logo_url", async () => {
    // 1x1 red PNG as base64
    const redPixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    const res = await request(app, "POST", `/agents/${agentId}/logo`, {
      image: redPixel,
      filename: "logo.png",
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.logo_url).toContain(`/uploads/agents/${agentId}/logo.png`);

    // Verify agent was updated
    const agent = manager.getAgent(agentId);
    expect(agent.logo_url).toContain("logo.png");
  });

  test("POST /agents/:id/logo returns 400 without image", async () => {
    const res = await request(app, "POST", `/agents/${agentId}/logo`, {
      filename: "logo.png",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("image");
  });

  test("POST /agents/:id/logo returns 404 for non-existent agent", async () => {
    const res = await request(app, "POST", `/agents/nonexistent/logo`, {
      image: "dGVzdA==",
      filename: "logo.png",
    });
    expect(res.status).toBe(404);
  });

  test("POST /agents/:id/logo rejects invalid file extension", async () => {
    const res = await request(app, "POST", `/agents/${agentId}/logo`, {
      image: "dGVzdA==",
      filename: "logo.exe",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("file type");
  });

  // --- PUT /agents/:id/branding ---
  test("PUT /agents/:id/branding updates brand_color", async () => {
    const res = await request(app, "PUT", `/agents/${agentId}/branding`, {
      brand_color: "#E74C3C",
    });

    expect(res.status).toBe(200);
    expect(res.body.brand_color).toBe("#E74C3C");
  });

  test("PUT /agents/:id/branding updates brand_tagline", async () => {
    const res = await request(app, "PUT", `/agents/${agentId}/branding`, {
      brand_tagline: "Smart City Intelligence",
    });

    expect(res.status).toBe(200);
    expect(res.body.brand_tagline).toBe("Smart City Intelligence");
  });

  test("PUT /agents/:id/branding updates multiple fields at once", async () => {
    const res = await request(app, "PUT", `/agents/${agentId}/branding`, {
      brand_color: "#3498DB",
      brand_tagline: "Innovation Hub",
      logo_url: "/custom/logo.svg",
    });

    expect(res.status).toBe(200);
    expect(res.body.brand_color).toBe("#3498DB");
    expect(res.body.brand_tagline).toBe("Innovation Hub");
    expect(res.body.logo_url).toBe("/custom/logo.svg");
  });

  test("PUT /agents/:id/branding returns 404 for non-existent agent", async () => {
    const res = await request(app, "PUT", `/agents/nonexistent/branding`, {
      brand_color: "#000",
    });
    expect(res.status).toBe(404);
  });
});
