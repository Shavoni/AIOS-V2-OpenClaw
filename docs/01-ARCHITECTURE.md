# AIOS V2 Architecture Guide

## System Overview

AIOS V3 is a modular Node.js platform built on Express with SQLite (sql.js) persistence. Every component is injected via constructor — no global singletons except the EventBus.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend SPA (Vanilla JS)                    │
│  Dashboard | Chat | Agents | Approvals | Research | Settings    │
│  13 pages, component library, client-side router                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST API + WebSocket (Socket.io)
┌───────────────────────────┴─────────────────────────────────────┐
│                    Express Middleware Stack                       │
│  1. morgan (logging)                                             │
│  2. helmet (security headers)                                    │
│  3. cors                                                         │
│  4. express.json (body parsing, 1MB limit)                       │
│  5. rate-limit (per-route)                                       │
│  6. auth-middleware (JWT / API key / session)                     │
│  7. validation (schema-based)                                    │
│  8. sanitize (XSS protection)                                    │
│  9. async-handler (error forwarding)                             │
│  10. error-handler (catch-all)                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                    Route Modules                                  │
│  /api/auth       → src/routes/auth.js                            │
│  /api/chat       → src/chat/routes.js                            │
│  /api/agents     → src/agents/routes.js                          │
│  /api/hitl       → src/hitl/routes.js                            │
│  /api/analytics  → src/analytics/routes.js                       │
│  /api/audit      → src/audit/routes.js                           │
│  /api/governance → src/governance/routes.js                      │
│  /api/system     → src/system/routes.js                          │
│  /api/onboarding → src/onboarding/routes.js                     │
│  /api/integrations → src/integration/routes.js                   │
│  /api/gdpr       → src/gdpr/routes.js                            │
│  /api/research   → src/research/routes.js                        │
│  /api/rag        → inline in src/index.js                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                    Service Managers                               │
│  AuthService          — JWT, sessions, RBAC                      │
│  AgentManagerService  — Agent CRUD, routing, HITL approval       │
│  HITLManager          — Approval queue, SLA                      │
│  GovernanceEngine     — Intent + Risk → HITL mode                │
│  AnalyticsManager     — Query telemetry aggregation              │
│  AuditManager         — Security event logging                   │
│  ResearchQueueService — 4-stage research pipeline                │
│  ResearchJobManager   — Research job DB persistence              │
│  OnboardingWizard     — Multi-step deployment wizard             │
│  ConnectorService     — Third-party integration lifecycle        │
│  RetentionService     — Data purge policies                      │
│  ConsentService       — GDPR consent tracking                    │
│  GDPRService          — Data export and erasure                  │
│  MemoryManager        — Sessions, messages, file memory          │
│  RAGPipeline          — Document indexing and retrieval           │
│  SkillEngine          — Skill loading and execution              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                    Model Router                                   │
│  Providers: OpenAI | Anthropic | Gemini | Kimi | Ollama          │
│             LM Studio | AnythingLLM                              │
│  Fallback chain with auto-retry                                  │
│  Streaming (SSE) + non-streaming modes                           │
│  Token usage + cost tracking per provider                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────────┐
│                    SQLite (sql.js)                                │
│  30+ tables | In-memory with file persistence                    │
│  Auto-save via markDirty() pattern (batched every 30s)           │
│  Backup/restore | Retention purge | Foreign keys enabled         │
└─────────────────────────────────────────────────────────────────┘
```

## Source Directory Map

```
src/
├── index.js                    # App factory — initializes everything
├── app.js                      # Express app config
│
├── agents/                     # Agent CRUD, routing, HITL approval
│   ├── manager.js              # AgentManagerService
│   └── routes.js               # /api/agents endpoints
│
├── analytics/                  # Query telemetry
│   ├── manager.js              # AnalyticsManager
│   ├── reports.js              # CSV/JSON/text exports
│   └── routes.js               # /api/analytics endpoints
│
├── audit/                      # Security event logging
│   ├── manager.js              # AuditManager
│   └── routes.js               # /api/audit endpoints
│
├── chat/                       # Core chat system
│   ├── message-handler.js      # Message processing pipeline
│   ├── routes.js               # /api/chat + session endpoints
│   └── socket.js               # WebSocket handler
│
├── config/                     # Config loading
│   ├── index.js                # loadConfig()
│   └── providers.js            # Provider config parsing
│
├── db/                         # Database layer
│   ├── index.js                # getDb, saveDb, markDirty
│   ├── schema.js               # 30+ CREATE TABLE statements
│   ├── retention-service.js    # Data purge policies
│   └── backup-service.js       # Backup/restore
│
├── gdpr/                       # GDPR compliance
│   ├── gdpr-service.js         # Data export + erasure
│   ├── consent-service.js      # Consent tracking
│   └── routes.js               # /api/gdpr endpoints
│
├── governance/                 # Policy engine
│   ├── index.js                # GovernanceEngine orchestrator
│   ├── classifier.js           # IntentClassifier (keyword)
│   ├── embedding-classifier.js # EmbeddingClassifier (semantic)
│   ├── risk-detector.js        # PII, prohibited topics, guardrails
│   ├── policies.js             # Policy rule definitions
│   ├── hitl.js                 # HITL mode decision logic
│   └── routes.js               # /api/governance endpoints
│
├── hitl/                       # Human-in-the-loop approvals
│   ├── manager.js              # HITLManager
│   └── routes.js               # /api/hitl endpoints
│
├── integration/                # Third-party connectors
│   ├── connector-service.js    # ConnectorService
│   └── routes.js               # /api/integrations endpoints
│
├── memory/                     # Context and persistence
│   ├── store.js                # SQLite message store
│   ├── file-memory.js          # Disk-based file memory
│   └── context-builder.js      # LLM context window builder
│
├── middleware/                  # Request processing
│   ├── auth-middleware.js       # JWT/API key/session auth
│   ├── async-handler.js        # Try-catch wrapper
│   ├── error-handler.js        # Global error handler
│   ├── rate-limit.js           # Rate limiting configs
│   ├── sanitize.js             # XSS protection
│   └── validation.js           # Schema validation
│
├── onboarding/                 # Deployment wizard
│   ├── wizard.js               # OnboardingWizard
│   ├── discovery.js            # Web scraping engine
│   ├── llm-discovery.js        # LLM-powered discovery
│   └── routes.js               # /api/onboarding endpoints
│
├── rag/                        # Retrieval-Augmented Generation
│   ├── index.js                # RAGPipeline orchestrator
│   ├── chunker.js              # Document chunking
│   ├── vector-store.js         # SQLite vector storage
│   ├── search.js               # TF-IDF keyword search
│   └── embedding-provider.js   # Embedding generation
│
├── research/                   # Deep research pipeline
│   ├── manager.js              # ResearchJobManager (DB)
│   ├── queue-service.js        # ResearchQueueService (orchestrator)
│   ├── scoring-engine.js       # SourceScorer, ClaimScorer, JobConfidence
│   ├── routes.js               # /api/research endpoints
│   └── workers/
│       ├── base-worker.js      # Shared timeout + JSON parsing
│       ├── decomposition.js    # Query → sub-questions
│       ├── retrieval.js        # Sources via RAG + Tavily
│       ├── scoring.js          # Source/claim scoring
│       └── synthesis.js        # Markdown report generation
│
├── router/                     # LLM provider routing
│   ├── index.js                # ModelRouter
│   ├── provider.js             # Provider abstraction
│   ├── fallback.js             # FallbackRouter
│   └── stream.js               # SSE streaming
│
├── routes/                     # Legacy route modules
│   └── auth.js                 # /api/auth endpoints
│
├── services/                   # Core services
│   ├── auth-service.js         # AuthService
│   ├── event-bus.js            # EventBus (pub/sub)
│   └── providers/              # LLM provider implementations
│       ├── openai.js
│       ├── anthropic.js
│       ├── gemini.js
│       ├── ollama.js
│       └── lmstudio.js
│
├── skills/                     # Skill framework
│   ├── registry.js             # SkillRegistry
│   └── parser.js               # SKILL.md parser
│
├── system/                     # System administration
│   ├── llm-config.js           # LLMConfig service
│   ├── branding.js             # BrandingService
│   ├── canon.js                # CanonService (shared docs)
│   └── routes.js               # /api/system endpoints
│
└── utils/                      # Shared utilities
    ├── redaction.js             # Auth config redaction
    ├── cost-calculator.js       # Token cost estimation
    └── sse.js                   # SSE stream helpers
