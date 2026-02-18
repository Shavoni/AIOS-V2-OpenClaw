# AIOS V2 — Technical Architecture Reference

> Last updated: 2026-02-18 | Version: 0.1.0 | 49 test suites, 379 tests passing

## What AIOS V2 Is

A self-hostable AI operating system and agent orchestration platform. Full-stack infrastructure for deploying, governing, monitoring, and managing AI agents. Not a chatbot wrapper — a complete AI operations layer.

**Primary agent:** Scotty-5 (strategic AI operator)
**Builder:** Shavoni (Scott Parker), CEO/CTO DEF1LIVE LLC / HAAIS

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+, Express 4.21 |
| Database | SQLite via sql.js (WebAssembly, zero-config, in-process) |
| Real-Time | Socket.io 4.8 (WebSocket) |
| Frontend | Vanilla ES Module SPA — 13 pages, no build step |
| Auth | JWT + API keys, RBAC (viewer / operator / admin) |
| LLM Routing | OpenAI, Anthropic, Gemini, Moonshot Kimi, Ollama, LM Studio |
| Local AI | RTX 5090, 128GB RAM (Ollama + LM Studio) |
| Security | Helmet, express-rate-limit, bcryptjs, XSS sanitization |

---

## Database Schema (25 Tables)

### Core (Phase 1)
- `sessions` — Chat sessions with user/department scoping
- `messages` — Chat messages (user/assistant/system) with metadata JSON, cascading delete
- `audit_log` — Per-action log: intent domain, risk signals, HITL mode, model/provider
- `skill_invocations` — Skill execution log: input, output, success, duration_ms

### Agent Management (Phase 2)
- `agents` — Multi-agent registry: name, domain, system prompt, capabilities[], guardrails[], router flag, escalation target
- `knowledge_documents` — Per-agent document uploads with chunk counts
- `web_sources` — Per-agent web URLs with auto-refresh intervals (default 24h)

### HITL Workflows (Phase 3)
- `approval_requests` — Human-in-the-loop decisions: status, priority, risk signals, proposed response, reviewer notes

### Analytics & Audit (Phase 4)
- `query_events` — Per-query telemetry: latency_ms, tokens_in, tokens_out, cost_usd, HITL mode, guardrails
- `audit_events` — Security/compliance events with severity, PII detection, review tracking

### Governance (Phase 5)
- `policy_rules` — Configurable governance rules with tier, conditions JSON, HITL mode, immutability flag
- `prohibited_topics` — Global or scoped topic blocklist
- `governance_versions` — Full snapshot versioning with change attribution

### System (Phase 6)
- `system_settings` — Key-value application settings
- `canon_documents` — Organizational knowledge base for RAG context

### Templates & Onboarding (Phase 8)
- `agent_templates` — Reusable agent configs with category and built-in flag
- `onboarding_wizards` — Full onboarding session state: org info, discovery results, department mapping, deployment status

### Authentication
- `users` — User accounts with role, department, bcrypt hash, active flag
- `refresh_tokens` — JWT refresh tokens with expiry, cascading delete

### GDPR Compliance
- `user_consents` — Per-user consent tracking with grant/revocation timestamps

### RAG / Embeddings
- `embeddings` — Binary blob vector embeddings per agent per document per chunk

### Integration Connectors
- `connectors` — External integrations: type, auth config, health status, approval workflow (pending → approved → suspended)
- `connector_events` — Event log per connector, cascading delete

**15 indexes** across these tables for query performance.

---

## API Routes (13 Groups)

| Route | Auth Level | Purpose |
|-------|-----------|---------|
| `/api/auth` | None (self-handles) | Login, register, refresh tokens |
| `/api/` (chat) | viewer | Core chat with LLM routing |
| `/api/agents` | operator | Agent CRUD, classifier |
| `/api/hitl` | operator | Approval queue management |
| `/api/analytics` + `/reports` | viewer | Query metrics, summary/text reports |
| `/api/audit` | operator | Audit event log |
| `/api/governance` | admin | Policy rules management |
| `/api/system` | admin | LLM config, branding, canon |
| `/api/onboarding` | operator | Onboarding wizard |
| `/api/integrations` | operator | Connector CRUD + approval pipeline |
| `/api/gdpr` | viewer | Consent + data erasure |
| `/api/rag/*` | operator/viewer | Document indexing + search |

