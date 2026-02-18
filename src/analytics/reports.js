/**
 * Report generation for analytics data.
 * Generates structured reports in JSON and plain-text formats.
 */

class ReportGenerator {
  constructor(analyticsManager, auditManager, hitlManager) {
    this.analytics = analyticsManager;
    this.audit = auditManager;
    this.hitl = hitlManager;
  }

  /**
   * Generate a comprehensive summary report.
   * @param {number} days - Number of days to cover
   * @returns {Object} Structured report
   */
  generateSummary(days = 7) {
    const analytics = this.analytics.getSummary(days);
    const audit = this.audit.getSummary();
    const hitl = this.hitl.getQueueSummary();

    return {
      generated_at: new Date().toISOString(),
      period_days: days,
      overview: {
        total_queries: analytics.totalQueries || 0,
        success_rate: `${analytics.successRate || 100}%`,
        avg_latency_ms: analytics.avgLatency || 0,
        total_cost_usd: analytics.totalCost || 0,
        total_tokens: (analytics.totalTokensIn || 0) + (analytics.totalTokensOut || 0),
        escalations: analytics.escalations || 0,
        errors: analytics.errors || 0,
      },
      hitl_queue: {
        pending: hitl.pending || 0,
        approved: hitl.approved || 0,
        rejected: hitl.rejected || 0,
        by_mode: hitl.byMode || {},
        by_priority: hitl.byPriority || {},
      },
      audit: {
        total_events: audit.total || 0,
        by_severity: audit.bySeverity || {},
        by_type: audit.byType || {},
        pending_review: audit.requiresReview || 0,
      },
      usage_by_agent: analytics.byAgent || {},
      usage_by_department: analytics.byDepartment || {},
    };
  }

  /**
   * Generate a plain-text report suitable for email.
   * @param {number} days
   * @returns {string}
   */
  generateTextReport(days = 7) {
    const data = this.generateSummary(days);
    const lines = [
      `AIOS V2 - ${days}-Day Summary Report`,
      `Generated: ${data.generated_at}`,
      `${"=".repeat(50)}`,
      "",
      "OVERVIEW",
      `  Total Queries:    ${data.overview.total_queries}`,
      `  Success Rate:     ${data.overview.success_rate}`,
      `  Avg Latency:      ${data.overview.avg_latency_ms}ms`,
      `  Total Cost:       $${data.overview.total_cost_usd.toFixed(4)}`,
      `  Total Tokens:     ${data.overview.total_tokens.toLocaleString()}`,
      `  Escalations:      ${data.overview.escalations}`,
      `  Errors:           ${data.overview.errors}`,
      "",
      "APPROVAL QUEUE",
      `  Pending:    ${data.hitl_queue.pending}`,
      `  Approved:   ${data.hitl_queue.approved}`,
      `  Rejected:   ${data.hitl_queue.rejected}`,
      "",
      "AUDIT",
      `  Total Events:     ${data.audit.total_events}`,
      `  Pending Review:   ${data.audit.pending_review}`,
    ];

    if (Object.keys(data.audit.by_severity).length > 0) {
      lines.push("  By Severity:");
      for (const [sev, count] of Object.entries(data.audit.by_severity)) {
        lines.push(`    ${sev}: ${count}`);
      }
    }

    if (Object.keys(data.usage_by_agent).length > 0) {
      lines.push("", "USAGE BY AGENT");
      for (const [agent, stats] of Object.entries(data.usage_by_agent)) {
        lines.push(`  ${agent}: ${stats.queries} queries, ${stats.avgLatency}ms avg, $${stats.cost.toFixed(4)}`);
      }
    }

    lines.push("", `${"=".repeat(50)}`, "End of Report");
    return lines.join("\n");
  }
}

module.exports = { ReportGenerator };
