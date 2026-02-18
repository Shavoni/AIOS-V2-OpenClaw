# AIOS V2 Database Schema Reference

**Engine:** SQLite via sql.js (in-memory with file persistence)
**Schema file:** `src/db/schema.js`
**Foreign keys:** Enabled (`PRAGMA foreign_keys = ON`)

---

## Core Chat

### sessions
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| title | TEXT NOT NULL | 'New Chat' | |
| profile | TEXT NOT NULL | 'main' | |
| user_id | TEXT | | |
| department | TEXT | | |
| created_at | TEXT NOT NULL | datetime('now') | ISO 8601 |
| updated_at | TEXT NOT NULL | datetime('now') | |

### messages
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | INTEGER PK | AUTOINCREMENT | |
| session_id | TEXT NOT NULL | | FK → sessions(id) ON DELETE CASCADE |
| role | TEXT NOT NULL | | CHECK: user, assistant, system |
| content | TEXT NOT NULL | | |
| metadata | TEXT | '{}' | JSON |
| created_at | TEXT NOT NULL | datetime('now') | |

**Index:** `idx_messages_session` ON (session_id, created_at)

---

## Agent Management

### agents
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| name | TEXT NOT NULL | | |
| title | TEXT | '' | |
| domain | TEXT | 'General' | |
| description | TEXT | '' | |
| system_prompt | TEXT | '' | |
| capabilities | TEXT | '[]' | JSON array of strings |
| guardrails | TEXT | '[]' | JSON array of strings |
| status | TEXT NOT NULL | 'active' | pending, active, disabled, rejected |
| is_router | INTEGER | 0 | Boolean: 1 = Concierge router |
| escalates_to | TEXT | | Agent ID to escalate to |
| approved_by | TEXT | | Reviewer who approved/rejected |
| approved_at | TEXT | | ISO timestamp of approval |
| rejection_reason | TEXT | | Reason for rejection |
| created_at | TEXT NOT NULL | datetime('now') | |
| updated_at | TEXT NOT NULL | datetime('now') | |

### knowledge_documents
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| agent_id | TEXT NOT NULL | | FK → agents(id) ON DELETE CASCADE |
| filename | TEXT NOT NULL | | |
| file_type | TEXT | '' | txt, md, pdf, json, csv, html, xml, yaml, yml |
| file_size | INTEGER | 0 | Bytes |
| chunk_count | INTEGER | 0 | |
| uploaded_at | TEXT NOT NULL | datetime('now') | |
| metadata | TEXT | '{}' | JSON |

### web_sources
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| agent_id | TEXT NOT NULL | | FK → agents(id) ON DELETE CASCADE |
| url | TEXT NOT NULL | | |
| name | TEXT | '' | |
| description | TEXT | '' | |
| refresh_interval_hours | INTEGER | 24 | |
| last_refreshed | TEXT | | ISO timestamp |
| chunk_count | INTEGER | 0 | |
| auto_refresh | INTEGER | 1 | Boolean |
| created_at | TEXT NOT NULL | datetime('now') | |

### agent_templates
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | |
| name | TEXT NOT NULL | | |
| description | TEXT | '' | |
| config | TEXT NOT NULL | '{}' | JSON with agent definitions |
| category | TEXT | 'general' | municipal, enterprise, nonprofit |
| is_builtin | INTEGER | 0 | Boolean |
| created_at | TEXT NOT NULL | datetime('now') | |

---

## HITL Approvals

### approval_requests
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| status | TEXT NOT NULL | 'pending' | pending, approved, rejected |
| hitl_mode | TEXT NOT NULL | | INFORM, DRAFT, ESCALATE |
| priority | TEXT | 'medium' | urgent, high, normal, low |
| user_id | TEXT | | |
| user_department | TEXT | | |
| agent_id | TEXT | | |
| agent_name | TEXT | | |
| original_query | TEXT NOT NULL | | |
| proposed_response | TEXT | | |
| risk_signals | TEXT | '[]' | JSON array |
| guardrails_triggered | TEXT | '[]' | JSON array |
| escalation_reason | TEXT | | |
| resolved_at | TEXT | | ISO timestamp |
| resolved_by | TEXT | | Reviewer ID |
| reviewer_notes | TEXT | | |
| created_at | TEXT NOT NULL | datetime('now') | |

**Index:** `idx_approval_status` ON (status, created_at)

---

## Analytics & Audit

### query_events
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| timestamp | TEXT NOT NULL | datetime('now') | |
| user_id | TEXT | | |
| department | TEXT | | |
| agent_id | TEXT | | |
| agent_name | TEXT | | |
| query_text | TEXT | | |
| response_text | TEXT | | |
| latency_ms | INTEGER | 0 | |
| tokens_in | INTEGER | 0 | |
| tokens_out | INTEGER | 0 | |
| cost_usd | REAL | 0 | |
| hitl_mode | TEXT | 'INFORM' | |
| was_escalated | INTEGER | 0 | Boolean |
| was_approved | INTEGER | 0 | Boolean |
| guardrails_triggered | TEXT | '[]' | JSON array |
| success | INTEGER | 1 | Boolean |
| error_message | TEXT | | |
| session_id | TEXT | | |

