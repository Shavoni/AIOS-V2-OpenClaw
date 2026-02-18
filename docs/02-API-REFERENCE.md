# AIOS V2 API Reference

**Base URL:** `http://localhost:3000/api`
**Auth:** JWT Bearer token in `Authorization` header (unless noted)
**Content-Type:** `application/json` for all requests/responses

---

## Authentication (`/api/auth`)

No auth required for these endpoints. Rate limited: 10 requests per 15 minutes.

### POST /auth/register
Create a new user account. First user auto-promoted to admin.

```
Request:  { username: string, password: string (8+ chars), email?: string, role?: "admin"|"operator"|"viewer", displayName?: string, department?: string }
Response: { id, username, email, role, created_at }
Errors:   400 (validation), 409 (username/email taken)
```

### POST /auth/login
Authenticate via username/password or API key.

```
Request:  { username: string, password: string } OR { apiKey: string }
Response: { success: true, role, accessToken, refreshToken, sessionId }
Errors:   401 (invalid credentials), 403 (account disabled)
```

### POST /auth/refresh
Exchange refresh token for new access + refresh tokens.

```
Request:  { refreshToken: string }
Response: { accessToken, refreshToken }
Errors:   401 (invalid/expired token)
```

### POST /auth/logout
```
Response: { success: true }
```

### GET /auth/status
Check current authentication state.
```
Response: { authenticated: boolean, user?: { id, username, role }, authRequired: boolean }
```

### GET /auth/users (admin)
```
Response: [{ id, username, email, role, display_name, department, is_active, last_login, created_at }]
```

### PUT /auth/users/:id (admin)
```
Request:  { role?, email?, display_name?, department?, is_active? }
Response: { ok: true }
```

### POST /auth/users/:id/change-password (viewer+)
```
Request:  { password: string (8+ chars) }
Response: { ok: true }
```

### DELETE /auth/users/:id (admin)
```
Response: { ok: true }
```

---

## Chat & Sessions (`/api`)

Auth: viewer+

### POST /chat
Send a message (non-streaming).
```
Request:  { sessionId: string, message: string (max 32000 chars), profile?: string }
Response: { agent: string, response: string, metadata: { model, provider, latencyMs, tokens, hitlMode } }
```

### POST /chat/stream
Send a message (Server-Sent Events streaming).
```
Request:  { sessionId: string, message: string, profile?: string }
Response: SSE stream of { text, done, model, provider, hitlMode }
```

### GET /sessions
```
Response: [{ id, title, profile, created_at, updated_at }]  (limit 50)
```

### POST /sessions
```
Request:  { title?: string, profile?: string }
Response: { id, title, profile, created_at }
```

### GET /sessions/:id/messages
```
Response: [{ id, role, content, metadata, created_at }]  (limit 200)
```

### DELETE /sessions/:id
```
Response: { ok: true }
```

### POST /sessions/conversations
Create session with extended metadata.
```
Request:  { title?, profile?, user_id?, department? }
Response: { id, title, user_id, department, created_at }
```

### GET /sessions/conversations/:id/context
Build LLM context window for a session.
```
Response: { sessionId, messages: [{ role, content }], tokenBudget: 8000 }
```

---

## Agents (`/api/agents`)

Auth: operator+

### GET /agents
```
Response: [{ id, name, title, domain, description, status, capabilities, guardrails, is_router, created_at }]
```

### GET /agents/:id
```
Response: { id, name, title, domain, description, system_prompt, status, capabilities, guardrails, is_router, approved_by, approved_at, rejection_reason, created_at }
```

### POST /agents
Creates agent with **pending** status (requires HITL approval). Routers are created as active.
```
Request:  { name: string (max 200), domain?, description?, system_prompt?, capabilities?: string[], guardrails?: string[], is_router?: boolean }
Response: { id, name, status: "pending", ... }  (201 Created)
```

### PUT /agents/:id
```
Request:  { name?, title?, domain?, description?, system_prompt?, capabilities?, guardrails?, status? }
Response: { id, name, ... }
```

### DELETE /agents/:id
```
Response: { ok: true }
```

### POST /agents/:id/enable
```
Response: { id, status: "active" }
```

### POST /agents/:id/disable
```
Response: { id, status: "disabled" }
```

### POST /agents/route
Intelligent query routing to best agent.
```
Request:  { query: string }
Response: { agent: { id, name, domain }, score, reason, confidence }
```

### Knowledge Documents

