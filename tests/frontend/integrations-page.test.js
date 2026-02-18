/**
 * RED → GREEN — Integrations Page
 * Tests the IntegrationsPage frontend component structure.
 */

const fs = require("fs");
const path = require("path");

describe("Integrations Page", () => {
  const pagePath = path.join(__dirname, "../../public/js/pages/integrations.js");
  const cssPath = path.join(__dirname, "../../public/css/pages/integrations.css");
  const mainPath = path.join(__dirname, "../../public/js/main.js");
  const sidebarPath = path.join(__dirname, "../../public/js/components/sidebar.js");
  const indexPath = path.join(__dirname, "../../public/index.html");

  it("should have an IntegrationsPage class exported", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("export class IntegrationsPage");
  });

  it("should render a gradient header with page title", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("page-gradient-header");
    expect(content).toContain("Integrations");
  });

  it("should render stat cards for connector metrics", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("stat-card");
    expect(content).toContain("stat-value");
  });

  it("should have a search input and filter chips toolbar", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("search");
    expect(content).toContain("filter-chip");
  });

  it("should render connector cards in a grid", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("integrations-grid");
    expect(content).toContain("connector-card");
  });

  it("should have Add Connector button that opens a form", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("Add Connector");
  });

  it("should show status badges on connector cards", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("badge");
    expect(content).toContain("status");
  });

  it("should have connector card CSS styles", () => {
    const content = fs.readFileSync(cssPath, "utf-8");
    expect(content).toContain(".connector-card");
    expect(content).toContain(".integrations-grid");
  });

  it("should have the integrations route registered in main.js", () => {
    const content = fs.readFileSync(mainPath, "utf-8");
    expect(content).toContain("IntegrationsPage");
    expect(content).toContain("/integrations");
  });

  it("should have Integrations nav item in the sidebar", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain("Integrations");
    expect(content).toContain("/integrations");
  });

  it("should link integrations.css in index.html", () => {
    const content = fs.readFileSync(indexPath, "utf-8");
    expect(content).toContain("integrations.css");
  });
});