```

## Key Data Flows

### 1. Chat Message Flow

```
User sends POST /api/chat { sessionId, message }
  │
  ├─ [authRequired('viewer')] → verify JWT, populate req.user
  ├─ [validate(schemas.chat)] → check sessionId + message present
  ├─ [sanitizeMessage()] → strip XSS
  │
  └─ MessageHandler.handle(sessionId, message)
       │
       ├─ IntentClassifier.classify(message)     → { domain, confidence }
       ├─ RiskDetector.detect(message)           → { pii[], risks[], level }
       ├─ GovernanceEngine.evaluate(intent, risk) → { hitlMode, decision }
       │
       ├─ [ESCALATE?] → HITLManager.createApproval() → return escalation msg
       │
       ├─ MemoryManager.addMessage(sessionId, 'user', message)
       ├─ ContextBuilder.buildContext(sessionId, 8000)
       │   ├─ FileMemory → persistent notes (25% budget)
       │   └─ Store.getRecentMessages() → history (75% budget)
       │
       ├─ RAGPipeline.retrieveContext(agentId, message, 3, 1000)
       │   ├─ Vector search (if embedder available)
       │   └─ TF-IDF keyword search (fallback)
       │
       ├─ ModelRouter.route(messages, { model, stream })
       │   ├─ Primary provider (e.g. OpenAI)
       │   └─ Fallback chain on failure
       │
       ├─ [DRAFT?] → prefix response, queue for review
       ├─ MemoryManager.addMessage(sessionId, 'assistant', response)
       ├─ AnalyticsManager.recordQuery(event)
       └─ AuditManager.logEvent(type, severity, ...)
