# AIOS V2 Development Guide

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Git

### Setup
```bash
git clone <repo-url>
cd AIOS-V2-OpenClaw
npm install
cp .env.example .env
# Edit .env with your API keys
```

### Running
```bash
npm start          # Production (node server.js)
npm run dev        # Development (nodemon, auto-reload)
npm test           # Run all 567 tests
npm test -- --watch  # Watch mode
npm run lint       # ESLint
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment |
| `DB_PATH` | No | data/aios.db | SQLite file path |
| `JWT_SECRET` | Yes | random | JWT signing key (set this!) |
| `OPENAI_API_KEY` | At least 1 provider | - | OpenAI key |
| `ANTHROPIC_API_KEY` | At least 1 provider | - | Anthropic key |
| `GEMINI_API_KEY` | No | - | Google Gemini key |
| `OLLAMA_HOST` | No | - | Local Ollama URL |
| `LM_STUDIO_HOST` | No | - | Local LM Studio URL |
| `TAVILY_API_KEY` | For research | - | Tavily web search key |
| `RESEARCH_MAX_CONCURRENCY` | No | 3 | Max concurrent research jobs |
| `LOG_LEVEL` | No | info | Logging level |

---

## Project Structure

```
AIOS-V2-OpenClaw/
├── server.js               # Entry point
├── src/                    # All source code (see 01-ARCHITECTURE.md)
├── public/                 # Frontend SPA
│   ├── index.html          # Main shell
│   ├── auth.html           # Login page
│   ├── css/                # Stylesheets
│   └── js/
│       ├── main.js         # App initialization
│       ├── app.js          # App shell
│       ├── router.js       # Client-side router
│       ├── state.js        # Global state
│       ├── pages/          # Page components (13 pages)
│       ├── components/     # Shared UI components
│       ├── lib/            # API client, socket client
│       └── utils.js        # Utility functions
├── tests/                  # Test suite (59 files, 567 tests)
│   ├── fixtures/           # Shared test helpers
│   │   ├── test-db.js      # createTestDb() — shared DB setup
│   │   └── research-mocks.js  # createMockRouter(), createMockManager(), etc.
│   ├── agents/             # Agent manager tests
│   ├── analytics/          # Analytics tests
│   ├── audit/              # Audit tests
│   ├── auth/               # Auth service tests
│   ├── chat/               # Chat + socket tests
│   ├── db/                 # Schema, backup, retention tests
│   ├── frontend/           # UI component tests
│   ├── gdpr/               # GDPR compliance tests
│   ├── governance/         # Governance engine tests
│   ├── hitl/               # HITL manager tests
│   ├── integration/        # Connector tests
│   ├── memory/             # Memory store + context tests
│   ├── middleware/          # Auth, sanitize, route protection tests
│   ├── rag/                # RAG pipeline tests
│   ├── research/           # Research pipeline tests (90 tests)
│   ├── router/             # Model router tests
│   ├── skills/             # Skill parser/registry tests
│   └── system/             # System services tests
├── docs/                   # This documentation
├── data/                   # SQLite database (gitignored)
└── .openclaw/              # OpenClaw config
    └── openclaw.json       # Provider configuration
```

---

## Coding Conventions

### General Rules
- **CommonJS modules** — Use `require()` / `module.exports`, not ES imports
- **No TypeScript** — Plain JavaScript with JSDoc comments where helpful
- **Express route pattern** — Routes → Services → DB (never DB access in routes)
- **Dependency injection** — All services receive `db` and `saveFn` in constructor
- **Column allowlist** — All `UPDATE` queries use a `ALLOWED_COLUMNS` Set to prevent SQL injection via dynamic column names

### Naming
- Files: `kebab-case.js` (e.g., `queue-service.js`)
- Classes: `PascalCase` (e.g., `ResearchQueueService`)
- Functions: `camelCase` (e.g., `submitJob`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `CREDIBILITY_TIERS`)
- DB columns: `snake_case` (e.g., `created_at`)
- API responses: `snake_case` for DB fields, `camelCase` for computed fields

### Error Handling
- Routes use `asyncHandler()` wrapper to forward errors to Express error handler
- Services throw errors that routes catch
- Non-critical failures (analytics, audit) are silently caught to prevent breaking the main flow

### Database Access
- Use parameterized queries (`?` placeholders) always
- Call `saveFn()` after every write operation
- Parse JSON fields on read (capabilities, guardrails, metadata, etc.)
- Never use string interpolation in SQL

---

## Testing

### Framework
- **Jest** with `--experimental-vm-modules` for ESM compatibility
- Config: `jest.config.js`
- Transform: `jest-esm-transform.js`

### Shared Fixtures

**`tests/fixtures/test-db.js`**
```javascript
const { createTestDb } = require("../fixtures/test-db");

// Returns a fresh in-memory SQLite DB with full schema
const db = await createTestDb();
```

**`tests/fixtures/research-mocks.js`**
```javascript
const { createMockRouter, createMockManager, createMockEventBus, createMockRag } = require("../fixtures/research-mocks");

const mockRouter = createMockRouter();     // Mock LLM router
const mockManager = createMockManager();   // Mock research job manager
const mockEventBus = createMockEventBus(); // Mock event emitter
```

### Writing Tests

Follow TDD: Red → Green → Refactor.

```javascript
// tests/feature/my-service.test.js
const { createTestDb } = require("../fixtures/test-db");
const { MyService } = require("../../src/feature/my-service");

