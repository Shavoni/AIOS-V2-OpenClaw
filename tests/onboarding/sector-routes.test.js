/**
 * Tests for new onboarding sector routes:
 *   GET /sectors
 *   PUT /wizards/:id/sector
 *   POST /start with sector param
 */

const express = require("express");
const request = require("supertest");
const { createOnboardingRoutes } = require("../../src/onboarding/routes");

describe("Onboarding Sector Routes", () => {
  let app;

  const sampleSectors = [
    { id: "healthcare", name: "Healthcare", icon: "heart-pulse", order: 3, templateCount: 7 },
    { id: "education", name: "Education", icon: "graduation-cap", order: 2, templateCount: 5 },
    { id: "government", name: "Government", icon: "building-columns", order: 1, templateCount: 4 },
  ];

  const sampleWizard = {
    id: "abc123",
    organization_name: "Test Org",
    organization_type: "healthcare",
    step: "init",
    departments: [],
  };

  const mockWizard = {
    listSectors: jest.fn(),
    setSector: jest.fn(),
    startWizard: jest.fn(),
    listWizards: jest.fn(),
    getWizard: jest.fn(),
    deleteWizard: jest.fn(),
    runDiscovery: jest.fn(),
    applyDiscoveryResult: jest.fn(),
    matchTemplates: jest.fn(),
    selectTemplate: jest.fn(),
    updateDepartment: jest.fn(),
    bulkUpdateDepartments: jest.fn(),
    generatePreview: jest.fn(),
    approveChecklistItem: jest.fn(),
    deploy: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use("/api/onboarding", createOnboardingRoutes(mockWizard));
  });

  // --- GET /api/onboarding/sectors ---

  describe("GET /sectors", () => {
    it("returns sectors from wizard.listSectors()", async () => {
      mockWizard.listSectors.mockReturnValue(sampleSectors);

      const res = await request(app).get("/api/onboarding/sectors");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].id).toBe("healthcare");
      expect(res.body[0].templateCount).toBe(7);
      expect(mockWizard.listSectors).toHaveBeenCalled();
    });

    it("returns empty array when no template registry", async () => {
      mockWizard.listSectors.mockReturnValue([]);

      const res = await request(app).get("/api/onboarding/sectors");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // --- PUT /api/onboarding/wizards/:id/sector ---

  describe("PUT /wizards/:id/sector", () => {
    it("sets sector on wizard", async () => {
      const updatedWizard = { ...sampleWizard, organization_type: "education" };
      mockWizard.setSector.mockReturnValue(updatedWizard);

      const res = await request(app)
        .put("/api/onboarding/wizards/abc123/sector")
        .send({ sector: "education" });

      expect(res.status).toBe(200);
      expect(res.body.organization_type).toBe("education");
      expect(mockWizard.setSector).toHaveBeenCalledWith("abc123", "education");
    });

    it("returns 400 when sector is missing", async () => {
      const res = await request(app)
        .put("/api/onboarding/wizards/abc123/sector")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "sector is required");
      expect(mockWizard.setSector).not.toHaveBeenCalled();
    });

    it("returns 400 when sector is empty string", async () => {
      const res = await request(app)
        .put("/api/onboarding/wizards/abc123/sector")
        .send({ sector: "" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "sector is required");
    });
  });

  // --- POST /api/onboarding/start with sector ---

  describe("POST /start with sector", () => {
    it("passes sector to startWizard", async () => {
      mockWizard.startWizard.mockReturnValue(sampleWizard);

      const res = await request(app)
        .post("/api/onboarding/start")
        .send({
          organizationName: "Test Hospital",
          websiteUrl: "https://test.hospital.org",
          organizationType: "healthcare",
          sector: "healthcare",
        });

      expect(res.status).toBe(200);
      expect(mockWizard.startWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationName: "Test Hospital",
          sector: "healthcare",
        })
      );
    });

    it("works without sector (backward compat)", async () => {
      mockWizard.startWizard.mockReturnValue(sampleWizard);

      const res = await request(app)
        .post("/api/onboarding/start")
        .send({
          organizationName: "Test Org",
          websiteUrl: "https://test.org",
          organizationType: "municipal",
        });

      expect(res.status).toBe(200);
      expect(mockWizard.startWizard).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationName: "Test Org",
          organizationType: "municipal",
          sector: undefined,
        })
      );
    });
  });
});
