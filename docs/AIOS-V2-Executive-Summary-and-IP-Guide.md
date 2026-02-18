# AIOS V2 — Autonomous Intelligent Operating System (Powered by OpenClaw)

## Executive Summary, Instruction Manual & Intellectual Property Guide

**Prepared for:** DEF1LIVE LLC / HAAIS
**Author:** Shavoni, CEO/CTO
**Date:** February 18, 2026
**Version:** 0.1.0
**Classification:** Confidential — Trade Secret & Pre-Filing IP Documentation

---

# PART I: EXECUTIVE SUMMARY

## What Is AIOS V2?

AIOS V2 is an enterprise-grade **Autonomous Intelligent Operating System** that transforms how organizations deploy, govern, and operate AI agents. Built on the OpenClaw framework, it provides a complete platform for creating domain-specific AI agents that route queries intelligently, enforce governance policies, maintain full audit trails, and require human approval for high-risk decisions.

The platform targets municipal governments, healthcare organizations, and enterprises — any entity that needs AI capabilities with strict compliance, cost controls, and human oversight.

## The Problem

Organizations adopting AI face three critical gaps:

1. **Cost Explosion** — Teams default to expensive models (GPT-4, Claude) for every query, wasting 40-70% of spend on simple tasks that cheaper models handle perfectly.
2. **Governance Vacuum** — Most AI deployments lack guardrails. There's no audit trail, no approval process for sensitive responses, and no way to enforce domain-specific policies.
3. **Deployment Friction** — Standing up AI agents requires weeks of custom development. Every department gets a one-size-fits-all chatbot that knows nothing about their domain.

## The Solution

AIOS V2 solves all three with an integrated platform:

| Problem | AIOS V2 Solution |
|---------|-----------------|
| Cost Explosion | **Intelligent Model Router** — Routes queries to the optimal provider (OpenAI, Anthropic, Gemini, local LLMs) based on complexity, cost, and speed. Target: 40-70% cost savings. |
| Governance Vacuum | **Governance Engine + HITL Approvals** — Intent classification, risk detection, PII redaction, prohibited topic enforcement, multi-tier human approval workflows with SLA monitoring. |
| Deployment Friction | **Onboarding Wizard with Auto-Discovery** — Scrapes an organization's website, discovers departments via LLM analysis, matches to agent templates, and deploys a full agent fleet in minutes. |

## Market Opportunity

- **Municipal AI Market:** 90,000+ local government entities in the US alone. Cleveland partnership (8,000 employees, CGI as integration partner) serves as proof of concept.
- **Enterprise AI Governance:** $4.8B market by 2028. Every Fortune 500 company needs governed AI deployment.
- **Healthcare AI Compliance:** HIPAA-mandated human oversight creates natural demand for HITL workflows.

## Key Metrics

| Metric | Value |
|--------|-------|
| Test Coverage | 567 tests across 59 suites |
| API Endpoints | 90+ RESTful endpoints |
| Database Tables | 30+ with full foreign key relationships |
| Supported LLM Providers | 7 (OpenAI, Anthropic, Gemini, Kimi, Ollama, LM Studio, AnythingLLM) |
| Frontend Pages | 13 full-featured UI pages |
| Lines of Production Code | ~8,000+ |

## Competitive Advantages

1. **Only platform combining auto-discovery onboarding + multi-provider routing + HITL governance** in a single deployment
2. **Deep Research Pipeline** with multi-stage scoring engine — no competitor offers decomposition + retrieval + claim-level scoring + contradiction detection + synthesis
3. **Per-agent knowledge isolation** — RAG indexes are scoped per agent, not shared globally
4. **Full GDPR compliance** built-in from day one (data export, right to erasure, consent management)
5. **Runs anywhere** — cloud, on-prem, or local hardware (RTX 5090 + local LLMs via Ollama)

---

# PART II: INSTRUCTION MANUAL

## 1. System Requirements

### Hardware (Minimum)
- CPU: 4 cores
- RAM: 8 GB (128 GB recommended for local LLM inference)
- Storage: 10 GB
- GPU: Optional (NVIDIA RTX for local model inference via Ollama/LM Studio)

### Software
- Node.js 18.0.0 or higher
- npm 9+
- Git

### Cloud Provider Accounts (at least one)
- OpenAI API key
- Anthropic API key
- Google Gemini API key
- Tavily API key (for Deep Research web search)

