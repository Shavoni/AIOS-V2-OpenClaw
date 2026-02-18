const request = require("supertest");

describe("AIOS V2 Server", () => {
  let app;

  beforeAll(async () => {
    const express = require("express");
    app = express();
    app.use(express.json());

    app.get("/health", (_req, res) => {
      res.json({ status: "ok", name: "AIOS V2" });
    });
  });

  test("GET /health returns 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.name).toBe("AIOS V2");
  });
});
