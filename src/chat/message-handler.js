const { sanitizeMessage } = require('../middleware/sanitize');

class MessageHandler {
  constructor({ router, agent, memory, governance, skills, hitlManager, analyticsManager, auditManager, eventBus, rag }) {
    this.router = router;
    this.agent = agent;
    this.memory = memory;
    this.governance = governance;
    this.skills = skills;
    this.hitlManager = hitlManager || null;
    this.analyticsManager = analyticsManager || null;
    this.auditManager = auditManager || null;
    this.eventBus = eventBus || null;
    this.rag = rag || null;
  }

  async handle(sessionId, userMessage, options = {}) {
    userMessage = sanitizeMessage(userMessage);
    const startTime = Date.now();

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

    // 5. Handle escalation — queue for HITL approval
    if (decision.hitlMode === "ESCALATE") {
      const text = this._buildEscalationResponse(decision, intent);
      this.memory.addMessage(sessionId, "assistant", text);
      this._audit(sessionId, intent, risk, decision, { text, provider: "governance" });

      // Queue approval request
      if (this.hitlManager) {
        this.hitlManager.createApproval({
          hitl_mode: "ESCALATE",
          priority: "high",
          original_query: userMessage,
          proposed_response: text,
          risk_signals: risk.signals,
          guardrails_triggered: decision.policyTriggers,
          escalation_reason: decision.escalationReason,
          agent_name: this.agent.identity?.name || "Scotty-5",
        });
      }

      // Log audit event
      this._logAuditEvent("escalation", "warning", null, "Query escalated", {
        session_id: sessionId, query: userMessage, reason: decision.escalationReason,
        guardrails_triggered: decision.policyTriggers,
      });

      return { text, hitlMode: "ESCALATE", streamed: false };
    }

    // 6. Build system prompt
    const profile = options.profile || "main";
    const systemPrompt = this.agent.getSystemPrompt(profile, decision);

    // 7. Build context window with RAG augmentation
    const context = this.memory.buildContext(sessionId, 8000);
    let ragContext = "";
    if (this.rag) {
      try {
        ragContext = this.rag.retrieveContext("__canon__", userMessage, 3, 1000);
      } catch (_) { /* non-critical */ }
    }

    const messages = [
      { role: "system", content: systemPrompt + (ragContext ? "\n\n" + ragContext : "") },
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

    // 9. Apply DRAFT mode — queue for HITL if needed
    let responseText = result.text;
    if (decision.hitlMode === "DRAFT") {
      responseText = `**[DRAFT \u2014 Requires approval before use]**\n\n${responseText}`;

      // Queue approval for DRAFT responses
      if (this.hitlManager) {
        this.hitlManager.createApproval({
          hitl_mode: "DRAFT",
          priority: "medium",
          original_query: userMessage,
          proposed_response: responseText,
          risk_signals: risk.signals,
          guardrails_triggered: decision.policyTriggers,
          agent_name: this.agent.identity?.name || "Scotty-5",
        });
      }
    }

    const latencyMs = Date.now() - startTime;

    // 10. Save assistant response
    this.memory.addMessage(sessionId, "assistant", responseText, {
      model: result.model,
      provider: result.provider,
      tokensIn: result.usage?.prompt,
      tokensOut: result.usage?.completion,
      latencyMs,
    });

    // 11. Audit log
    this._audit(sessionId, intent, risk, decision, result);

    // 12. Record analytics event
    this._recordAnalytics({
      session_id: sessionId,
      query_text: userMessage,
      response_text: responseText,
      latency_ms: latencyMs,
      tokens_in: result.usage?.prompt || 0,
      tokens_out: result.usage?.completion || 0,
      hitl_mode: decision.hitlMode,
      was_escalated: decision.hitlMode === "ESCALATE",
      guardrails_triggered: decision.policyTriggers,
      success: true,
      agent_name: this.agent.identity?.name || "Scotty-5",
    });

    return {
      text: responseText,
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      latencyMs,
      hitlMode: decision.hitlMode,
      streamed: false,
    };
  }

  async *handleStream(sessionId, userMessage, options = {}) {
    userMessage = sanitizeMessage(userMessage);
    const startTime = Date.now();
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

      if (this.hitlManager) {
        this.hitlManager.createApproval({
          hitl_mode: "ESCALATE",
          priority: "high",
          original_query: userMessage,
          proposed_response: text,
          risk_signals: risk.signals,
          guardrails_triggered: decision.policyTriggers,
          escalation_reason: decision.escalationReason,
        });
      }

      yield { text, done: true };
      return;
    }

    const profile = options.profile || "main";
    const systemPrompt = this.agent.getSystemPrompt(profile, decision);
    const context = this.memory.buildContext(sessionId, 8000);

    // RAG augmentation for streaming (same as non-streaming path)
    let ragContext = "";
    if (this.rag) {
      try {
        ragContext = this.rag.retrieveContext("__canon__", userMessage, 3, 1000);
      } catch (_) { /* non-critical */ }
    }

    const messages = [
      { role: "system", content: systemPrompt + (ragContext ? "\n\n" + ragContext : "") },
      ...context,
      { role: "user", content: userMessage },
    ];

    const agentProfile = this.agent.getProfile(profile);
    let fullText = "";

    if (decision.hitlMode === "DRAFT") {
      const prefix = "**[DRAFT \u2014 Requires approval before use]**\n\n";
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

    const latencyMs = Date.now() - startTime;

    this.memory.addMessage(sessionId, "assistant", fullText, {
      model: agentProfile.model,
      provider: "stream",
      latencyMs,
    });

    this._audit(sessionId, intent, risk, decision, { model: agentProfile.model });

    // Queue DRAFT for HITL
    if (decision.hitlMode === "DRAFT" && this.hitlManager) {
      this.hitlManager.createApproval({
        hitl_mode: "DRAFT",
        priority: "medium",
        original_query: userMessage,
        proposed_response: fullText,
        risk_signals: risk.signals,
        guardrails_triggered: decision.policyTriggers,
      });
    }

    this._recordAnalytics({
      session_id: sessionId,
      query_text: userMessage,
      response_text: fullText,
      latency_ms: latencyMs,
      hitl_mode: decision.hitlMode,
      was_escalated: false,
      guardrails_triggered: decision.policyTriggers,
      success: true,
    });

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

  _recordAnalytics(event) {
    try {
      if (this.analyticsManager) {
        this.analyticsManager.recordQuery(event);
      }
      if (this.eventBus) {
        this.eventBus.emitQueryCompleted(event);
      }
    } catch (_) {
      // Non-critical
    }
  }

  _logAuditEvent(type, severity, userId, action, details) {
    try {
      if (this.auditManager) {
        this.auditManager.logEvent(type, severity, userId, action, details);
      }
    } catch (_) {
      // Non-critical
    }
  }
}

module.exports = { MessageHandler };