```
GET    /agents/:id/knowledge           → [{ id, filename, file_type, file_size, chunk_count, uploaded_at }]
POST   /agents/:id/knowledge           → { id, filename, ... }  (file_type must be txt|md|pdf|json|csv|html|xml|yaml|yml, max 10MB)
DELETE /agents/:id/knowledge/:docId    → { ok: true }
```

### Web Sources

```
GET    /agents/:id/sources             → [{ id, url, name, description, auto_refresh, last_refreshed }]
POST   /agents/:id/sources             → { id, url, name, ... }
DELETE /agents/:id/sources/:sourceId   → { ok: true }
```

---

## Pending Agent Approval (`/api/system`)

Auth: admin

### GET /system/pending-agents
List agents awaiting HITL approval.
```
Response: [{ id, name, domain, description, status: "pending", created_at }]
```

### POST /system/pending-agents/:id/approve
```
Request:  { reviewer_id?: string }
Response: { id, name, status: "active", approved_by, approved_at }
Errors:   404 (not found or not pending)
```

### POST /system/pending-agents/:id/reject
```
Request:  { reviewer_id?: string, reason?: string }
Response: { id, name, status: "rejected", approved_by, rejection_reason }
Errors:   404 (not found or not pending)
```

### POST /system/pending-agents/approve-all
```
Request:  { reviewer_id?: string }
Response: { approved: number, total: number }
```

---

## HITL Approvals (`/api/hitl`)

Auth: operator+

### GET /hitl/queue/summary
```
Response: { total, pending, approved, rejected, byMode: { DRAFT, ESCALATE }, byPriority: { urgent, high, normal, low } }
```

### GET /hitl/approvals
```
Query:    ?status=pending&mode=DRAFT&limit=100
Response: [{ id, status, hitl_mode, priority, agent_name, original_query, created_at }]
```

### POST /hitl/approvals
Create an approval request.
```
Request:  { hitl_mode, priority?, user_id?, agent_id?, agent_name?, original_query, proposed_response?, risk_signals?: string[], guardrails_triggered?: string[], escalation_reason? }
Response: { id, status: "pending", created_at }
```

### GET /hitl/approvals/:id
```
Response: { id, status, hitl_mode, priority, original_query, proposed_response, risk_signals, guardrails_triggered, reviewer_notes, resolved_at, resolved_by, ... }
```

### POST /hitl/approvals/:id/approve
```
Request:  { notes?: string, modified_response?: string }
Response: { id, status: "approved", resolved_by, resolved_at }
```

### POST /hitl/approvals/:id/reject
```
Request:  { reason?: string }
Response: { id, status: "rejected", reviewer_notes }
```

### GET /hitl/sla/status
```
Response: { total, breached, warning, ok, items: [{ id, priority, sla_limit_hours, elapsed_hours, sla_status }] }
```

**SLA Limits:** urgent=1h, high=4h, normal=24h, low=72h

### POST /hitl/batch/approve
```
Request:  { ids: string[], notes?: string }
Response: { approved: number, failed: number, results: [{ id, result?, error? }] }
```

### POST /hitl/batch/reject
```
Request:  { ids: string[], reason?: string }
Response: { rejected: number, failed: number, results: [...] }
```

---

## Deep Research (`/api/research`)

Auth: operator+. Job submission rate limited: 10 per 15 minutes.

### POST /research/jobs
```
Request:  { query: string (max 10000), ttl?: number (60-604800 seconds), metadata?: object }
Response: { id, status: "QUEUED", query, created_at }
```

### GET /research/jobs
```
Query:    ?status=COMPLETED&limit=100
Response: [{ id, status, query, current_stage, stage_progress, confidence_score, created_at, completed_at }]
```

### GET /research/jobs/:id
```
Response: { id, status, query, query_decomposition, current_stage, stage_progress, confidence_score, source_count, has_contradictions, error_message, created_at, completed_at }
```

### GET /research/jobs/:id/result
```
Response: { id, job_id, synthesis, sources: [{ url, title }], claims: [{ text, confidence }], evidence_set, token_usage, created_at }
Errors:   404 (job not found or not completed)
```

### GET /research/jobs/:id/sources
```
Response: [{ id, url, title, content_preview, domain_authority, recency_score, relevance_score, credibility_tier, composite_score, retrieval_method }]
```

### POST /research/jobs/:id/cancel
```
Response: { message: "Job cancelled", jobId }
Errors:   409 (job already in terminal state)
```

### GET /research/queue/summary
```
Response: { QUEUED, PROCESSING, COMPLETED, FAILED, CANCELLED, EXPIRED, total }
```

