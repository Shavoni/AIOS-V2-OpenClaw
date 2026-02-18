const SCHEMA = [
  // ─── Original Tables ──────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Chat',
  profile TEXT NOT NULL DEFAULT 'main',
  user_id TEXT,
  department TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  action TEXT NOT NULL,
  intent_domain TEXT,
  risk_signals TEXT,
  hitl_mode TEXT,
  provider TEXT,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE TABLE IF NOT EXISTS skill_invocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  skill_id TEXT NOT NULL,
  input TEXT,
  output TEXT,
  success INTEGER DEFAULT 1,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,

  // ─── Phase 2: Agent Management ────────────────────────────
  `CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT DEFAULT '',
  domain TEXT DEFAULT 'General',
  description TEXT DEFAULT '',
  system_prompt TEXT DEFAULT '',
  capabilities TEXT DEFAULT '[]',
  guardrails TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  is_router INTEGER DEFAULT 0,
  escalates_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE TABLE IF NOT EXISTS knowledge_documents (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT DEFAULT '',
  file_size INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT DEFAULT '{}',
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
)`,
  `CREATE TABLE IF NOT EXISTS web_sources (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  url TEXT NOT NULL,
  name TEXT DEFAULT '',
  description TEXT DEFAULT '',
  refresh_interval_hours INTEGER DEFAULT 24,
  last_refreshed TEXT,
  chunk_count INTEGER DEFAULT 0,
  auto_refresh INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
)`,

  // ─── Phase 3: HITL Approval Workflows ─────────────────────
  `CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  hitl_mode TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  user_id TEXT,
  user_department TEXT,
  agent_id TEXT,
  agent_name TEXT,
  original_query TEXT NOT NULL,
  proposed_response TEXT,
  risk_signals TEXT DEFAULT '[]',
  guardrails_triggered TEXT DEFAULT '[]',
  escalation_reason TEXT,
  resolved_at TEXT,
  resolved_by TEXT,
  reviewer_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_requests(status, created_at)`,

  // ─── Phase 4: Analytics & Audit ───────────────────────────
  `CREATE TABLE IF NOT EXISTS query_events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  user_id TEXT,
  department TEXT,
  agent_id TEXT,
  agent_name TEXT,
  query_text TEXT,
  response_text TEXT,
  latency_ms INTEGER DEFAULT 0,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  hitl_mode TEXT DEFAULT 'INFORM',
  was_escalated INTEGER DEFAULT 0,
  was_approved INTEGER DEFAULT 0,
  guardrails_triggered TEXT DEFAULT '[]',
  success INTEGER DEFAULT 1,
  error_message TEXT,
  session_id TEXT
)`,
  `CREATE INDEX IF NOT EXISTS idx_query_events_ts ON query_events(timestamp)`,
  `CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  user_id TEXT,
  user_department TEXT,
  agent_id TEXT,
  agent_name TEXT,
  action TEXT NOT NULL,
  details TEXT DEFAULT '{}',
  pii_detected TEXT DEFAULT '[]',
  guardrails_triggered TEXT DEFAULT '[]',
  requires_review INTEGER DEFAULT 0,
  reviewed_by TEXT
)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_events_ts ON audit_events(timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type, severity)`,

  // ─── Phase 5: Enhanced Governance ─────────────────────────
  `CREATE TABLE IF NOT EXISTS policy_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  tier TEXT DEFAULT 'standard',
  conditions TEXT DEFAULT '{}',
  hitl_mode TEXT DEFAULT 'INFORM',
  local_only INTEGER DEFAULT 0,
  approval_required INTEGER DEFAULT 0,
  escalation_reason TEXT,
  priority INTEGER DEFAULT 50,
  is_immutable INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE TABLE IF NOT EXISTS prohibited_topics (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  scope TEXT DEFAULT 'global',
  scope_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE TABLE IF NOT EXISTS governance_versions (
  id TEXT PRIMARY KEY,
  description TEXT DEFAULT '',
  rules_snapshot TEXT NOT NULL,
  changed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,

  // ─── Phase 6: System Settings ─────────────────────────────
  `CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE TABLE IF NOT EXISTS canon_documents (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  content TEXT DEFAULT '',
  file_type TEXT DEFAULT 'text',
  file_size INTEGER DEFAULT 0,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,

  // ─── Phase 8: Templates ───────────────────────────────────
  `CREATE TABLE IF NOT EXISTS agent_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}',
  category TEXT DEFAULT 'general',
  is_builtin INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,

  // ─── Authentication ─────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  display_name TEXT DEFAULT '',
  department TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`,

  // ─── GDPR: Consent Tracking ───────────────────────────────
  `CREATE TABLE IF NOT EXISTS user_consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  consent_type TEXT NOT NULL,
  granted INTEGER DEFAULT 1,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`,
  `CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id)`,

  // ─── RAG: Vector Embeddings ─────────────────────────────────
  `CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  embedding BLOB NOT NULL,
  text_preview TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`,
  `CREATE INDEX IF NOT EXISTS idx_embeddings_agent ON embeddings(agent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_embeddings_document ON embeddings(document_id)`,

  // ─── Phase 8: Onboarding / Discovery ──────────────────────
  `CREATE TABLE IF NOT EXISTS onboarding_wizards (
  id TEXT PRIMARY KEY,
  organization_name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  organization_type TEXT DEFAULT 'municipal',
  step TEXT DEFAULT 'init',
  progress REAL DEFAULT 0,
  discovery_result TEXT DEFAULT '{}',
  departments TEXT DEFAULT '[]',
  template_matches TEXT DEFAULT '[]',
  selected_template TEXT,
  preview TEXT,
  deployment_id TEXT,
  deployment_status TEXT,
  deployment_errors TEXT DEFAULT '[]',
  requires_approval INTEGER DEFAULT 0,
  approval_checklist TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
)`,

  // ─── Integration Connectors ──────────────────────────────
  `CREATE TABLE IF NOT EXISTS connectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'webhook',
  config TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  agent_id TEXT,
  description TEXT DEFAULT '',
  auth_type TEXT DEFAULT 'none',
  auth_config TEXT DEFAULT '{}',
  health_status TEXT DEFAULT 'unknown',
  last_health_check TEXT,
  created_by TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
)`,
  `CREATE INDEX IF NOT EXISTS idx_connectors_status ON connectors(status)`,
  `CREATE TABLE IF NOT EXISTS connector_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  connector_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (connector_id) REFERENCES connectors(id) ON DELETE CASCADE
)`,
  `CREATE INDEX IF NOT EXISTS idx_connector_events_connector ON connector_events(connector_id)`,

  // ─── Deep Research Pipeline ─────────────────────────────
  `CREATE TABLE IF NOT EXISTS research_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  query TEXT NOT NULL,
  query_decomposition TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'QUEUED',
  current_stage TEXT DEFAULT NULL,
  stage_progress REAL DEFAULT 0,
  result_id TEXT,
  confidence_score REAL DEFAULT 0,
  source_count INTEGER DEFAULT 0,
  has_contradictions INTEGER DEFAULT 0,
  ttl INTEGER DEFAULT 86400,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  expires_at TEXT
)`,
  `CREATE INDEX IF NOT EXISTS idx_research_jobs_status ON research_jobs(status, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_research_jobs_user ON research_jobs(user_id)`,
  `CREATE TABLE IF NOT EXISTS research_results (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  synthesis TEXT DEFAULT '',
  sources TEXT DEFAULT '[]',
  claims TEXT DEFAULT '[]',
  evidence_set TEXT DEFAULT '[]',
  token_usage TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES research_jobs(id) ON DELETE CASCADE
)`,
  `CREATE TABLE IF NOT EXISTS research_sources (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  url TEXT,
  title TEXT DEFAULT '',
  content_preview TEXT DEFAULT '',
  domain_authority REAL DEFAULT 50,
  recency_score REAL DEFAULT 0,
  relevance_score REAL DEFAULT 0,
  credibility_tier TEXT DEFAULT 'UNVERIFIED',
  composite_score REAL DEFAULT 0,
  retrieval_method TEXT DEFAULT 'rag',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES research_jobs(id) ON DELETE CASCADE
)`,
  `CREATE INDEX IF NOT EXISTS idx_research_sources_job ON research_sources(job_id)`,
];

function initSchema(db) {
  for (const stmt of SCHEMA) {
    db.run(stmt + ";");
  }
}

module.exports = { initSchema, SCHEMA };