describe("MyService", () => {
  let db, service;

  beforeAll(async () => {
    db = await createTestDb();
    service = new MyService(db, jest.fn());
  });

  afterAll(() => { if (db) db.close(); });

  test("does the thing", () => {
    const result = service.doThing("input");
    expect(result).toBeTruthy();
  });
});
```

### Running Tests
```bash
npm test                              # All tests
npx jest tests/agents/               # One directory
npx jest tests/agents/manager.test.js  # One file
npx jest --watch                      # Watch mode
npx jest --verbose                    # Detailed output
```

### Test Coverage by Module

| Module | Tests | Key File |
|--------|-------|----------|
| Research Pipeline | 90 | tests/research/ |
| Auth & Security | 72 | tests/auth/, tests/middleware/ |
| Frontend & A11y | 66+38 | tests/frontend/, tests/accessibility/ |
| Governance | 52 | tests/governance/ |
| RAG | 48 | tests/rag/ |
| Core Systems | 61 | tests/agents/, tests/system/ |
| GDPR | 36 | tests/gdpr/ |
| Database | 32 | tests/db/ |

---

## Adding a New Feature

### 1. Create the Service

```
src/my-feature/
├── service.js       # Business logic
└── routes.js        # Express routes
```

Service pattern:
```javascript
class MyFeatureService {
  constructor(db, saveFn) {
    this.db = db;
    this.saveFn = saveFn;
  }

  doSomething(input) {
    // Business logic + DB operations
    this.db.run("INSERT INTO ...", [...]);
    if (this.saveFn) this.saveFn();
    return result;
  }
}
module.exports = { MyFeatureService };
```

### 2. Create Routes

```javascript
const express = require("express");
const { asyncHandler } = require("../middleware/async-handler");

function createMyFeatureRoutes(service) {
  const router = express.Router();

  router.get("/", asyncHandler(async (req, res) => {
    res.json(service.listThings());
  }));

  router.post("/", asyncHandler(async (req, res) => {
    const result = service.createThing(req.body);
    res.status(201).json(result);
  }));

  return router;
}
module.exports = { createMyFeatureRoutes };
```

### 3. Register in index.js

In `src/index.js`:
```javascript
const { MyFeatureService } = require("./my-feature/service");
const { createMyFeatureRoutes } = require("./my-feature/routes");

// In the init function:
const myFeature = new MyFeatureService(db, markDirty);
app.use("/api/my-feature", authRequired("operator"), createMyFeatureRoutes(myFeature));
```

### 4. Add Schema (if needed)

In `src/db/schema.js`, add your CREATE TABLE to the SCHEMA array.

### 5. Write Tests

```
tests/my-feature/
└── service.test.js
```

### 6. Update Docs

Add your endpoints to `docs/02-API-REFERENCE.md` and your tables to `docs/03-DATABASE-SCHEMA.md`.

---

## Key Design Patterns

### asyncHandler
Wraps async route handlers to forward errors to Express:
```javascript
const { asyncHandler } = require("../middleware/async-handler");
router.get("/", asyncHandler(async (req, res) => { ... }));
```

### BaseWorker (Research Pipeline)
Shared base class with timeout and JSON parsing:
```javascript
const { BaseWorker } = require("./base-worker");
class MyWorker extends BaseWorker {
  async execute(input) {
    const result = await this.withTimeout(
      this.router.chatCompletion({ messages }),
      "MyWorker LLM call"
    );
    const parsed = this.safeJsonParse(result.content, []);
    return parsed;
  }
}
```

### Column Allowlist
All UPDATE operations use allowlists to prevent SQL injection:
```javascript
const ALLOWED_COLUMNS = new Set(["name", "status", "description"]);
for (const [key, val] of Object.entries(updates)) {
  if (!ALLOWED_COLUMNS.has(key)) continue;
  fields.push(`${key} = ?`);
  values.push(val);
}
```

### Redaction
Sensitive auth config is redacted before returning to clients:
```javascript
const { redactAuthConfig } = require("../utils/redaction");
const safe = redactAuthConfig(connector.auth_config);
// { apiKey: "sk-p****7890" }
```

---

## Git Workflow

- **master** — Production-ready code
- **feature/*** — Feature branches (create from master)
- **refactor/*** — Cleanup branches
- **backup/*** — Point-in-time backups

### Branch Protection
A git hook prevents direct writes to `master`. Always work on a feature branch and merge via PR or merge command.

### Commit Message Style
```
feat: add Deep Research Pipeline with TDD — 140 tests, 17 new files
fix: resolve manual entry URL requirement in onboarding
refactor: DRY simplification — asyncHandler, BaseWorker, shared fixtures
docs: update knowledge files with architecture references
```

---

## Deployment Checklist

- [ ] `JWT_SECRET` set to a strong random value (not the default)
- [ ] At least one LLM provider configured
- [ ] `DB_PATH` points to a persistent, writable directory
- [ ] `TAVILY_API_KEY` set (if using Deep Research web search)
- [ ] First admin account created
- [ ] Backup schedule configured
- [ ] Retention policies set
- [ ] CORS configured for your domain (if needed)
- [ ] HTTPS configured via reverse proxy (nginx, Caddy, etc.)
- [ ] Rate limits reviewed for production load