**Job Status Flow:** QUEUED → PROCESSING → COMPLETED | FAILED | CANCELLED | EXPIRED

---

## Analytics (`/api/analytics`)

Auth: viewer+

### GET /analytics/summary
```
Query:    ?days=30
Response: { totalQueries, totalTokensIn, totalTokensOut, totalCost, avgLatency, errors, escalations, successRate, byAgent: {}, byDepartment: {}, days, since }
```

### GET /analytics/events
```
Query:    ?agent_id=X&user_id=Y&since=ISO&limit=100&offset=0
Response: [{ id, timestamp, user_id, agent_name, query_text, latency_ms, tokens_in, tokens_out, cost_usd, hitl_mode, success }]
```

### GET /analytics/top-agents
```
Query:    ?days=30&limit=5
Response: [{ agent_name, queries, avgLatency, totalCost }]
```

### GET /analytics/top-departments
```
Query:    ?days=30&limit=5
Response: [{ department, queries }]
```

### GET /analytics/hourly-distribution
```
Query:    ?days=30
Response: [{ hour: 0-23, label: "12am", count }]
```

### GET /analytics/export
```
Query:    ?format=csv|json&days=30
Response: CSV file (Content-Disposition: attachment) or JSON array
```

---

## Audit (`/api/audit`)

Auth: operator+

### GET /audit/summary
```
Query:    ?start=ISO&end=ISO
Response: { total, byType: {}, bySeverity: {}, requiresReview, startDate, endDate }
```

### GET /audit/events
```
Query:    ?type=X&severity=high&user_id=Y&requires_review=true&limit=100&offset=0
Response: [{ id, event_type, severity, user_id, action, details, pii_detected, guardrails_triggered, requires_review, reviewed_by, timestamp }]
```

### POST /audit/events
```
Request:  { event_type, severity?, action, details? }
Response: { id }
```

### POST /audit/events/:id/review
```
Response: { id, reviewed_at, reviewed_by }
```

---

## Governance (`/api/governance`)

Auth: admin

### POST /governance/evaluate
Dry-run governance evaluation.
```
Request:  { query: string }
Response: { intent: { domain, confidence }, risk: { level, pii, signals }, decision: { hitlMode, reason } }
```

### Rules CRUD
```
GET    /governance/rules                    → [{ id, name, tier, hitl_mode, is_immutable }]
POST   /governance/rules                    → { id, name, hitl_mode }  (Request: { name, hitl_mode, description?, tier?, conditions? })
PUT    /governance/rules/:id                → { id, ... }
DELETE /governance/rules/:id                → { ok: true }
```

### Versioning
```
GET    /governance/versions                 → [{ id, timestamp, description, ruleCount }]
POST   /governance/versions/:id/rollback    → { ok: true, ruleCount }
```

### Prohibited Topics
```
GET    /governance/prohibited-topics        → [{ id, topic, scope, scope_id, created_at }]
POST   /governance/prohibited-topics        → { id, topic, scope }  (Request: { topic, scope?, scope_id? })
```

---

## Onboarding (`/api/onboarding`)

Auth: operator+

### POST /onboarding/start
```
Request:  { organizationName: string, websiteUrl?: string, organizationType?: string, manualEntry?: boolean }
Response: { id, organization_name, step, progress }
Note:     websiteUrl required unless manualEntry=true
```

### Wizard Lifecycle
```
GET    /onboarding/wizards                  → [{ id, organization_name, step, progress, created_at }]
GET    /onboarding/wizards/:id              → Full wizard state with departments, preview, checklist
DELETE /onboarding/wizards/:id              → { ok: true }
```

### Discovery
```
POST   /onboarding/discover                 → { job_id, status: "crawling" }  (Request: { url })
GET    /onboarding/discover/:jobId          → { status, result?, error? }
POST   /onboarding/wizards/:id/discover     → Wizard with discovery result applied
POST   /onboarding/wizards/:id/apply-discovery → { id, departments: [...] }  (Request: { discoveryResult })
```

### Configuration
```
POST   /onboarding/wizards/:id/match-templates  → Wizard with template_matches
PUT    /onboarding/wizards/:id/template          → Wizard  (Request: { templateId })
PUT    /onboarding/wizards/:id/departments/:name → Wizard  (Request: { enabled?, customName?, customInstructions? })
PUT    /onboarding/wizards/:id/departments-bulk  → Wizard  (Request: { action: "enable-all"|"disable-all"|"update", departments? })
```

