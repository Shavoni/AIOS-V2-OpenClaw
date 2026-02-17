# Changelog

All notable changes to AIOS V2 will be documented in this file.

## [0.2.0] - 2026-02-17

### Added
- Express server scaffolding (server.js, src/app.js)
- Health check endpoint (`/health`)
- System metrics endpoint (`/api/metrics`)
- MongoDB connection with Mongoose
- OpenClaw gateway performance tuning (fallback chain optimization)
- Claude Code CLI sub-agent integration for OpenClaw
- Project documentation (README, CONTRIBUTING, CHANGELOG)
- ESLint configuration
- Test framework setup with Jest
- `.env.example` for environment configuration
- `.gitignore` for node_modules and logs

### Fixed
- OpenClaw gateway crash (missing npm module after Node.js upgrade)
- Gateway version mismatch (2026.2.14 to 2026.2.15)
- Removed dead AnythingLLM provider from fallback chains
- Cleaned invalid plugin entries causing config validation spam

## [0.1.0] - 2026-02-16

### Added
- Initial workspace structure
- Agent configuration (Scotty-5, reasoning, coding, research)
- OpenClaw skills (deepwiki, senior-devops, s3, tailscale, etc.)
- Product Requirements Document (PRD.md)
- Development roadmap (PROJECT_PLAN.md)
- Build plan (AIOS-V2.md)
- Agent memory system
