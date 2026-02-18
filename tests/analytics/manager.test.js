const { AnalyticsManager } = require("../../src/analytics/manager");

describe("AnalyticsManager", () => {
  let db, analytics;

  beforeAll(async () => {
    const initSqlJs = require("sql.js");
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");

    const { initSchema } = require("../../src/db/schema");
    initSchema(db);

    analytics = new AnalyticsManager(db, () => {});
  });

  afterAll(() => {
    if (db) db.close();
  });

  describe("recording queries", () => {
    test("records a successful query event", () => {
      const id = analytics.recordQuery({
        user_id: "user-1",
        department: "Legal",
        agent_id: "agent-1",
        agent_name: "Legal Bot",
        query_text: "Review this contract",
        response_text: "Here is my analysis...",
        latency_ms: 1500,
        tokens_in: 100,
        tokens_out: 200,
        cost_usd: 0.003,
        hitl_mode: "INFORM",
        session_id: "session-1",
      });

      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    test("records a failed query event", () => {
      const id = analytics.recordQuery({
        user_id: "user-2",
        query_text: "Something broken",
        success: false,
        error_message: "Provider timeout",
        latency_ms: 30000,
      });

      expect(typeof id).toBe("string");
    });

    test("records escalated query", () => {
      const id = analytics.recordQuery({
        user_id: "user-3",
        query_text: "Company announcement",
        hitl_mode: "ESCALATE",
        was_escalated: 1,
        guardrails_triggered: ["PUBLIC_STATEMENT"],
      });

      expect(typeof id).toBe("string");
    });
  });

  describe("summary", () => {
    test("returns aggregated summary", () => {
      const summary = analytics.getSummary(30);
      expect(summary.totalQueries).toBeGreaterThanOrEqual(3);
      expect(summary).toHaveProperty("totalCost");
      expect(summary).toHaveProperty("avgLatency");
      expect(summary).toHaveProperty("successRate");
      expect(summary).toHaveProperty("totalTokensIn");
      expect(summary).toHaveProperty("totalTokensOut");
    });

    test("calculates success rate correctly", () => {
      const summary = analytics.getSummary(30);
      // 2 success, 1 failure = 66%
      expect(summary.successRate).toBeLessThan(100);
      expect(summary.errors).toBeGreaterThanOrEqual(1);
    });
  });

  describe("events listing", () => {
    test("lists events with default pagination", () => {
      const events = analytics.getEvents({});
      expect(events.length).toBeGreaterThanOrEqual(3);
    });

    test("filters events by agent_id", () => {
      const events = analytics.getEvents({ agent_id: "agent-1" });
      expect(events.every((e) => e.agent_id === "agent-1")).toBe(true);
    });

    test("filters events by hitl_mode", () => {
      const events = analytics.getEvents({ hitl_mode: "ESCALATE" });
      expect(events.every((e) => e.hitl_mode === "ESCALATE")).toBe(true);
    });

    test("respects limit parameter", () => {
      const events = analytics.getEvents({ limit: 1 });
      expect(events.length).toBe(1);
    });
  });

  describe("agent metrics", () => {
    test("returns metrics for a specific agent", () => {
      const metrics = analytics.getAgentMetrics("agent-1", 30);
      expect(metrics.totalQueries).toBeGreaterThanOrEqual(1);
      expect(metrics).toHaveProperty("avgLatency");
      expect(metrics).toHaveProperty("totalCost");
    });
  });

  describe("export", () => {
    test("exports JSON", () => {
      const data = analytics.exportJSON(30);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(3);
    });

    test("exports CSV", () => {
      const csv = analytics.exportCSV(30);
      expect(typeof csv).toBe("string");
      expect(csv).toContain("id,");
      expect(csv.split("\n").length).toBeGreaterThan(1);
    });
  });
});