### Deploy
```
POST   /onboarding/wizards/:id/preview      → Wizard with preview (agents, costs, warnings)
POST   /onboarding/wizards/:id/approve/:idx  → Wizard with checklist item approved
POST   /onboarding/wizards/:id/deploy        → Wizard with deployment result  (Request: { skipApproval? })
Note:   Non-router agents deployed as "pending" — must be approved in Approvals page
```

---

## Integrations (`/api/integrations`)

Auth: operator+

```
GET    /integrations?status=X&type=Y&agent_id=Z  → [{ id, name, type, status, auth_config (redacted) }]
POST   /integrations                              → { id, name, status: "pending" }
GET    /integrations/:id                          → Full connector (auth redacted)
PUT    /integrations/:id                          → Updated connector
DELETE /integrations/:id                          → { ok: true }
POST   /integrations/:id/approve                  → { id, status: "approved" }
POST   /integrations/:id/suspend                  → { id, status: "suspended" }
GET    /integrations/:id/events                   → [{ event_type, details, created_at }]
```

---

## GDPR (`/api/gdpr`)

Auth: viewer+. Operations scoped to authenticated user.

### GET /gdpr/export
Full data export for the authenticated user.
```
Response: { format_version: "1.0", exported_at, user: {...}, sessions: [{ messages }], consents, audit_events }
```

### DELETE /gdpr/erase
Right to erasure. Requires `?confirm=true`.
```
Response: { ok: true, message: "All user data has been erased" }
Note:     Audit events are anonymized (user_id='DELETED'), not deleted
```

### Consents
```
GET    /gdpr/consents            → [{ consent_type, granted, granted_at, revoked_at }]
POST   /gdpr/consents            → { consent_type, granted_at }  (Request: { consent_type })
DELETE /gdpr/consents/:type      → { ok: true }
```

### GET /gdpr/privacy
Static privacy notice.
```
Response: { title, data_collected, data_retention, your_rights, contact }
```

---

## RAG (`/api/rag`)

### POST /rag/index/:agentId (operator+)
```
Request:  { documentId, content, metadata? }
Response: { ok: true, chunks: number }
```

### POST /rag/search/:agentId (viewer+)
```
Request:  { query, topK?: number }
Response: [{ documentId, chunkIndex, textPreview, score }]
```

### GET /rag/stats (viewer+)
```
Response: { canonChunks, hasEmbedder }
```

---

## System (`/api/system`)

Auth: admin

### LLM Config
```
GET    /system/llm-config        → Config with masked API keys
PUT    /system/llm-config        → Updated config  (Request: provider settings)
GET    /system/llm-config/usage  → { totalSpend, totalTokens, totalCalls, byProvider }
```

### Branding
```
GET    /system/branding          → { appName, organization, primaryColor, logo }
PUT    /system/branding          → Updated branding
POST   /system/branding/upload-logo → { ok, path }  (Request: { data: base64, filename? })
```

### Canon (Shared Knowledge)
```
GET    /system/canon/documents   → [{ id, filename, content, file_type, file_size, uploaded_at }]
POST   /system/canon/documents   → { id, filename }
DELETE /system/canon/documents/:id → { ok: true }
```

### Retention
```
GET    /system/retention         → { messages_days, audit_events_days, query_events_days }
PUT    /system/retention         → Updated policy
POST   /system/retention/purge   → { ok: true, purged: { messages, audit_events, query_events } }
```

### Backup
```
POST   /system/backup            → Binary SQLite file (Content-Disposition: attachment)
POST   /system/backup/validate   → { valid: boolean, sizeBytes, timestamp }  (Request: { data: base64 })
```

### Other
```
POST   /system/regenerate-concierge → Concierge agent object
POST   /system/reset                → { ok: true, message: "Not yet implemented" }
```

---

## Error Response Format

All errors return:
```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|--------|---------|
| 400 | Validation failure or bad request |
| 401 | Missing or invalid authentication |
| 403 | Insufficient role permissions |
| 404 | Resource not found |
| 409 | Conflict (e.g., cancel completed job) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Rate Limits

| Limiter | Limit | Window | Applied To |
|---------|-------|--------|-----------|
| `authLimiter` | 10 req | 15 min | `/api/auth/*` |
| `chatLimiter` | 30 req | 1 min | `/api/chat` |
| `apiLimiter` | 100 req | 1 min | All other routes |
| `heavyLimiter` | 5 req | 1 min | Exports, reports |
| `jobSubmitLimiter` | 10 req | 15 min | `POST /api/research/jobs` |
