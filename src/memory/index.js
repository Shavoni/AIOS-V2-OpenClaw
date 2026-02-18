const { MessageStore } = require("./store");
const { FileMemory } = require("./file-memory");
const { ContextBuilder } = require("./context-builder");

class MemoryManager {
  constructor(db, saveFn, projectRoot) {
    this.store = new MessageStore(db, saveFn);
    this.fileMemory = new FileMemory(projectRoot);
    this.contextBuilder = new ContextBuilder(this.store, this.fileMemory);
  }

  createSession(title, profile) { return this.store.createSession(title, profile); }
  listSessions(limit) { return this.store.listSessions(limit); }
  deleteSession(id) { return this.store.deleteSession(id); }
  addMessage(sessionId, role, content, meta) { return this.store.addMessage(sessionId, role, content, meta); }
  getMessages(sessionId, limit) { return this.store.getMessages(sessionId, limit); }
  addAuditLog(entry) { return this.store.addAuditLog(entry); }
  buildContext(sessionId, budget) { return this.contextBuilder.buildContext(sessionId, budget); }
  listMemoryFiles() { return this.fileMemory.listMemoryFiles(); }
  getMainMemory() { return this.fileMemory.getMainMemory(); }
}

module.exports = { MemoryManager };
