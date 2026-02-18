# Contributing to AIOS V2

## Getting Started

1. Clone the repository
2. Run `npm install`
3. Copy `.env.example` to `.env` and configure your keys
4. Run `npm run dev` to start in development mode

## Development Workflow

- Use TDD: write tests first, then implementation
- Run `npm test` before submitting changes
- Run `npm run lint` to check code style
- Keep commits focused and descriptive

## Code Standards

- JavaScript (ES2021+) with ESLint
- Test coverage target: >80%
- Document all public APIs
- Use 127.0.0.1 instead of localhost for local services

## Project Structure

- `server.js` — Express API entry point
- `src/` — Application source code
- `tests/` — Jest test suite
- `skills/` — OpenClaw skill modules
- `memory/` — Agent memory and context files

## Questions

Open an issue or reach out to Shavoni directly.
