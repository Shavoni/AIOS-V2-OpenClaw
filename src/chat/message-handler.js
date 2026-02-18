class MessageHandler {
  constructor({ router, agent, memory, governance, skills }) {
    this.router = router;
    this.agent = agent;
    this.memory = memory;
    this.governance = governance;
    this.skills = skills;
  }

  async handle(sessionId, userMessage, options = {}) {
    // 1. Intent classification
    const intent = this.governance.classifier.classify(userMessage);

    // 2. Risk detection
    const risk = this.governance.riskDetector.detect(userMessage);

    // 3. Governance evaluation
    const decision = this.governance.engine.evaluate(intent, risk);

    // 4. Save user message
    this.memory.addMessage(sessionId, "user", userMessage, {
      intent: intent.domain,
      risk: risk.signals,
      hitlMode: decision.hitlMode,
    });

    // 5. Handle escalation
    if (decision.hitlMode === "ESCALATE") {
      const text = this._buildEscalationResponse(decision, intent);
      this.memory.addMessage(sessionId, "assistant", text);
      this._audit(sessionId, intent, risk, decision, { text, provider: "governance" });
      return { text, hitlMode: "ESCALATE", streamed: false };
    }

    // 6. Build system prompt
    const profile = options.profile || "main";
    const systemPrompt = this.agent.getSystemPrompt(profile, decision);

    // 7. Build context window
    const context = this.memory.buildContext(sessionId, 8000);
    const messages = [
      { role: "system", content: systemPrompt },
      ...context,
      { role: "user", content: userMessage },
    ];

    // 8. Route to LLM
    const agentProfile = this.agent.getProfile(profile);
    const result = await this.router.route(messages, {
      model: agentProfile.model,
      temperature: agentProfile.temperature,
      maxTokens: agentProfile.maxTokens,
      localOnly: decision.providerConstraints.localOnly,
    });

    // 9. Apply DRAFT mode
    let responseText = result.text;
    if (decision.hitlMode === "DRAFT") {
      responseText = `**[DRAFT — Requires approval before use]**\n\n${responseText}`;
    }

    // 10. Save assistant response
    this.memory.addMessage(sessionId, "assistant", responseText, {
      model: result.model,
      provider: result.provider,
      tokensIn: result.usage?.prompt,
      tokensOut: result.usage?.completion,
      latencyMs: result.latencyMs,
    });

    // 11. Audit log
    this._audit(sessionId, intent, risk, decision, result);

    return {
      text: responseText,
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      latencyMs: result.latencyMs,
      hitlMode: decision.hitlMode,
      streamed: false,
    };
  }

  async *handleStream(sessionId, userMessage, options = {}) {
    const intent = this.governance.classifier.classify(userMessage);
    const risk = this.governance.riskDetector.detect(userMessage);
    const decision = this.governance.engine.evaluate(intent, risk);

    this.memory.addMessage(sessionId, "user", userMessage, {
      intent: intent.domain,
      risk: risk.signals,
    });

    if (decision.hitlMode === "ESCALATE") {
      const text = this._buildEscalationResponse(decision, intent);
      this.memory.addMessage(sessionId, "assistant", text);
      yield { text, done: true };
      return;
    }

    const profile = options.profile || "main";
    const systemPrompt = this.agent.getSystemPrompt(profile, decision);
    const context = this.memory.buildContext(sessionId, 8000);
    const messages = [
      { role: "system", content: systemPrompt },
      ...context,
      { role: "user", content: userMessage },
    ];

    const agentProfile = this.agent.getProfile(profile);
    let fullText = "";

    if (decision.hitlMode === "DRAFT") {
      const prefix = "**[DRAFT — Requires approval before use]**\n\n";
      yield { text: prefix, done: false };
      fullText += prefix;
    }

    const stream = this.router.routeStream(messages, {
      model: agentProfile.model,
      temperature: agentProfile.temperature,
      maxTokens: agentProfile.maxTokens,
    });

    for await (const chunk of stream) {
      fullText += chunk.text;
      yield { text: chunk.text, model: chunk.model, provider: chunk.provider, done: false };
    }

    this.memory.addMessage(sessionId, "assistant", fullText, {
      model: agentProfile.model,
      provider: "stream",
    });

    this._audit(sessionId, intent, risk, decision, { model: agentProfile.model });

    yield { text: "", done: true, hitlMode: decision.hitlMode };
  }

  _buildEscalationResponse(decision, intent) {
    return [
      `**This request requires human approval.**`,
      ``,
      `**Domain:** ${intent.domain}`,
      `**Reason:** ${decision.escalationReason || "Policy restriction"}`,
      `**Triggered policies:** ${decision.policyTriggers.join(", ")}`,
      ``,
      `Please confirm this action explicitly, or rephrase your request.`,
    ].join("\n");
  }

  _audit(sessionId, intent, risk, decision, result) {
    try {
      this.memory.addAuditLog({
        sessionId,
        action: "chat",
        intentDomain: intent.domain,
        riskSignals: risk.signals,
        hitlMode: decision.hitlMode,
        provider: result.provider,
        model: result.model,
      });
    } catch (_) {
      // Non-critical
    }
  }
}

module.exports = { MessageHandler };
