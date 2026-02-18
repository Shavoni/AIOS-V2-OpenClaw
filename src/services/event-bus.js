/**
 * In-process event bus for broadcasting real-time events.
 * Services emit events here → Socket.io picks them up and broadcasts to clients.
 */
const { EventEmitter } = require("events");

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  // HITL events
  emitApprovalCreated(approval) {
    this.emit("hitl:created", approval);
  }
  emitApprovalApproved(approval) {
    this.emit("hitl:approved", approval);
  }
  emitApprovalRejected(approval) {
    this.emit("hitl:rejected", approval);
  }

  // Chat events
  emitQueryCompleted(event) {
    this.emit("chat:query", event);
  }
  emitAgentRouted(routeInfo) {
    this.emit("chat:routed", routeInfo);
  }

  // Research events
  emitResearchProgress(event) {
    this.emit("research:progress", event);
  }
  emitResearchCompleted(event) {
    this.emit("research:completed", event);
  }
  emitResearchFailed(event) {
    this.emit("research:failed", event);
  }

  // System events
  emitMetricsUpdate(metrics) {
    this.emit("dashboard:metrics", metrics);
  }
  emitAuditEvent(event) {
    this.emit("audit:event", event);
  }
}

// Singleton
const eventBus = new EventBus();
module.exports = { eventBus };