---

## Frontend Pages (13)

| Route | Page | Key Features |
|-------|------|-------------|
| `/` | Dashboard | Stat cards, activity feed, real-time metrics via Socket.io |
| `/chat` | Chat | Multi-model chat with streaming, agent selection |
| `/agents` | Agents | Agent cards, CRUD, domain filtering |
| `/skills` | Skills | Category chips, search, execution form, detail panel |
| `/memory` | Memory | Memory viewer/editor |
| `/models` | Models | Provider config, model routing settings |
| `/metrics` | Metrics | Analytics charts and dashboards |
| `/approvals` | Approvals | HITL approval queue with real-time updates |
| `/audit` | Audit | Security event log viewer |
| `/settings` | Settings | Application configuration |
| `/onboarding` | Onboarding | Multi-step wizard with smart filter chips + live search |
| `/integrations` | Integrations | Connector cards, status filters, approve/suspend actions |
| `/login` | Login | JWT authentication |

---

## Key Architecture Patterns

### Dirty-Flag Auto-Save
All database writes set `markDirty()`. A 30-second background timer flushes to disk. Prevents write-amplification under load.

### Event Bus
`src/services/event-bus.js` decouples internal events (HITL updates, metrics) from request lifecycle.

### RAG Pipeline
Indexes canon documents on startup. Supports per-agent document indexing. Embedding classifier with keyword fallback if embeddings aren't ready.

### Governance Engine
Three components: `IntentClassifier` → `RiskDetector` → `GovernanceEngine`. Policy rules with immutable guardrails. Full version history for audit/rollback.

### Theme System
CSS custom properties with `[data-theme="light"]` overrides. ThemeManager class with localStorage persistence and subscriber pattern.

### Integration Framework
Connector lifecycle: pending → approved → suspended. Agent-linkable via FK with ON DELETE SET NULL. Event logging per connector.

---

## Service Dependency Map

```
createApp()
├── Config (loadConfig)
├── Database (sql.js + initSchema + autoSave@30s)
├── ModelRouter (multi-provider LLM routing)
├── AgentManager (file-based identity: SOUL.md, IDENTITY.md, USER.md)
├── SkillEngine (scans skills/ directory)
├── MemoryManager (db + markDirty)
├── GovernanceEngine
│   ├── IntentClassifier
│   ├── RiskDetector
│   └── PolicyRules (from db)
├── AgentManagerService (CRUD)
├── HITLManager (approval workflows)
├── AnalyticsManager (query events)
├── AuditManager (security events)
├── LLMConfig + BrandingService + CanonService
├── OnboardingWizard
├── AuthService (JWT + API keys)
├── EmbeddingProvider + VectorStore
├── RAGPipeline (canon indexing)
├── EmbeddingClassifier (async init, keyword fallback)
├── ReportGenerator (analytics + audit + HITL)
├── ConnectorService (integration CRUD + approval)
├── GDPRService + ConsentService
└── MessageHandler (combines all above for chat)
```

---

## Test Coverage

| Category | Suites | Tests |
|----------|--------|-------|
| Frontend | 6 | 47 |
| Integration | 4 | 28 |
| Accessibility | 5 | 22 |
| Backend Services | 20+ | 200+ |
| Auth/Middleware | 4 | 40+ |
| RAG/Embeddings | 3 | 20+ |
| GDPR | 3 | 20+ |
| **Total** | **49** | **379** |

---

## Current Status

- Version: 0.1.0
- Architecture: Complete
- Backend: Complete (13 route groups, 25 tables)
- Frontend: Complete (13 pages, real-time WebSocket)
- Tests: 49 suites, 379 passing, 0 failures
- Deployment: Local-ready (npm start), Docker-ready (Dockerfile + docker-compose.yml)

### Next Steps
- Production hardening (rate limiting tuning, error recovery)
- Enterprise pilot validation
- Deployment packaging (Docker, cloud templates)
- Performance benchmarking under load