## 2. Installation

```bash
# Clone the repository
git clone https://github.com/DEF1LIVE/AIOS-V2-OpenClaw.git
cd AIOS-V2-OpenClaw

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys and configuration
# (see Environment Configuration section below)

# Run the test suite to verify installation
npm test

# Start the server
npm start        # Production
npm run dev      # Development (auto-reload)
```

## 3. Environment Configuration

Edit `.env` in the project root:

```env
# ─── Server ──────────────────────────────────────────────
PORT=3000
NODE_ENV=development

# ─── LLM Providers (configure at least one) ─────────────
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...

# ─── Local LLMs (optional) ──────────────────────────────
OLLAMA_HOST=http://127.0.0.1:11434
LM_STUDIO_HOST=http://127.0.0.1:1234
ANYTHINGLLM_HOST=http://127.0.0.1:3001

# ─── Deep Research ───────────────────────────────────────
TAVILY_API_KEY=tvly-...
RESEARCH_MAX_CONCURRENCY=3

# ─── Database ────────────────────────────────────────────
DB_PATH=data/aios.db

# ─── Authentication ──────────────────────────────────────
JWT_SECRET=your-strong-random-secret-here

# ─── Logging ─────────────────────────────────────────────
LOG_LEVEL=info
```

## 4. First-Time Setup

### Step 1: Start the Server

```bash
npm start
```

The server starts on `http://localhost:3000` (or your configured PORT).

### Step 2: Create Admin Account

Navigate to the login page or use the API:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YourSecurePass123!","email":"admin@org.com","role":"admin"}'
```

### Step 3: Configure LLM Providers

Navigate to **Settings > Models** or use the API:

```bash
curl -X PUT http://localhost:3000/api/system/llm-config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"defaultProvider":"openai","defaultModel":"gpt-4o"}'
```

### Step 4: Deploy Agents

**Option A: Onboarding Wizard (Recommended)**

1. Navigate to the **Onboarding** page
2. Enter your organization name and website URL
3. Click "Discover" — the system scrapes your site and identifies departments
4. Review discovered departments, enable/disable as needed
5. Select a template (Municipal, Enterprise, Nonprofit)
6. Click "Deploy"
7. **New agents appear as "Pending" in the Approvals page**
8. Navigate to **Approvals > Pending Agents** tab
9. Review and approve each agent before it goes active

**Option B: Manual Agent Creation**

1. Navigate to the **Agents** page
2. Click "Create Agent"
3. Fill in name, domain, description, capabilities
4. Submit — the agent is created with **pending** status
5. Navigate to **Approvals > Pending Agents** to approve it

### Step 5: Start Chatting

Once agents are approved and active, navigate to the **Chat** page. The Concierge router automatically directs your queries to the most appropriate specialist agent.

## 5. Core Workflows

### 5.1 Agent Approval Pipeline (HITL)

All new agents — whether created through the UI, API, or onboarding wizard — require human approval before activation:

```
Create Agent → Status: PENDING
     ↓
Appears in Approvals > Pending Agents tab
     ↓
Human Reviewer clicks Approve or Reject
     ↓
Approved → Status: ACTIVE (agent begins handling queries)
Rejected → Status: REJECTED (agent is archived with reason)
```

**Exception:** System agents (Concierge Router) are created as active automatically.

**Bulk Approval:** Use the "Approve All" endpoint or button to approve all pending agents at once.

### 5.2 Deep Research Pipeline

Submit complex research queries that get broken down, researched, scored, and synthesized:

1. **Submit Job:** POST to `/api/research/jobs` with your query
2. **Decomposition:** The query is broken into 3-7 targeted sub-questions
3. **Retrieval:** Sub-questions are searched via RAG (local docs) and Tavily (web)
4. **Scoring:** Sources are scored on domain authority, recency, relevance, and credibility. Claims are extracted with contradiction detection.
5. **Synthesis:** A structured markdown report is generated with citations
6. **Result:** Retrieve the completed report with confidence score

```bash
# Submit a research job
curl -X POST http://localhost:3000/api/research/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"query":"What are the implications of quantum computing on municipal cybersecurity?"}'

# Check job status
curl http://localhost:3000/api/research/jobs/<job-id>

