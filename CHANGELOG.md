# Changelog

All notable changes to AIOS V2 will be documented in this file.

## [0.2.0] - 2026-02-19

### Added
- **Skills CRUD API** — 7 REST endpoints (`GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`, `POST /:id/upload`, `POST /:id/execute`) via `src/skills/routes.js`
- **SkillEngine CRUD methods** — `createSkill()`, `updateSkill()`, `deleteSkill()`, `importSkill()` with gray-matter frontmatter generation and path traversal protection
- **Skills frontend UI** — "New Skill" and "Upload Skill" buttons, tabbed create/edit modal, file upload dialog, delete confirmation, edit/delete buttons in detail panel
- **27 new tests** — skills engine-crud (13), skills routes (10), registry unregister (1), frontend API client (3) — 816 total tests across 79 suites

### Fixed
- **DB Migration System** — 3-phase `initSchema()` (tables → ALTER TABLE migrations → indexes) fixes server startup crash on existing databases missing new columns (`is_deleted`, `source_type`, etc.)
- **Rate Limiter** — Removed custom `keyGenerator` causing `ERR_ERL_KEY_GEN_IPV6` crash in research routes

## [0.1.0] - 2026-02-15

### Added
- Initial OpenClaw workspace setup
- Agent identity (Scotty-5) configured via SOUL.md, IDENTITY.md
- 11 skills installed (DevOps, S3, business automation, deep research, etc.)
- Memory system with OpenAI embeddings
- Architecture research completed (security, onboarding, AI integration, metrics, feedback, enterprise customization)

## [0.0.1] - 2025-01-21

### Added
- Project initialized
- Initial AIOS V1 analysis and V2 planning