```

### 2. Agent Lifecycle

```
Create Agent (UI/API/Onboarding)
  │
  └─ AgentManagerService.createAgent({ status: "pending" })
       │
       ├─ Stored in agents table with pending status
       ├─ approved_by, approved_at, rejection_reason = NULL
       │
       └─ Appears in GET /api/system/pending-agents
            │
            ├─ POST .../approve → status: "active", approved_by, approved_at set
            │   └─ Agent now participates in query routing
            │
            └─ POST .../reject → status: "rejected", rejection_reason set
                └─ Agent archived, never routes queries

Exception: Router agents (Concierge) created as "active" directly
```

### 3. Research Pipeline

```
POST /api/research/jobs { query }
  │
  └─ ResearchQueueService.submitJob()
       │
       ├─ ResearchJobManager.createJob() → status: QUEUED
       ├─ EventBus.emit("research:queued")
       └─ _drainQueue() → if concurrency allows, start processing
            │
            ├─ Stage 1: DecompositionWorker.execute(query)
            │   └─ LLM breaks query into 3-7 sub-questions
            │
            ├─ [cancellation check]
            │
            ├─ Stage 2: RetrievalWorker.execute(subQuestions)
            │   ├─ RAG search (local documents)
            │   └─ Tavily API (web search)
            │
            ├─ [cancellation check]
            │
            ├─ Stage 3: ScoringWorker.execute(sources, query)
            │   ├─ SourceScorer → composite score per source
            │   ├─ LLM claim extraction → supporting/contradicting
            │   ├─ ClaimScorer → confidence per claim
            │   └─ JobConfidenceCalculator → overall confidence
            │
            ├─ [cancellation check]
            │
            └─ Stage 4: SynthesisWorker.execute(evidence)
                ├─ LLM generates structured markdown report
                ├─ ResearchJobManager.saveResult()
                ├─ ResearchJobManager.completeJob()
                └─ EventBus.emit("research:completed")
```

## Persistence Pattern

All services use the `markDirty()` callback pattern:

```javascript
// In service constructor
constructor(db, saveFn) {
  this.db = db;
  this.saveFn = saveFn; // markDirty callback
}

// After any write operation
this.db.run("INSERT INTO ...", [...]);
if (this.saveFn) this.saveFn();
```

The `markDirty()` function in `src/db/index.js` sets a dirty flag. A 30-second interval checks the flag and writes the in-memory SQLite DB to disk if dirty. This batches writes for performance.

## Event Bus

`src/services/event-bus.js` — Simple EventEmitter singleton.

**Events emitted by the system:**
- `research:queued` — New research job submitted
- `research:progress` — Stage progress update
- `research:completed` — Research job finished
- `research:failed` — Research job errored
- `research:cancelled` — Research job cancelled
- `hitl:created` — New approval request
- `hitl:approved` — Approval granted
- `hitl:rejected` — Approval denied

Socket.io subscribes to these events and forwards to connected clients for real-time UI updates.

## Authentication Modes

The auth middleware checks three methods in order:

1. **JWT Bearer** — `Authorization: Bearer <token>` header
2. **API Key** — `X-Api-Key: <key>` header
3. **Session Cookie** — `aios-session` cookie

**Dev Mode:** If no users exist in DB and no API keys configured, all requests auto-grant `admin` role. This makes first-time setup frictionless.

**Role Hierarchy:** `admin (3) > operator (2) > viewer (1)`

| Route Group | Minimum Role |
|------------|-------------|
| `/api/auth` | None (public) |
| `/api/chat`, `/api/sessions` | viewer |
| `/api/agents`, `/api/hitl` | operator |
| `/api/research`, `/api/onboarding` | operator |
| `/api/integrations`, `/api/audit` | operator |
| `/api/governance`, `/api/system` | admin |
| `/api/analytics`, `/api/gdpr` | viewer |