# Get the result
curl http://localhost:3000/api/research/jobs/<job-id>/result
```

### 5.3 Response Approval Workflow

For queries flagged by the governance engine (PII detected, prohibited topics, high-risk domains):

1. Query is classified by the Intent Classifier
2. Risk Detector checks for PII, prohibited topics, guardrail violations
3. Governance Engine determines HITL mode:
   - **INFORM** — Log the query, allow response
   - **SUPERVISE** — Queue for human review before delivery
   - **RESTRICT** — Block the response entirely
4. SUPERVISE/RESTRICT items appear in **Approvals > Response Approvals** tab
5. Reviewer can approve, reject, or provide a modified response
6. SLA timers track response times (Urgent: 1h, High: 4h, Normal: 24h, Low: 72h)

### 5.4 Integration Connectors

Connect AIOS V2 to external systems (webhooks, APIs):

1. Navigate to **Integrations** page
2. Create a new connector (name, type, endpoint URL, auth config)
3. Connector starts as **pending** — requires approval
4. Once approved, the connector is active and can send/receive data
5. Monitor health status and event logs

## 6. API Quick Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh token |
| GET | `/api/auth/status` | Check auth |

### Agents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create agent (pending) |
| PUT | `/api/agents/:id` | Update agent |
| DELETE | `/api/agents/:id` | Delete agent |
| POST | `/api/agents/route` | Route query to best agent |

### Approvals (HITL)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/system/pending-agents` | List pending agents |
| POST | `/api/system/pending-agents/:id/approve` | Approve agent |
| POST | `/api/system/pending-agents/:id/reject` | Reject agent |
| POST | `/api/system/pending-agents/approve-all` | Bulk approve |
| GET | `/api/hitl/approvals` | List response approvals |
| POST | `/api/hitl/approvals/:id/approve` | Approve response |
| POST | `/api/hitl/approvals/:id/reject` | Reject response |

### Research
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/research/jobs` | Submit research job |
| GET | `/api/research/jobs` | List jobs |
| GET | `/api/research/jobs/:id` | Job status |
| GET | `/api/research/jobs/:id/result` | Job result |
| POST | `/api/research/jobs/:id/cancel` | Cancel job |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/system/llm-config` | Get LLM config |
| PUT | `/api/system/llm-config` | Update config |
| POST | `/api/system/backup` | Create backup |
| GET | `/api/system/retention` | Get retention policy |
| POST | `/api/system/retention/purge` | Purge expired data |

