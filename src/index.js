const express = require('express');
const { loadConfig } = require('./config');
const { getDb, saveDb, closeDb, markDirty, startAutoSave, stopAutoSave } = require('./db');
const { initSchema } = require('./db/schema');
const { ModelRouter } = require('./router');
const { AgentManager } = require('./agent');
const { SkillEngine } = require('./skills');
const { MemoryManager } = require('./memory');
const { IntentClassifier, RiskDetector, GovernanceEngine } = require('./governance');
const { MessageHandler, createChatRoutes, setupSocket } = require('./chat');

// Phase 2-8 modules
const { AgentManagerService } = require('./agents/manager');
const { createAgentRoutes } = require('./agents/routes');
const { HITLManager } = require('./hitl/manager');
const { createHITLRoutes } = require('./hitl/routes');
const { AnalyticsManager } = require('./analytics/manager');
const { createAnalyticsRoutes } = require('./analytics/routes');
const { AuditManager } = require('./audit/manager');
const { createAuditRoutes } = require('./audit/routes');
const { createGovernanceRoutes } = require('./governance/routes');
const { LLMConfig } = require('./system/llm-config');
const { BrandingService } = require('./system/branding');
const { CanonService } = require('./system/canon');
const { createSystemRoutes } = require('./system/routes');

// Onboarding
const { OnboardingWizard, createOnboardingRoutes } = require('./onboarding');

// Auth
const { AuthService } = require('./services/auth-service');
const { createAuthMiddleware } = require('./middleware/auth-middleware');
const { createAuthRoutes } = require('./routes/auth');

// New: event bus, RAG, reports
const { eventBus } = require('./services/event-bus');
const { RAGPipeline } = require('./rag');
const { ReportGenerator } = require('./analytics/reports');

// GDPR compliance
const { ConsentService } = require('./gdpr/consent-service');
const { GDPRService } = require('./gdpr/gdpr-service');
const { createGDPRRoutes } = require('./gdpr/routes');

// Integration framework
const { ConnectorService } = require('./integration/connector-service');
const { createIntegrationRoutes } = require('./integration/routes');

// Database services
const { RetentionService } = require('./db/retention-service');

// Deep Research Pipeline
const { SourceScorer, ClaimScorer, JobConfidenceCalculator } = require('./research/scoring-engine');
const { ResearchJobManager } = require('./research/manager');
const { DecompositionWorker } = require('./research/workers/decomposition');
const { RetrievalWorker } = require('./research/workers/retrieval');
const { ScoringWorker } = require('./research/workers/scoring');
const { SynthesisWorker } = require('./research/workers/synthesis');
const { ResearchQueueService } = require('./research/queue-service');
const { createResearchRoutes } = require('./research/routes');

// Embeddings
const { createEmbeddingProvider } = require('./rag/embedding-provider');
const { VectorStore } = require('./rag/vector-store');
const { EmbeddingClassifier } = require('./governance/embedding-classifier');

