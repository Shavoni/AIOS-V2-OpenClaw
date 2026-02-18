# Governance Engine & HITL Approval Workflows

## Overview

Every user message passes through the Governance Engine before reaching the LLM. The engine classifies intent, detects risks, and determines whether human oversight is needed.

```
User Message
    ↓
[Intent Classifier] → domain, confidence
    ↓
[Risk Detector] → PII, prohibited topics, guardrails
    ↓
[Governance Engine] → evaluate against policy rules
    ↓
HITL Mode Decision:
  INFORM    → Log only, respond normally
  DRAFT     → Respond but mark for review
  ESCALATE  → Block response, queue for human approval
```

---

## Intent Classifier

**File:** `src/governance/classifier.js`

Classifies queries into domains using keyword matching:

| Domain | Keywords |
|--------|---------|
| support | help, issue, problem, broken |
| billing | invoice, payment, charge, refund |
| technical | bug, error, code, deploy |
| legal | contract, compliance, regulation |
| hr | hiring, leave, benefits, payroll |
| finance | budget, expense, revenue |
| general | (fallback) |

**Returns:** `{ domain, confidence, keywords }`

### Embedding Classifier (optional)

**File:** `src/governance/embedding-classifier.js`

Uses vector embeddings for semantic classification when an embedder is available. Falls back to keyword classifier if not configured.

---

## Risk Detector

**File:** `src/governance/risk-detector.js`

Scans messages for:

1. **PII Patterns** — SSN, credit card, email, phone number, date of birth
2. **Prohibited Topics** — Loaded from `prohibited_topics` table (global or per-agent)
3. **Guardrail Violations** — Per-agent guardrail rules

**Returns:** `{ level: "low"|"medium"|"high"|"critical", pii: [], risks: [], signals: [] }`

**PII Detection Patterns:**
```
SSN:         \d{3}-\d{2}-\d{4}
Credit Card: \d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}
Email:       \S+@\S+\.\S+
Phone:       \(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}
```

---

## HITL Modes

| Mode | Behavior | When Used |
|------|----------|-----------|
| **INFORM** | Log the interaction, respond normally | Low-risk queries, general information |
| **DRAFT** | Respond to user but prefix with "[DRAFT]", queue for review | Medium-risk queries, sensitive topics |
| **ESCALATE** | Block the response, return escalation message, queue for human approval | High-risk queries, PII detected, prohibited topics |

---

## Policy Rules

**Table:** `policy_rules`

Rules define conditions that trigger HITL modes:

```javascript
{
  name: "Legal Review Required",
  tier: "standard",
  hitl_mode: "ESCALATE",
  conditions: {
    domain: "legal",
    risk_level: "high"
  },
  priority: 80,           // Higher = checked first
  is_immutable: false      // Can be deleted?
}
```

Rules are evaluated in priority order. First matching rule determines the HITL mode.

### Versioning

Every rule change creates a snapshot in `governance_versions`. The system supports rollback to any previous version.

---

## Approval Workflows

### Response Approvals (HITL Queue)

When DRAFT or ESCALATE is triggered:

1. `HITLManager.createApproval()` creates a record in `approval_requests`
2. Record includes: original query, proposed response (for DRAFT), risk signals, guardrails triggered, priority
3. Appears in the Approvals page "Response Approvals" tab
4. Reviewer can:
   - **Approve** — Optionally with notes or modified response
   - **Reject** — With reason

### Agent Approvals

All new agents require human approval before activation:

1. Agent created via UI, API, or Onboarding Wizard → `status: "pending"`
2. Appears in Approvals page "Pending Agents" tab
3. Reviewer clicks Approve or Reject
4. Approved → `status: "active"`, recorded with `approved_by` and `approved_at`
5. Rejected → `status: "rejected"`, recorded with `rejection_reason`

**Exception:** Router agents (Concierge) bypass approval — they're system agents.

### Connector Approvals

Third-party integration connectors also require approval:

1. Connector created → `status: "pending"`
2. Operator approves → `status: "approved"`, recorded with `approved_by`
3. Can be suspended later → `status: "suspended"`

---

## SLA Monitoring

Pending approvals have priority-based SLA timers:

| Priority | SLA Limit | Breach After |
|----------|-----------|-------------|
| urgent | 1 hour | 60 min |
| high | 4 hours | 240 min |
| normal | 24 hours | 1440 min |
| low | 72 hours | 4320 min |

**SLA Status:**
- **OK** — More than 50% of time remaining
- **Warning** — Less than 50% remaining
- **Breached** — Time exceeded

The `/api/hitl/sla/status` endpoint returns breach counts for monitoring.

---

## Audit Trail

Every governance decision is logged to the audit system:

```javascript
{
  event_type: "escalation",
  severity: "warning",
  user_id: "user-123",
  action: "Query escalated to HITL queue",
  details: {
    intent: { domain: "legal", confidence: 0.9 },
    risk: { level: "high", pii: ["email"] },
    hitl_mode: "ESCALATE"
  },
  pii_detected: ["email"],
  guardrails_triggered: ["legal_review"]
}
```

---

## Frontend Integration

### Approvals Page (`public/js/pages/approvals.js`)

Two tabs:
1. **Response Approvals** — HITL queue with filters (status, priority, mode, search)
2. **Pending Agents** — Agents awaiting human approval

Features:
- Batch approve/reject for response approvals
- SLA indicators (ok/warning/breach)
- Review panel with full context (query, response, risk signals, guardrails)
- Modified response capability
- Reviewer notes

### Stats Dashboard
Shows: Pending count, Urgent count, Escalated count, Avg resolution time

---

## API Endpoints

### Response Approvals
```
GET    /api/hitl/queue/summary          Queue statistics
GET    /api/hitl/approvals              List with filters
POST   /api/hitl/approvals              Create approval request
GET    /api/hitl/approvals/:id          Get single approval
POST   /api/hitl/approvals/:id/approve  Approve (with optional modified response)
POST   /api/hitl/approvals/:id/reject   Reject (with optional reason)
GET    /api/hitl/sla/status             SLA monitoring
POST   /api/hitl/batch/approve          Bulk approve
POST   /api/hitl/batch/reject           Bulk reject
```

### Agent Approvals
```
GET    /api/system/pending-agents           List pending agents
POST   /api/system/pending-agents/:id/approve  Approve agent
POST   /api/system/pending-agents/:id/reject   Reject agent
POST   /api/system/pending-agents/approve-all  Bulk approve all
```

### Governance Rules
```
POST   /api/governance/evaluate              Dry-run evaluation
GET    /api/governance/rules                 List rules
POST   /api/governance/rules                 Create rule
PUT    /api/governance/rules/:id             Update rule
DELETE /api/governance/rules/:id             Delete rule
GET    /api/governance/versions              Version history
POST   /api/governance/versions/:id/rollback Rollback
GET    /api/governance/prohibited-topics     List topics
POST   /api/governance/prohibited-topics     Add topic
```
