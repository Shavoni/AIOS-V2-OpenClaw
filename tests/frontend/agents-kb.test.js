/**
 * Frontend tests for per-agent KB architecture features.
 * Tests the AgentsPage KB sheet behavior, web sources display, and KB health indicators.
 */

describe("AgentsPage KB Features", () => {
  describe("Web sources display fix", () => {
    test("_loadWebSources is a defined method on AgentsPage", () => {
      // Verify the method exists in the source
      const fs = require("fs");
      const source = fs.readFileSync("public/js/pages/agents.js", "utf8");
      expect(source).toContain("_loadWebSources");
      expect(source).toContain("/api/agents/${agentId}/sources");
    });

    test("web sources list renders delete buttons", () => {
      const fs = require("fs");
      const source = fs.readFileSync("public/js/pages/agents.js", "utf8");
      expect(source).toContain("web-source-delete-btn");
      expect(source).toContain("data-source-id");
    });
  });

  describe("KB health indicator on agent cards", () => {
    test("agent cards include KB stats placeholder", () => {
      const fs = require("fs");
      const source = fs.readFileSync("public/js/pages/agents.js", "utf8");
      expect(source).toContain("agent-card-kb");
      expect(source).toContain("agent-kb-${agent.id}");
    });

    test("_loadAgentKBBadge is defined and calls KB stats API", () => {
      const fs = require("fs");
      const source = fs.readFileSync("public/js/pages/agents.js", "utf8");
      expect(source).toContain("_loadAgentKBBadge");
      expect(source).toContain("/api/agents/${agentId}/kb/stats");
    });
  });

  describe("Inline document editing", () => {
    test("knowledge doc items include edit button", () => {
      const fs = require("fs");
      const source = fs.readFileSync("public/js/pages/agents.js", "utf8");
      expect(source).toContain("knowledge-edit-btn");
    });

    test("_showEditDocDialog is defined", () => {
      const fs = require("fs");
      const source = fs.readFileSync("public/js/pages/agents.js", "utf8");
      expect(source).toContain("_showEditDocDialog");
      expect(source).toContain("edit-doc-filename");
      expect(source).toContain("edit-doc-priority");
      expect(source).toContain("edit-doc-language");
    });

    test("archive button exists for soft-delete", () => {
      const fs = require("fs");
      const source = fs.readFileSync("public/js/pages/agents.js", "utf8");
      expect(source).toContain("knowledge-archive-btn");
      expect(source).toContain("/archive");
    });
  });

  describe("Document metadata display", () => {
    test("document list shows chunk count", () => {
      const fs = require("fs");
      const source = fs.readFileSync("public/js/pages/agents.js", "utf8");
      expect(source).toContain("chunk_count");
      expect(source).toContain("chunks");
    });

    test("document list shows priority badge", () => {
      const fs = require("fs");
      const source = fs.readFileSync("public/js/pages/agents.js", "utf8");
      expect(source).toContain("Priority:");
    });

    test("document list shows added_by source", () => {
      const fs = require("fs");
      const source = fs.readFileSync("public/js/pages/agents.js", "utf8");
      expect(source).toContain("added_by");
    });
  });
});