async function createApp() {
  // 1. Load config
  const config = loadConfig();

  // 2. Initialize database with auto-save
  const db = await getDb(config.dbPath);
  initSchema(db);
  startAutoSave(30000);

  // 3. Model router
  const router = new ModelRouter(config.providers);

  // 4. Agent identity system
  const agent = new AgentManager(config.projectRoot);

  // 5. Skills engine
  const skills = new SkillEngine(config.projectRoot);
  const skillReport = skills.loadAll();
  console.log(`Skills loaded: ${skillReport.loaded}, failed: ${skillReport.failed}`);

  // 6. Memory system — use markDirty so auto-save batches writes
  const memory = new MemoryManager(db, markDirty, config.projectRoot);

  // 7. Governance
  const classifier = new IntentClassifier();
  const riskDetector = new RiskDetector();
  const engine = new GovernanceEngine(null, db, markDirty);
  engine.classifier = classifier;
  engine.riskDetector = riskDetector;
  engine.loadRules();
  const governance = { classifier, riskDetector, engine };

  // 8. Services (Phases 2-6) — all use markDirty for deferred persistence
  const agentManagerService = new AgentManagerService(db, markDirty);
  const hitlManager = new HITLManager(db, markDirty);
  const analyticsManager = new AnalyticsManager(db, markDirty);
  const auditManager = new AuditManager(db, markDirty);
  const llmConfig = new LLMConfig(db, markDirty);
  const branding = new BrandingService(db, markDirty, config.projectRoot);
  const canon = new CanonService(db, markDirty);

  // 9. Onboarding wizard
  const onboardingWizard = new OnboardingWizard(db, markDirty, {
    agentManager: agentManagerService,
    router,
  });

  // 10. Auth service
  const legacyConfig = (() => { try { return require('./config-legacy'); } catch { return { auth: {} }; } })();
  const authService = new AuthService(db, markDirty, {
    jwtSecret: legacyConfig.auth?.sessionSecret || process.env.JWT_SECRET,
    apiKeys: legacyConfig.auth?.apiKeys || [],
    sessionTtlMs: legacyConfig.auth?.sessionTtlMs,
  });
  const authMiddleware = createAuthMiddleware(authService);

  // 10. Embeddings + RAG pipeline
  const embeddingConfig = config.embedding || null;
  const embedder = createEmbeddingProvider(embeddingConfig);
  const vectorStore = embedder ? new VectorStore(db, markDirty) : null;
  const rag = new RAGPipeline(agentManagerService, canon, { embedder, vectorStore });
  rag.indexCanon();

  // Embedding-enhanced classifier (initializes async, falls back to keyword until ready)
  const embeddingClassifier = new EmbeddingClassifier(embedder);
  if (embedder) embeddingClassifier.initialize().catch(() => {});

  // 11. Report generator
  const reports = new ReportGenerator(analyticsManager, auditManager, hitlManager);

  // 12. Chat handler
  const handler = new MessageHandler({
    router, agent, memory, governance, skills,
    hitlManager, analyticsManager, auditManager,
    eventBus, rag,
  });

  // 13. Build combined API routes
  const apiRoutes = express.Router();
  const { authOptional, authRequired } = authMiddleware;

  // Auth routes (no auth middleware — these handle their own auth)
  const { authLimiter } = require('./middleware/rate-limit');
  apiRoutes.use('/auth', authLimiter, createAuthRoutes(authService, authMiddleware));

  // Apply authOptional to all routes — populates req.user without blocking
  // In dev mode (no users/keys configured), auto-grants admin.
  apiRoutes.use(authOptional());

  // Core chat routes — viewer access required
  apiRoutes.use('/', authRequired('viewer'), createChatRoutes(handler, memory, skills, agent, router, config));

  // Agent management — operator access required
  apiRoutes.use('/agents', authRequired('operator'), createAgentRoutes(agentManagerService, classifier));

  // HITL approvals — operator access required
  apiRoutes.use('/hitl', authRequired('operator'), createHITLRoutes(hitlManager));

  // Analytics + reports — viewer access required
  const analyticsRoutes = createAnalyticsRoutes(analyticsManager);
  // Report endpoints
  analyticsRoutes.get('/reports/summary', (req, res) => {
    try {
      const days = parseInt(req.query.days, 10) || 7;
      res.json(reports.generateSummary(days));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  analyticsRoutes.get('/reports/text', (req, res) => {
    try {
      const days = parseInt(req.query.days, 10) || 7;
      res.type('text/plain').send(reports.generateTextReport(days));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  apiRoutes.use('/analytics', authRequired('viewer'), analyticsRoutes);

  // Audit — operator access required
  apiRoutes.use('/audit', authRequired('operator'), createAuditRoutes(auditManager));

  // Governance — admin access required
  apiRoutes.use('/governance', authRequired('admin'), createGovernanceRoutes(engine));

  // System — admin access required
  apiRoutes.use('/system', authRequired('admin'), createSystemRoutes(llmConfig, branding, canon, agentManagerService, db, markDirty));

  // Onboarding — operator access required
  apiRoutes.use('/onboarding', authRequired('operator'), createOnboardingRoutes(onboardingWizard));

  // Integrations — operator access required
  const connectorService = new ConnectorService(db, markDirty);
  apiRoutes.use('/integrations', authRequired('operator'), createIntegrationRoutes(connectorService));

  // GDPR — viewer access (users manage their own data)
  const consentService = new ConsentService(db, markDirty);
  const gdprService = new GDPRService(db, markDirty);
  apiRoutes.use('/gdpr', authRequired('viewer'), createGDPRRoutes(gdprService, consentService));

  // RAG endpoints — operator access required
  apiRoutes.post('/rag/index/:agentId', authRequired('operator'), (req, res) => {
    try {
      const { documentId, content, metadata } = req.body;
      const chunks = rag.indexDocument(req.params.agentId, documentId, content, metadata);
      res.json({ ok: true, chunks });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  apiRoutes.post('/rag/search/:agentId', authRequired('viewer'), (req, res) => {
    try {
      const { query, topK } = req.body;
      const results = rag.search.search(req.params.agentId, query, topK || 5);
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  apiRoutes.get('/rag/stats', authRequired('viewer'), (_req, res) => {
    res.json(rag.getStats());
  });

  // Deep Research Pipeline — operator access required
  const researchManager = new ResearchJobManager(db, markDirty);
  const sourceScorer = new SourceScorer();
  const claimScorer = new ClaimScorer();
  const jobConfidenceCalc = new JobConfidenceCalculator();
  const decompositionWorker = new DecompositionWorker(router);
  const retrievalWorker = new RetrievalWorker(rag, { tavilyApiKey: process.env.TAVILY_API_KEY });
  const scoringWorker = new ScoringWorker(sourceScorer, claimScorer, jobConfidenceCalc, router);
  const synthesisWorker = new SynthesisWorker(router);
  const researchQueueService = new ResearchQueueService({
    manager: researchManager,
    decompositionWorker,
    retrievalWorker,
    scoringWorker,
    synthesisWorker,
    eventBus,
    maxConcurrency: parseInt(process.env.RESEARCH_MAX_CONCURRENCY, 10) || 3,
  });
  apiRoutes.use('/research', authRequired('operator'), createResearchRoutes(researchQueueService, researchManager));

  // Auto-populate agent KB from completed research jobs
  eventBus.on('research:completed', ({ jobId }) => {
    try {
      const job = researchManager.getJob(jobId);
      if (!job || !job.agent_id) return;
      const result = researchManager.getResult(jobId);
      if (!result || !result.sources) return;
      const sources = typeof result.sources === 'string' ? JSON.parse(result.sources) : result.sources;
      agentManagerService.populateKBFromResearch(job.agent_id, { jobId, sources, threshold: 0.65 });
    } catch { /* non-critical — don't break the pipeline */ }
  });

  console.log(`Routes mounted: auth, chat, agents, hitl, analytics, audit, governance, system, rag, onboarding, gdpr, integrations, research`);

  // Cleanup hook
  const shutdown = () => {
    console.log('Shutting down...');
    stopAutoSave();
    authService.destroy();
    closeDb();
  };

  // Register shutdown on process signals
  process.on('SIGINT', () => { shutdown(); process.exit(0); });
  process.on('SIGTERM', () => { shutdown(); process.exit(0); });

  return {
    config, router, agent, skills, memory, governance, handler,
    authService, authMiddleware,
    agentManagerService, hitlManager, analyticsManager, auditManager,
    rag, reports, eventBus, researchManager, researchQueueService,
    apiRoutes,
    setupSocket: (httpServer) => setupSocket(httpServer, handler, memory, authService),
    shutdown,
  };
}

module.exports = { createApp };
