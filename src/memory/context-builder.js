class ContextBuilder {
  constructor(store, fileMemory) {
    this.store = store;
    this.fileMemory = fileMemory;
  }

  buildContext(sessionId, tokenBudget = 8000) {
    const messages = [];

    // Main memory gets up to 25% of budget
    const memoryBudget = Math.floor(tokenBudget * 0.25);
    const mainMemory = this.fileMemory.getMainMemory();
    if (mainMemory) {
      const truncated = mainMemory.slice(0, memoryBudget * 4);
      if (truncated.trim()) {
        messages.push({ role: "system", content: `[Memory]
${truncated}` });
      }
    }

    // Conversation history gets remaining budget
    const convBudget = tokenBudget - memoryBudget;
    const history = this.store.getRecentMessages(sessionId, convBudget);
    messages.push(...history);

    return messages;
  }
}

module.exports = { ContextBuilder };
