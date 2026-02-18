const { loadConfig } = require('./config');
const { getDb, saveDb, closeDb } = require('./db');
const { initSchema } = require('./db/schema');
const { ModelRouter } = require('./router');
const { AgentManager } = require('./agent');
const { SkillEngine } = require('./skills');
const { MemoryManager } = require('./memory');
const { IntentClassifier, RiskDetector, GovernanceEngine } = require('./governance');
const { MessageHandler, createChatRoutes, setupSocket } = require('./chat');

async function createApp() {
  // 1. Load config
  const config = loadConfig();

  // 2. Initialize database
  const db = await getDb(config.dbPath);
  initSchema(db);

  // 3. Model router
  const router = new ModelRouter(config.providers);

  // 4. Agent system
  const agent = new AgentManager(config.projectRoot);

  // 5. Skills engine
  const skills = new SkillEngine(config.projectRoot);
  const skillReport = skills.loadAll();
  console.log(`Skills loaded: ${skillReport.loaded}, failed: ${skillReport.failed}`);

  // 6. Memory system
  const memory = new MemoryManager(db, saveDb, config.projectRoot);

  // 7. Governance
  const classifier = new IntentClassifier();
  const riskDetector = new RiskDetector();
  const engine = new GovernanceEngine();
  engine.classifier = classifier;
  engine.riskDetector = riskDetector;

  const governance = { classifier, riskDetector, engine };

  // 8. Chat handler
  const handler = new MessageHandler({ router, agent, memory, governance, skills });

  // 9. API routes
  const apiRoutes = createChatRoutes(handler, memory, skills, agent, router);

  // Cleanup hook
  const shutdown = () => {
    console.log('Shutting down...');
    closeDb();
    process.exit(0);
  };

  return {
    config,
    router,
    agent,
    skills,
    memory,
    governance,
    handler,
    apiRoutes,
    setupSocket: (httpServer) => setupSocket(httpServer, handler, memory),
    shutdown,
  };
}

module.exports = { createApp };
