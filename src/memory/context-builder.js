class ContextBuilder {
  constructor(store, fileMemory) {
    this.store = store;
    this.fileMemory = fileMemory;
  }

  buildContext(sessionId, tokenBudget = 8000) {
    const messages = [];

    // Main memory gets up to 25% of budget (only if non-empty)
    const mainMemory = this.fileMemory.getMainMemory();
    let memoryBudgetUsed = 0;

    if (mainMemory && mainMemory.trim()) {
      const memoryBudget = Math.floor(tokenBudget * 0.25);
      const truncated = mainMemory.slice(0, memoryBudget * 4);
      if (truncated.trim()) {
        messages.push({ role: "system", content: `[Memory]\n${truncated}` });
        memoryBudgetUsed = Math.ceil(truncated.length / 4);
      }
    }

    // Conversation history gets remaining budget (full budget if no memory)
    const convBudget = tokenBudget - memoryBudgetUsed;
    const history = this.store.getRecentMessages(sessionId, convBudget);
    messages.push(...history);

    return messages;
  }
}

module.exports = { ContextBuilder };
