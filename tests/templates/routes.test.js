/**
 * RED -> GREEN -- Template Routes
 * Tests Express routes for template registry browsing and search.
 */

const express = require("express");
const request = require("supertest");
const { createTemplateRoutes } = require("../../src/templates/routes");

describe("Template Routes", () => {
  let app;

  const sampleTemplate = {
    id: "tpl-healthcare-sm",
    name: "Healthcare Starter",
    sector: "healthcare",
    size: ["small"],
    departments: ["HR"],
    governance: { compliance: ["HIPAA"] },
    description: "test",
    discoveryKeywords: ["test"],
  };

  const sampleTemplate2 = {
    id: "tpl-edu-lg",
    name: "Education Enterprise",
    sector: "education",
    size: ["large"],
    departments: ["HR"],
    governance: { compliance: ["FERPA"] },
    description: "test",
    discoveryKeywords: ["test"],
  };

  const mockRegistry = {
    listTemplates: jest.fn(),
    searchTemplates: jest.fn(),
    listSectors: jest.fn(),
    getSummary: jest.fn(),
    getTemplate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use("/api/templates", createTemplateRoutes(mockRegistry));
  });

  // --- GET /api/templates ---

  describe("GET /api/templates", () => {
    it("returns all templates with count", async () => {
      mockRegistry.listTemplates.mockReturnValue([sampleTemplate, sampleTemplate2]);

      const res = await request(app).get("/api/templates");

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.templates).toHaveLength(2);
      expect(mockRegistry.listTemplates).toHaveBeenCalledWith({});
    });

    it("passes sector filter to listTemplates", async () => {
      mockRegistry.listTemplates.mockReturnValue([sampleTemplate]);

      const res = await request(app).get("/api/templates?sector=healthcare");

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.templates[0].sector).toBe("healthcare");
      expect(mockRegistry.listTemplates).toHaveBeenCalledWith({ sector: "healthcare" });
    });

    it("passes size filter to listTemplates", async () => {
      mockRegistry.listTemplates.mockReturnValue([sampleTemplate]);

      const res = await request(app).get("/api/templates?size=small");

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(mockRegistry.listTemplates).toHaveBeenCalledWith({ size: "small" });
    });

    it("calls searchTemplates when q parameter is provided", async () => {
      mockRegistry.searchTemplates.mockReturnValue([sampleTemplate]);

      const res = await request(app).get("/api/templates?q=hospital");

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.templates).toHaveLength(1);
      expect(mockRegistry.searchTemplates).toHaveBeenCalledWith("hospital");
      expect(mockRegistry.listTemplates).not.toHaveBeenCalled();
    });
  });

  // --- GET /api/templates/sectors ---

  describe("GET /api/templates/sectors", () => {
    it("returns list of sectors", async () => {
      const sectors = [
        { id: "healthcare", name: "Healthcare", templateCount: 5 },
        { id: "education", name: "Education", templateCount: 3 },
      ];
      mockRegistry.listSectors.mockReturnValue(sectors);

      const res = await request(app).get("/api/templates/sectors");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].id).toBe("healthcare");
      expect(mockRegistry.listSectors).toHaveBeenCalled();
    });
  });

  // --- GET /api/templates/summary ---

  describe("GET /api/templates/summary", () => {
    it("returns summary statistics", async () => {
      const summary = { totalTemplates: 12, sectors: 4 };
      mockRegistry.getSummary.mockReturnValue(summary);

      const res = await request(app).get("/api/templates/summary");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ totalTemplates: 12, sectors: 4 });
      expect(mockRegistry.getSummary).toHaveBeenCalled();
    });
  });

  // --- GET /api/templates/:id ---

  describe("GET /api/templates/:id", () => {
    it("returns a template by id", async () => {
      mockRegistry.getTemplate.mockReturnValue(sampleTemplate);

      const res = await request(app).get("/api/templates/tpl-healthcare-sm");

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("tpl-healthcare-sm");
      expect(res.body.name).toBe("Healthcare Starter");
      expect(mockRegistry.getTemplate).toHaveBeenCalledWith("tpl-healthcare-sm");
    });

    it("returns 404 for non-existent template", async () => {
      mockRegistry.getTemplate.mockReturnValue(null);

      const res = await request(app).get("/api/templates/nonexistent");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error");
      expect(mockRegistry.getTemplate).toHaveBeenCalledWith("nonexistent");
    });
  });
});
