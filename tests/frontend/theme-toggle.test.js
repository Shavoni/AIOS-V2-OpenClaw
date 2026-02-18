/**
 * RED → GREEN — Theme Toggle UI in Sidebar
 * Tests the theme toggle button integration in the sidebar.
 */

const fs = require("fs");
const path = require("path");

describe("Theme Toggle in Sidebar", () => {
  it("should have a theme toggle button in the sidebar HTML", () => {
    const sidebarPath = path.join(__dirname, "../../public/js/components/sidebar.js");
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain("theme-toggle");
  });

  it("should import ThemeManager in the sidebar", () => {
    const sidebarPath = path.join(__dirname, "../../public/js/components/sidebar.js");
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain("theme-manager");
  });

  it("should have Light/Dark Mode labels for the toggle", () => {
    const sidebarPath = path.join(__dirname, "../../public/js/components/sidebar.js");
    const content = fs.readFileSync(sidebarPath, "utf-8");
    // Should contain both light and dark mode references for toggling
    expect(content).toContain("Light Mode");
    expect(content).toContain("Dark Mode");
  });

  it("should wire toggle click to ThemeManager.toggle()", () => {
    const sidebarPath = path.join(__dirname, "../../public/js/components/sidebar.js");
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain(".toggle()");
  });

  it("should pass ThemeManager through the app or instantiate it", () => {
    const mainPath = path.join(__dirname, "../../public/js/main.js");
    const content = fs.readFileSync(mainPath, "utf-8");
    expect(content).toContain("ThemeManager");
  });
});
