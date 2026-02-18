const { HITLManager } = require("../../src/hitl/manager");

describe("HITLManager", () => {
  let db, hitl;

  beforeAll(async () => {
    const initSqlJs = require("sql.js");
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");

    const { initSchema } = require("../../src/db/schema");
    initSchema(db);

    hitl = new HITLManager(db, () => {});
  });

  afterAll(() => {
    if (db) db.close();
  });

  describe("approval creation", () => {
    test("creates an approval request", () => {
      const approval = hitl.createApproval({
        hitl_mode: "DRAFT",
        priority: "medium",
        user_id: "user-1",
        user_department: "Legal",
        agent_id: "agent-1",
        agent_name: "Legal Bot",
        original_query: "Review this contract",
        proposed_response: "Here is my analysis...",
        risk_signals: ["LEGAL_CONTRACT"],
        guardrails_triggered: ["requires-review"],
      });

      expect(approval.id).toBeTruthy();
      expect(approval.status).toBe("pending");
      expect(approval.hitl_mode).toBe("DRAFT");
    });

    test("creates an escalation request", () => {
      const approval = hitl.createApproval({
        hitl_mode: "ESCALATE",
        priority: "high",
        user_id: "user-2",
        original_query: "Send company-wide announcement",
        escalation_reason: "Public statement requires approval",
      });

      expect(approval.hitl_mode).toBe("ESCALATE");
      expect(approval.priority).toBe("high");
    });
  });

  describe("queue operations", () => {
    test("lists pending approvals", () => {
      const pending = hitl.listPending({});
      expect(pending.length).toBeGreaterThanOrEqual(2);
      expect(pending.every((a) => a.status === "pending")).toBe(true);
    });

    test("lists all approvals", () => {
      const all = hitl.listAll({});
      expect(all.length).toBeGreaterThanOrEqual(2);
    });

    test("filters by hitl_mode", () => {
      const escalations = hitl.listPending({ hitl_mode: "ESCALATE" });
      expect(escalations.every((a) => a.hitl_mode === "ESCALATE")).toBe(true);
    });

    test("filters by priority", () => {
      const high = hitl.listPending({ priority: "high" });
      expect(high.every((a) => a.priority === "high")).toBe(true);
    });

    test("gets queue summary", () => {
      const summary = hitl.getQueueSummary();
      expect(summary.pending).toBeGreaterThanOrEqual(2);
      expect(summary.byMode).toBeTruthy();
      expect(summary.byPriority).toBeTruthy();
    });
  });

  describe("approve/reject flow", () => {
    let approvalId;

    beforeAll(() => {
      const approval = hitl.createApproval({
        hitl_mode: "DRAFT",
        original_query: "Test approval flow",
        proposed_response: "Draft response text",
      });
      approvalId = approval.id;
    });

    test("gets a single approval", () => {
      const approval = hitl.getApproval(approvalId);
      expect(approval).toBeTruthy();
      expect(approval.original_query).toBe("Test approval flow");
    });

    test("approves a request", () => {
      const result = hitl.approve(approvalId, "reviewer-1", "Looks good", "Modified response");
      expect(result.status).toBe("approved");
      expect(result.resolved_by).toBe("reviewer-1");
      expect(result.reviewer_notes).toBe("Looks good");
    });

    test("approved request no longer in pending list", () => {
      const pending = hitl.listPending({});
      const found = pending.find((a) => a.id === approvalId);
      expect(found).toBeUndefined();
    });

    test("rejects a request", () => {
      const newApproval = hitl.createApproval({
        hitl_mode: "ESCALATE",
        original_query: "Reject me",
      });
      const result = hitl.reject(newApproval.id, "reviewer-1", "Not appropriate");
      expect(result.status).toBe("rejected");
      expect(result.reviewer_notes).toBe("Not appropriate");
    });

    test("summary reflects resolved items", () => {
      const summary = hitl.getQueueSummary();
      expect(summary.approved).toBeGreaterThanOrEqual(1);
      expect(summary.rejected).toBeGreaterThanOrEqual(1);
    });
  });
});