**Index:** `idx_query_events_ts` ON (timestamp)

### audit_events
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| timestamp | TEXT NOT NULL | datetime('now') | |
| event_type | TEXT NOT NULL | | e.g., escalation, data_export |
| severity | TEXT NOT NULL | 'info' | info, warning, error, critical |
| user_id | TEXT | | |
| user_department | TEXT | | |
| agent_id | TEXT | | |
| agent_name | TEXT | | |
| action | TEXT NOT NULL | | |
| details | TEXT | '{}' | JSON |
| pii_detected | TEXT | '[]' | JSON array |
| guardrails_triggered | TEXT | '[]' | JSON array |
| requires_review | INTEGER | 0 | Boolean |
| reviewed_by | TEXT | | |

**Indexes:** `idx_audit_events_ts` ON (timestamp), `idx_audit_events_type` ON (event_type, severity)

### audit_log (legacy)
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | INTEGER PK | AUTOINCREMENT | |
| session_id | TEXT | | |
| action | TEXT NOT NULL | | |
| intent_domain | TEXT | | |
| risk_signals | TEXT | | |
| hitl_mode | TEXT | | |
| provider | TEXT | | |
| model | TEXT | | |
| created_at | TEXT NOT NULL | datetime('now') | |

---

## Governance

### policy_rules
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| name | TEXT NOT NULL | | |
| description | TEXT | '' | |
| tier | TEXT | 'standard' | |
| conditions | TEXT | '{}' | JSON |
| hitl_mode | TEXT | 'INFORM' | INFORM, DRAFT, ESCALATE |
| local_only | INTEGER | 0 | Boolean |
| approval_required | INTEGER | 0 | Boolean |
| escalation_reason | TEXT | | |
| priority | INTEGER | 50 | |
| is_immutable | INTEGER | 0 | Boolean (cannot delete) |
| created_at | TEXT NOT NULL | datetime('now') | |

### prohibited_topics
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| topic | TEXT NOT NULL | | |
| scope | TEXT | 'global' | global, agent, department |
| scope_id | TEXT | | Agent or department ID |
| created_at | TEXT NOT NULL | datetime('now') | |

### governance_versions
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| description | TEXT | '' | |
| rules_snapshot | TEXT NOT NULL | | JSON snapshot of all rules |
| changed_by | TEXT | | |
| created_at | TEXT NOT NULL | datetime('now') | |

---

## Authentication

### users
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| username | TEXT NOT NULL UNIQUE | | |
| email | TEXT UNIQUE | | |
| password_hash | TEXT NOT NULL | | bcrypt, 10 rounds |
| role | TEXT NOT NULL | 'viewer' | admin, operator, viewer |
| display_name | TEXT | '' | |
| department | TEXT | '' | |
| is_active | INTEGER | 1 | Boolean |
| last_login | TEXT | | ISO timestamp |
| created_at | TEXT NOT NULL | datetime('now') | |
| updated_at | TEXT NOT NULL | datetime('now') | |

**Index:** `idx_users_username` ON (username)

### refresh_tokens
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| user_id | TEXT NOT NULL | | FK → users(id) ON DELETE CASCADE |
| token_hash | TEXT NOT NULL | | SHA256 hash (not plaintext) |
| expires_at | TEXT NOT NULL | | ISO timestamp |
| created_at | TEXT NOT NULL | datetime('now') | |

**Index:** `idx_refresh_tokens_user` ON (user_id)

---

## GDPR

### user_consents
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| user_id | TEXT NOT NULL | | FK → users(id) ON DELETE CASCADE |
| consent_type | TEXT NOT NULL | | analytics, marketing, etc. |
| granted | INTEGER | 1 | Boolean |
| granted_at | TEXT NOT NULL | datetime('now') | |
| revoked_at | TEXT | | ISO timestamp |

**Index:** `idx_user_consents_user` ON (user_id)

---

## RAG & Embeddings

### embeddings
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | INTEGER PK | AUTOINCREMENT | |
| agent_id | TEXT NOT NULL | | |
| document_id | TEXT NOT NULL | | |
| chunk_index | INTEGER | 0 | |
| embedding | BLOB NOT NULL | | Float32Array as binary |
| text_preview | TEXT | '' | |
| created_at | TEXT NOT NULL | datetime('now') | |

**Indexes:** `idx_embeddings_agent` ON (agent_id), `idx_embeddings_document` ON (document_id)

---

## Onboarding

### onboarding_wizards
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | Short UUID (8 chars) |
| organization_name | TEXT NOT NULL | | |
| website_url | TEXT NOT NULL | | |
| organization_type | TEXT | 'municipal' | |
| step | TEXT | 'init' | init, discovery, analysis, template_match, customization, preview, deployment, complete, error |
| progress | REAL | 0 | 0-100 |
| discovery_result | TEXT | '{}' | JSON |
| departments | TEXT | '[]' | JSON array |
| template_matches | TEXT | '[]' | JSON array |
| selected_template | TEXT | | |
| preview | TEXT | | JSON |
| deployment_id | TEXT | | |
| deployment_status | TEXT | | |
| deployment_errors | TEXT | '[]' | JSON array |
| requires_approval | INTEGER | 0 | Boolean |
| approval_checklist | TEXT | '[]' | JSON array |
| created_at | TEXT NOT NULL | datetime('now') | |
| updated_at | TEXT NOT NULL | datetime('now') | |
| completed_at | TEXT | | ISO timestamp |