## 7. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (SPA)                            │
│  Dashboard │ Chat │ Agents │ Approvals │ Research │ Settings    │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API + WebSocket
┌────────────────────────────┴────────────────────────────────────┐
│                     Express Middleware                            │
│  Auth │ Rate Limit │ Sanitize │ Validate │ Error Handler        │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                    Service Managers                               │
│  AgentManager │ HITLManager │ GovernanceEngine │ Analytics       │
│  ResearchQueue │ AuthService │ RAGPipeline │ OnboardingWizard   │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                    Model Router                                   │
│  OpenAI │ Anthropic │ Gemini │ Kimi │ Ollama │ LM Studio        │
│  Fallback Chain │ Cost Tracking │ Streaming (SSE)                │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│               SQLite Database (sql.js)                            │
│  30+ tables │ Auto-save │ Backup/Restore │ GDPR Compliance      │
└─────────────────────────────────────────────────────────────────┘
```

## 8. Database Tables

| Table | Purpose |
|-------|---------|
| `agents` | Agent definitions, status, approval audit trail |
| `sessions` | Chat sessions |
| `messages` | Message history |
| `approval_requests` | HITL approval queue |
| `query_events` | Per-query analytics (latency, tokens, cost) |
| `audit_events` | Security audit log |
| `policy_rules` | Governance rules |
| `prohibited_topics` | Blocked content topics |
| `governance_versions` | Rule version snapshots |
| `users` | User accounts with RBAC roles |
| `refresh_tokens` | JWT token rotation |
| `user_consents` | GDPR consent tracking |
| `knowledge_documents` | Per-agent document store |
| `web_sources` | Per-agent web source URLs |
| `embeddings` | RAG vector embeddings |
| `research_jobs` | Research job lifecycle |
| `research_results` | Research synthesis reports |
| `research_sources` | Per-job source scores |
| `connectors` | Integration connectors |
| `connector_events` | Connector activity log |
| `onboarding_wizards` | Wizard state machine |
| `agent_templates` | Pre-built agent configs |
| `system_settings` | Key-value system config |
| `canon_documents` | Shared org knowledge |
| `skill_invocations` | Skill execution log |

## 9. Roles & Permissions

| Role | Capabilities |
|------|-------------|
| **admin** | Full access. Create users, manage agents, configure system, approve requests, view audit logs. |
| **operator** | Manage agents, approve HITL requests, view analytics. Cannot create users or modify system config. |
| **viewer** | Read-only access to chat, agents, and dashboards. Cannot modify any data. |

## 10. Troubleshooting

| Issue | Solution |
|-------|---------|
| Agents don't appear in Pending tab | Ensure agents were created without `status: "active"`. All new agents default to `pending` and require approval. |
| Chat returns empty response | Check LLM provider config in Settings > Models. Verify API key is valid. |
| Research job stuck in QUEUED | Check `RESEARCH_MAX_CONCURRENCY` env var. Verify Tavily API key if using web search. |
| Login fails | Verify JWT_SECRET is set in .env. Password must be 8+ characters. |
| Database not persisting | Check `DB_PATH` env var points to a writable directory. |

---

# PART III: INTELLECTUAL PROPERTY GUIDE

## Overview

AIOS V2 / OpenClaw contains multiple patentable inventions and trademarkable assets. This section documents each for IP counsel.

---

## A. PATENT-ELIGIBLE INVENTIONS

### Patent Claim 1: Multi-Stage Research Pipeline with Confidence Scoring

**Title:** System and Method for Automated Multi-Stage Research with Source Credibility Scoring and Contradiction Detection

**Abstract:**
A computer-implemented method for processing complex research queries through a four-stage pipeline: (1) query decomposition using a large language model to generate targeted sub-questions, (2) multi-source evidence retrieval combining local vector-indexed documents with real-time web search, (3) multi-dimensional source and claim scoring using a composite scoring engine that evaluates domain authority, temporal recency, semantic relevance, and publisher credibility with automatic contradiction detection across sources, and (4) synthesis of a structured research report with inline citations, confidence metrics, and contradiction warnings. The system calculates a job-level confidence score aggregating individual source and claim scores and presents contradiction flags when sources provide conflicting evidence.

**Novel Claims:**

1. A method comprising:
   - Receiving a natural language research query
   - Transmitting the query to a language model configured to decompose the query into a plurality of targeted sub-questions (capped at a configurable maximum)
   - For each sub-question, retrieving evidence from both a local vector-indexed document store and an external web search API
   - Scoring each retrieved source on four weighted dimensions: domain authority (25%), temporal recency (20%), semantic relevance (35%), and publisher credibility tier (20%)
   - Classifying each source into one of five credibility tiers: PRIMARY_SOURCE (1.0), AUTHORITATIVE (0.85), SECONDARY (0.65), UNVERIFIED (0.3), FLAGGED (0.0)
   - Using a language model to extract factual claims from the scored sources, identifying which sources support and which contradict each claim
   - Computing a claim-level confidence score based on the number and quality of supporting vs. contradicting sources
   - Computing a job-level composite confidence score aggregating all claim scores with a penalty for detected contradictions
   - Generating a structured report incorporating the scored claims, source citations, confidence metrics, and contradiction warnings

2. The method of claim 1, wherein the query decomposition step:
   - Prepends the original query as the first sub-question
   - Strips numbered prefixes from language model output
   - Deduplicates semantically identical sub-questions
   - Caps the total number of sub-questions at a configurable threshold

3. The method of claim 1, wherein contradiction detection comprises:
   - Identifying pairs of claims where one source supports and another contradicts
   - Setting a boolean contradiction flag on each affected claim
   - Reducing the job-level confidence score proportionally to the number of contradicted claims
   - Including an explicit "hasContradictions" indicator in the final report metadata

4. The method of claim 1, further comprising:
   - Executing each pipeline stage with a configurable timeout
   - Checking for job cancellation between stages
   - Emitting progress events for real-time client notification
   - Enforcing a maximum concurrency limit on simultaneous research jobs

**Prior Art Differentiation:**
- Standard RAG systems perform single-stage retrieval without source scoring
- Existing research tools (Perplexity, Elicit) do not expose composite confidence metrics or claim-level contradiction analysis
- No known system combines decomposition + multi-source retrieval + multi-dimensional scoring + contradiction detection in a single pipeline with configurable weights

**Key Source Files:**
- `src/research/queue-service.js` — Pipeline orchestration
- `src/research/scoring-engine.js` — SourceScorer, ClaimScorer, JobConfidenceCalculator
- `src/research/workers/decomposition.js` — Query decomposition
- `src/research/workers/retrieval.js` — Multi-source retrieval
- `src/research/workers/scoring.js` — Claim extraction and scoring
- `src/research/workers/synthesis.js` — Report generation
- `src/research/manager.js` — Job lifecycle management

---

### Patent Claim 2: Automated Organization Discovery and AI Agent Deployment

**Title:** System and Method for Automated Discovery of Organizational Structure and One-Click Deployment of Domain-Specific AI Agents

**Abstract:**
A computer-implemented method for analyzing an organization's web presence to automatically discover its departmental structure, match discovered departments to pre-built AI agent templates, and deploy a fleet of domain-specific AI agents through a multi-step wizard with human approval gates. The system scrapes the organization's website to identify departments, directors, and capabilities; uses a language model to classify discovered entities into standardized domains; scores template matches based on organizational type and domain coverage; generates a deployment preview with cost estimates; and creates agents in a pending state requiring human approval before activation.

**Novel Claims:**

1. A method comprising:
   - Receiving an organization name and website URL
   - Crawling the website to extract page structure, navigation, and content
   - Identifying organizational departments from the crawled content using pattern matching and language model classification
   - For each discovered department, inferring a standardized domain (HR, Finance, Legal, etc.) and suggested capabilities
   - Scoring each of a plurality of pre-built agent templates against the discovered organizational structure based on: (a) organization type match, (b) domain coverage overlap
   - Generating a deployment preview comprising: agent count, estimated monthly cost, knowledge base sources, governance policies, and items requiring human review
   - Creating an approval checklist for departments with low detection confidence
   - Upon approval, creating a plurality of AI agents in a "pending" state
   - Requiring human review and explicit approval of each agent before transitioning to "active" state
   - Automatically generating a Concierge Router agent that routes queries to the most appropriate specialist

2. The method of claim 1, wherein the wizard supports both:
   - Automated discovery mode (website crawling)
   - Manual entry mode (human types department names directly, no URL required)

3. The method of claim 1, wherein each created agent comprises:
   - A system prompt tailored to the department's domain
   - A capability list inferred from the department name
   - An isolated knowledge base (RAG index) scoped to that agent
   - A pending status requiring human-in-the-loop approval

**Prior Art Differentiation:**
- No known system combines website crawling + LLM-powered department classification + template matching + one-click multi-agent deployment
- Existing onboarding tools require manual configuration of each agent individually
- The approval gate (pending → active) is novel in the context of automated agent deployment

**Key Source Files:**
- `src/onboarding/wizard.js` — Full wizard lifecycle
- `src/onboarding/discovery.js` — Web scraping engine
- `src/onboarding/llm-discovery.js` — LLM-enhanced discovery
- `src/onboarding/routes.js` — Wizard API

---

### Patent Claim 3: Intelligent Multi-Provider Model Routing with Cost Optimization

**Title:** System and Method for Dynamic Routing of Language Model Requests Across Multiple Providers with Automatic Fallback and Cost Tracking

**Abstract:**
A computer-implemented system for intelligently routing language model inference requests across multiple providers (OpenAI, Anthropic, Google Gemini, local models) based on configurable priority, with automatic fallback when a provider fails, real-time cost tracking per provider, and streaming response delivery via Server-Sent Events.

**Novel Claims:**

1. A system comprising:
   - A model router that maintains a registry of language model providers, each with a priority ranking, API credentials, and health status
   - A fallback chain that, upon failure of the primary provider, automatically retries the request on the next-priority provider
   - A cost calculator that tracks token usage (prompt + completion) and estimated USD cost per request, aggregated by provider
   - Support for both streaming (Server-Sent Events) and non-streaming response modes
   - Provider health checks that test connectivity before routing

2. The system of claim 1, wherein providers include both cloud-based (OpenAI, Anthropic, Gemini) and locally-hosted (Ollama, LM Studio) language models, enabling hybrid cloud/on-premises deployment.

**Key Source Files:**
- `src/router/index.js` — ModelRouter
- `src/router/fallback.js` — FallbackRouter
- `src/router/provider.js` — Provider abstraction
- `src/services/providers/` — Provider implementations

---

### Patent Claim 4: Governance Engine with Embedding-Enhanced Intent Classification and Multi-Tier Human Approval

**Title:** System and Method for AI Governance Combining Semantic Intent Classification, Risk Detection, and Priority-Based Human Approval with SLA Monitoring

**Abstract:**
A computer-implemented governance system for AI applications that: (1) classifies the intent and domain of user queries using both keyword-based and embedding-based semantic analysis, (2) detects risks including PII, prohibited topics, and guardrail violations, (3) determines a human-in-the-loop (HITL) mode (INFORM, SUPERVISE, or RESTRICT) based on dynamic policy rules, (4) queues flagged queries for human review with priority-based SLA timers (Urgent 1h, High 4h, Normal 24h, Low 72h), and (5) supports batch approval operations with modified response capability and full audit trails.

**Novel Claims:**

1. A method comprising:
   - Classifying a user query using a multi-layer intent classifier that combines keyword matching with embedding-based semantic similarity
   - Detecting risk signals including PII patterns (SSN, credit card, email, phone), prohibited topics, and agent-specific guardrail violations
   - Evaluating the classified intent and detected risks against a set of dynamic, versioned policy rules to determine a HITL mode
   - For SUPERVISE mode: queuing the query with a priority level and starting an SLA timer
   - For RESTRICT mode: blocking the response and logging the event
   - Tracking SLA compliance (breach, warning, ok) based on elapsed time since creation vs. priority-based time limit
   - Providing batch approval and rejection operations for queue management efficiency
   - Allowing human reviewers to provide modified responses that replace the AI-generated output
   - Maintaining a complete audit trail of all governance decisions, approvals, and rejections

**Key Source Files:**
- `src/governance/index.js` — GovernanceEngine
- `src/governance/classifier.js` — IntentClassifier
- `src/governance/embedding-classifier.js` — EmbeddingClassifier
- `src/governance/risk-detector.js` — RiskDetector
- `src/hitl/manager.js` — HITLManager
- `src/hitl/routes.js` — Approval API

---

### Patent Claim 5: Agent Lifecycle with Human-In-The-Loop Approval Gate

**Title:** Method for Managing AI Agent Lifecycle with Mandatory Human Approval Before Activation

**Abstract:**
A method for managing the lifecycle of AI agents in a multi-agent system wherein all newly created agents — whether created manually, through an API, or through an automated onboarding wizard — are assigned a "pending" status and must receive explicit human approval before transitioning to "active" status and participating in query routing. The method includes an audit trail capturing who approved or rejected each agent and when, with optional rejection reasons.

**Novel Claims:**

1. A method comprising:
   - Creating an AI agent with a default status of "pending"
   - Storing the agent in a database with fields for: approved_by, approved_at, and rejection_reason
   - Presenting the pending agent in a human review interface
   - Upon human approval: transitioning the agent to "active" status, recording the approver identity and timestamp
   - Upon human rejection: transitioning the agent to "rejected" status, recording the rejector identity and reason
   - Excluding pending and rejected agents from the active query routing pool
   - Providing a bulk approval operation for efficiency
   - Exception: system-level router agents bypass the approval gate

**Key Source Files:**
- `src/agents/manager.js` — approveAgent(), rejectAgent(), getPendingAgents()
- `src/agents/routes.js` — Forces pending status on creation
- `src/system/routes.js` — Pending agent approval endpoints
- `public/js/pages/approvals.js` — Approval UI

---

## B. TRADEMARK CANDIDATES

### Primary Marks

| Mark | Type | Class | Description |
|------|------|-------|-------------|
| **AIOS** | Word Mark | IC 009, 042 | Autonomous Intelligent Operating System — the platform name |
| **AIOS V2** | Word Mark | IC 009, 042 | Current version designation |
| **OpenClaw** | Word Mark | IC 009, 042 | The underlying framework name |
| **DEF1LIVE** | Word Mark | IC 042 | Company/brand name |
| **HAAIS** | Word Mark | IC 042 | Parent organization |

### Feature-Level Marks (Secondary)

| Mark | Description |
|------|-------------|
| **Deep Research Pipeline** | The 4-stage research system |
| **OpenClaw Governance Engine** | The policy + HITL system |
| **Intelligent Model Router** | The multi-provider routing system |

### Trademark Classes

- **International Class 009:** Computer software; downloadable software for artificial intelligence, machine learning, and natural language processing
- **International Class 042:** Software as a service (SaaS); platform as a service (PaaS); computer software design and development services; AI consulting

### Filing Recommendations

1. **Priority Filing:** File "AIOS" and "OpenClaw" first — these are the core brand identifiers
2. **Search First:** Conduct a trademark search for "AIOS" and "OpenClaw" before filing to check for conflicts
3. **Specimen:** Use screenshots of the platform UI showing the marks in commerce
4. **Basis:** Use-in-commerce (if already deployed) or intent-to-use (if pre-launch)
5. **Geographic:** Start with USPTO (US), then consider Madrid Protocol for international

---

## C. TRADE SECRET PROTECTIONS

The following constitute trade secrets that should NOT be disclosed in patent filings:

1. **Scoring Engine Weights** — The specific weights (domain authority 25%, recency 20%, relevance 35%, credibility 20%) used in composite source scoring
2. **Credibility Tier Mappings** — The specific numerical values assigned to each credibility tier (PRIMARY_SOURCE=1.0, AUTHORITATIVE=0.85, etc.)
3. **SLA Timer Configurations** — The specific time limits per priority level
4. **LLM Prompt Templates** — The exact system prompts used for decomposition, claim extraction, and synthesis
5. **Cost Calculation Formulas** — The per-token cost rates and routing optimization logic
6. **Concierge Routing Algorithm** — The specific scoring formula for agent selection (intent weight, domain weight, capability weight, description overlap)

**Recommendation:** File patents on the methods and systems (what they do), keep the specific parameters and formulas as trade secrets (how they do it).

---

## D. COPYRIGHT PROTECTIONS

The following are automatically protected by copyright:

1. **Source Code** — All files in `src/`, `public/`, `tests/`
2. **Database Schema** — The 30+ table definitions in `src/db/schema.js`
3. **UI Design** — The frontend pages, component library, and CSS
4. **Documentation** — All markdown files, README, this document
5. **Test Suite** — The 567 test cases constitute a creative work

**Recommendation:** Add copyright notices to key files:
```
// Copyright (c) 2026 DEF1LIVE LLC. All rights reserved.
```

Register with the US Copyright Office for statutory damages eligibility.

---

## E. FILING TIMELINE RECOMMENDATIONS

| Priority | Action | Deadline | Est. Cost |
|----------|--------|----------|-----------|
| 1 | Trademark search for "AIOS" and "OpenClaw" | Immediate | $500-1,000 |
| 2 | File trademark applications (AIOS, OpenClaw) | Within 30 days | $250-350/class |
| 3 | File provisional patent (Research Pipeline) | Within 60 days | $1,500-3,000 |
| 4 | File provisional patent (Onboarding Wizard) | Within 60 days | $1,500-3,000 |
| 5 | File provisional patent (Model Router) | Within 90 days | $1,500-3,000 |
| 6 | File provisional patent (Governance Engine) | Within 90 days | $1,500-3,000 |
| 7 | File provisional patent (Agent Lifecycle/HITL) | Within 90 days | $1,500-3,000 |
| 8 | Copyright registration (software) | Within 6 months | $65 |
| 9 | Convert provisionals to full utility patents | Within 12 months | $8,000-15,000/each |

**Note:** Provisional patents provide 12 months of "patent pending" status at lower cost. They must be converted to full utility patents before the 12-month deadline or the filing date is lost.

---

## F. DEFENSIVE CONSIDERATIONS

1. **Public Disclosure:** Any public demo, GitHub push (if public), or conference presentation starts the 1-year clock for US patent filing. File provisionals BEFORE public disclosure if possible.

2. **Open Source Risk:** The project currently uses MIT license. If patent protection is desired, consider switching to a more protective license (Apache 2.0 with patent grant, or proprietary) before public release.

3. **Employee/Contractor IP:** Ensure all contributors have signed IP assignment agreements assigning their work to DEF1LIVE LLC.

4. **Prior Art Documentation:** This document, the git history, and the test suite serve as evidence of invention dates. Maintain git logs as proof of conception.

---

# APPENDIX: COMPLETE FEATURE MAP

```
AIOS V2 / OpenClaw
│
├── Authentication & Authorization
│   ├── JWT token auth with refresh rotation
│   ├── API key support (legacy)
│   ├── RBAC: admin / operator / viewer
│   ├── Rate limiting (100 req/min, 10 auth/15min)
│   └── WebSocket authentication
│
├── Agent Management
│   ├── Create / Read / Update / Delete agents
│   ├── Pending → Approved → Active lifecycle (HITL gate)
│   ├── Per-agent knowledge documents (10 file types)
│   ├── Per-agent web sources with auto-refresh
│   ├── Agent templates (Municipal, Enterprise, Nonprofit)
│   ├── Concierge Router (auto-generated)
│   └── Intelligent query routing (classifier + keyword + embedding)
│
├── Chat & Conversation
│   ├── Real-time streaming (SSE + WebSocket)
│   ├── Session management with metadata
│   ├── 200-message history retrieval
│   ├── Context window building (8000 token limit)
│   └── User preference storage
│
├── Deep Research Pipeline
│   ├── Query decomposition (LLM-powered)
│   ├── Multi-source retrieval (RAG + Tavily web search)
│   ├── Source scoring (domain authority, recency, relevance, credibility)
│   ├── Claim extraction with contradiction detection
│   ├── Composite confidence calculation
│   ├── Structured synthesis with citations
│   ├── Concurrency control (configurable max jobs)
│   ├── Job cancellation between stages
│   └── TTL-based job expiration
│
├── Governance & Policy
│   ├── Intent classification (keyword + embedding)
│   ├── Risk detection (PII, prohibited topics, guardrails)
│   ├── HITL modes (INFORM / SUPERVISE / RESTRICT)
│   ├── Dynamic policy rules (CRUD + versioning)
│   └── Prohibited topic management (global + per-agent)
│
├── HITL Approval System
│   ├── Response approval queue with priority
│   ├── Agent approval queue (pending → active)
│   ├── SLA monitoring (Urgent 1h, High 4h, Normal 24h, Low 72h)
│   ├── Batch approve / reject
│   ├── Modified response capability
│   └── Full reviewer audit trail
│
├── Model Router
│   ├── 7 providers (OpenAI, Anthropic, Gemini, Kimi, Ollama, LM Studio, AnythingLLM)
│   ├── Priority-based fallback chain
│   ├── Cost tracking per provider
│   ├── Streaming + non-streaming modes
│   └── Provider health checks
│
├── RAG (Retrieval-Augmented Generation)
│   ├── Document chunking with overlap
│   ├── Embedding generation (OpenAI / local)
│   ├── Vector similarity search
│   ├── Per-agent index isolation
│   └── Canon (shared org documents)
│
├── Analytics & Reporting
│   ├── Query metrics (latency, tokens, cost)
│   ├── Per-agent / per-department breakdowns
│   ├── Hourly distribution analysis
│   ├── CSV / JSON export
│   └── 7-30 day aggregation windows
│
├── Audit Logging
│   ├── Action tracking with severity
│   ├── PII detection logging
│   ├── Review workflow
│   └── Compliance-ready output
│
├── GDPR Compliance
│   ├── Full data export (JSON)
│   ├── Right to erasure (cascade delete)
│   ├── Consent management (grant / revoke)
│   ├── Data retention policies (configurable TTL)
│   └── Privacy notice endpoint
│
├── Onboarding Wizard
│   ├── Website discovery (scraping + LLM)
│   ├── Manual entry mode
│   ├── Template matching with confidence scoring
│   ├── Department customization (bulk ops)
│   ├── Deployment preview with cost estimates
│   └── Approval gate before agent activation
│
├── Integration Framework
│   ├── Connector CRUD (webhook, API)
│   ├── Approval workflow (pending → active)
│   ├── Health monitoring
│   ├── Event logging
│   └── Auth config redaction
│
├── System Administration
│   ├── LLM provider management
│   ├── Branding customization (logo, colors)
│   ├── Database backup / restore
│   ├── Data retention purge
│   └── Usage statistics
│
├── Skills Framework
│   ├── Skill discovery and loading
│   ├── YAML frontmatter metadata
│   ├── Script execution (subprocess)
│   └── Registry management
│
└── Frontend (SPA)
    ├── 13 pages (Dashboard, Chat, Agents, Approvals, etc.)
    ├── Component library (cards, charts, modals, tabs, toasts)
    ├── Dark / light theme with CSS custom properties
    ├── Accessibility (WCAG 2.1 compliance tested)
    ├── Client-side routing
    └── Global state management
```

---

**END OF DOCUMENT**

*This document is confidential and constitutes trade secret material of DEF1LIVE LLC. Do not distribute outside of legal counsel and authorized personnel.*
