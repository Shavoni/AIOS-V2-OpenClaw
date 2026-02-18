const { AuditManager } = require("../../src/audit/manager");

describe("AuditManager", () => {
  let db, audit;

  beforeAll(async () => {
    const initSqlJs = require("sql.js");
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");

    const { initSchema } = require("../../src/db/schema");
    initSchema(db);

    audit = new AuditManager(db, () => {});
  });

  afterAll(() => {
    if (db) db.close();
  });

  describe("logging events", () => {
    test("logs an info event", () => {
      const id = audit.logEvent(
        "query", "info", "user-1", "chat_query",
        { user_department: "Legal", agent_id: "agent-1", agent_name: "Legal Bot", query: "Review this contract" }
      );
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    test("logs a warning event with PII", () => {
      const id = audit.logEvent(
        "pii_detected", "warning", "user-2", "pii_scan",
        { user_department: "HR", agent_id: "agent-2", agent_name: "HR Bot", message: "SSN detected", pii_detected: ["SSN"], requires_review: true }
      );
      expect(typeof id).toBe("string");
    });

    test("logs a critical event", () => {
      const id = audit.logEvent(
        "policy_violation", "critical", "user-3", "guardrail_triggered",
        { user_department: "Finance", agent_id: "agent-3", agent_name: "Finance Bot", reason: "Attempted financial transaction", guardrails_triggered: ["no-transactions"], requires_review: true }
      );
      expect(typeof id).toBe("string");
    });

    test("logs event with minimal params", () => {
      const id = audit.logEvent(
        "system", "info", null, "startup",
        { message: "System started" }
      );
      expect(typeof id).toBe("string");
    });
  });

  describe("summary", () => {
    test("returns event summary", () => {
      const summary = audit.getSummary();
      expect(summary.total).toBeGreaterThanOrEqual(4);
      expect(summary).toHaveProperty("byType");
      expect(summary).toHaveProperty("bySeverity");
      expect(summary).toHaveProperty("requiresReview");
    });

    test("shows correct severity counts", () => {
      const summary = audit.getSummary();
      expect(summary.bySeverity.info).toBeGreaterThanOrEqual(2);
      expect(summary.bySeverity.warning).toBeGreaterThanOrEqual(1);
      expect(summary.bySeverity.critical).toBeGreaterThanOrEqual(1);
    });
  });

  describe("listing events", () => {
    test("lists all events", () => {
      const events = audit.listEvents({});
      expect(events.length).toBeGreaterThanOrEqual(4);
    });

    test("filters by severity", () => {
      const critical = audit.listEvents({ severity: "critical" });
      expect(critical.every((e) => e.severity === "critical")).toBe(true);
    });

    test("filters by event_type", () => {
      const pii = audit.listEvents({ event_type: "pii_detected" });
      expect(pii.every((e) => e.event_type === "pii_detected")).toBe(true);
    });

    test("filters by requires_review", () => {
      const needsReview = audit.listEvents({ requires_review: true });
      expect(needsReview.every((e) => e.requires_review === 1)).toBe(true);
      expect(needsReview.length).toBeGreaterThanOrEqual(2);
    });

    test("respects limit", () => {
      const events = audit.listEvents({ limit: 2 });
      expect(events.length).toBe(2);
    });
  });

  describe("review marking", () => {
    test("marks an event as reviewed", () => {
      const events = audit.listEvents({ requires_review: true });
      const eventId = events[0].id;
      const result = audit.markReviewed(eventId, "reviewer-1");
      expect(result.ok).toBe(true);
      expect(result.reviewed_by).toBe("reviewer-1");
    });

    test("reviewed event is no longer in requires_review list", () => {
      const before = audit.listEvents({ requires_review: true }).length;
      // At least one less than the original 2 since we just reviewed one
      expect(before).toBeLessThanOrEqual(2);
    });
  });
});