---

## Integrations

### connectors
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| name | TEXT NOT NULL | | |
| type | TEXT NOT NULL | 'webhook' | webhook, api, webhook_in |
| config | TEXT | '{}' | JSON |
| status | TEXT NOT NULL | 'pending' | pending, approved, suspended |
| agent_id | TEXT | | FK → agents(id) ON DELETE SET NULL |
| description | TEXT | '' | |
| auth_type | TEXT | 'none' | none, basic, oauth, key |
| auth_config | TEXT | '{}' | JSON (redacted on read) |
| health_status | TEXT | 'unknown' | |
| last_health_check | TEXT | | ISO timestamp |
| created_by | TEXT | | |
| approved_by | TEXT | | |
| approved_at | TEXT | | ISO timestamp |
| created_at | TEXT NOT NULL | datetime('now') | |
| updated_at | TEXT NOT NULL | datetime('now') | |

**Index:** `idx_connectors_status` ON (status)

### connector_events
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | INTEGER PK | AUTOINCREMENT | |
| connector_id | TEXT NOT NULL | | FK → connectors(id) ON DELETE CASCADE |
| event_type | TEXT NOT NULL | | |
| details | TEXT | '{}' | JSON |
| created_at | TEXT NOT NULL | datetime('now') | |

**Index:** `idx_connector_events_connector` ON (connector_id)

---

## Deep Research

### research_jobs
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| user_id | TEXT | | |
| query | TEXT NOT NULL | | |
| query_decomposition | TEXT | '[]' | JSON array of sub-questions |
| status | TEXT NOT NULL | 'QUEUED' | QUEUED, PROCESSING, COMPLETED, FAILED, CANCELLED, EXPIRED |
| current_stage | TEXT | | decomposition, retrieval, scoring, synthesis |
| stage_progress | REAL | 0 | 0-1.0 |
| result_id | TEXT | | FK to research_results |
| confidence_score | REAL | 0 | 0-1.0 |
| source_count | INTEGER | 0 | |
| has_contradictions | INTEGER | 0 | Boolean |
| ttl | INTEGER | 86400 | Seconds until expiry |
| error_message | TEXT | | |
| retry_count | INTEGER | 0 | |
| metadata | TEXT | '{}' | JSON |
| created_at | TEXT NOT NULL | datetime('now') | |
| updated_at | TEXT NOT NULL | datetime('now') | |
| completed_at | TEXT | | ISO timestamp |
| expires_at | TEXT | | ISO timestamp |

**Indexes:** `idx_research_jobs_status` ON (status, created_at), `idx_research_jobs_user` ON (user_id)

### research_results
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| job_id | TEXT NOT NULL | | FK → research_jobs(id) ON DELETE CASCADE |
| synthesis | TEXT | '' | Markdown report |
| sources | TEXT | '[]' | JSON array |
| claims | TEXT | '[]' | JSON array |
| evidence_set | TEXT | '[]' | JSON array |
| token_usage | TEXT | '{}' | JSON |
| created_at | TEXT NOT NULL | datetime('now') | |

### research_sources
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| job_id | TEXT NOT NULL | | FK → research_jobs(id) ON DELETE CASCADE |
| url | TEXT | | |
| title | TEXT | '' | |
| content_preview | TEXT | '' | |
| domain_authority | REAL | 50 | 0-100 |
| recency_score | REAL | 0 | 0-1.0 |
| relevance_score | REAL | 0 | 0-1.0 |
| credibility_tier | TEXT | 'UNVERIFIED' | PRIMARY_SOURCE, AUTHORITATIVE, SECONDARY, UNVERIFIED, FLAGGED |
| composite_score | REAL | 0 | 0-1.0 |
| retrieval_method | TEXT | 'rag' | rag, web |
| created_at | TEXT NOT NULL | datetime('now') | |

**Index:** `idx_research_sources_job` ON (job_id)

---

## System

### system_settings
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| key | TEXT PK | | e.g., llm_config, branding, retention_policy |
| value | TEXT NOT NULL | | JSON |
| updated_at | TEXT NOT NULL | datetime('now') | |

### canon_documents
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | | UUID |
| filename | TEXT NOT NULL | | |
| content | TEXT | '' | |
| file_type | TEXT | 'text' | |
| file_size | INTEGER | 0 | |
| uploaded_at | TEXT NOT NULL | datetime('now') | |

### skill_invocations
| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | INTEGER PK | AUTOINCREMENT | |
| session_id | TEXT | | |
| skill_id | TEXT NOT NULL | | |
| input | TEXT | | |
| output | TEXT | | |
| success | INTEGER | 1 | Boolean |
| duration_ms | INTEGER | | |
| created_at | TEXT NOT NULL | datetime('now') | |
