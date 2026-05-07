# ATLAS Custom GPT Changelog

## [1.1.0] - 2026-05-06
### Added
*   `structured_data/`: Created 5 new machine-queryable CSV/JSON files (pro_tariffs, withholding_tax, visa_matrix, payment_rails, pilot_venues).
*   `actions/openapi_spec.yaml`: Added OpenAPI specification for live FX rates and flight pricing integration.
*   `tier1_strategic_foundation/00_glossary.md`: Added single source of truth for terminology.
*   `tier1_strategic_foundation/battle_cards.md`: Added competitor rebuttals.
*   `tier1_strategic_foundation/objection_handling.md`: Added top 10 VC objections.
*   `tier1_strategic_foundation/pitch_templates.md`: Added pre-formatted pitch outlines.
*   `tier4_platform_architecture/contract_skeletons.md`: Added base legal templates for RAG injection.
*   `tier5_operations_gtm_and_implementation/personas.md`: Added 4 core buyer personas.
*   `tier1_strategic_foundation/sources.md`: Added bibliography and verification dates.
*   `evals/`: Added a test suite with 15 prompt evaluations to prevent regressions.

### Changed
*   `instructions.txt`: Completely rewritten to enforce strict retrieval protocols, output templates, and GPT Actions usage.
*   Removed empty `tier5_operations_gtm/` directory.

## [1.0.0] - 2026-05-06
*   Initial release of the 20-file ATLAS knowledge base for Kendall Robbins.
