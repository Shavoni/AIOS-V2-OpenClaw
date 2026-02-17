# Contributing to AIOS V2

Thank you for your interest in contributing to AIOS V2.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/AIOS-V2-OpenClaw.git`
3. Create a feature branch: `git checkout -b feature/your-feature`
4. Install dependencies: `npm install`
5. Copy environment config: `cp .env.example .env`

## Development Workflow

1. Write tests first (TDD) — see `tests/` directory
2. Implement your changes
3. Run the test suite: `npm test`
4. Ensure linting passes: `npm run lint`
5. Commit with a clear message describing the change

## Commit Messages

Use clear, descriptive commit messages:

```
Add user authentication middleware
Fix rate limiter reset after window expires
Update agent fallback chain configuration
```

## Pull Request Process

1. Update documentation if your change affects the API or configuration
2. Ensure all tests pass
3. Update CHANGELOG.md with your changes
4. Submit a PR against the `master` branch
5. Include a description of what changed and why

## Code Standards

- **Style**: Follow ESLint configuration in the project
- **Testing**: Maintain >80% test coverage
- **Comments**: Document public APIs with JSDoc
- **Security**: No API keys, tokens, or secrets in code — use `.env`

## Reporting Issues

Open an issue at [GitHub Issues](https://github.com/Shavoni/AIOS-V2-OpenClaw/issues) with:
- Description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
