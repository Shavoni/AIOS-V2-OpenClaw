# Skills Reference — Installed Capabilities

> 11 skill directories, 9 active skills with SKILL.md definitions

## Active Skills

| Skill | Domain | Description | Trigger |
|-------|--------|-------------|---------|
| **afrexai-business-automation** | Business | Turn AI agent into a business automation architect. Design, document, implement, and monitor automated workflows across sales, ops, finance, HR, support. | `/afrexai-business-automation` |
| **deepwiki** | Research | Query and analyze GitHub repository documentation via DeepWiki's research API. Ask questions, browse wiki structure, read specific doc pages. | `ask`, `structure`, `contents` |
| **gog** | Content | Game and content integration for GOG (Good Old Games) platform. Browse, search, and manage game library. | Library management, catalog browsing |
| **project-context-sync** | DevOps | Keep a living PROJECT_STATE.md updated after each commit so any agent instantly knows project status. Post-commit hook integration. | `install`, `uninstall`, `update-context` |
| **railway-skill** | Deployment | Deploy and manage applications on Railway.app — zero-config deployments for services, databases, domains, and environments. | `login`, `up`, `logs`, `variables`, `ssh`, `add` |
| **s3** | Storage | S3-compatible object storage with security, lifecycle policies, presigned URLs, versioning, multipart uploads, CORS. | Bucket management, presigned URLs |
| **sec-filing-watcher** | Finance | Monitor SEC EDGAR for new filings from a ticker watchlist. Notify via Telegram/Slack summaries through Clawdbot. | Watchlist management, start/stop monitoring |
| **slack** | Communication | Send messages, manage channels, interact with Slack workspaces for team communication, notifications, workflow alerts. | Post messages, DM, list channels, read history |
| **tailscale** | Networking | Manage Tailscale VPN — configure exit nodes, manage ACLs, monitor network status for secure device connectivity. | `up`, `status`, `ping`, `file cp`, `dns status` |

## Empty / Placeholder Skills

| Skill | Status |
|-------|--------|
| **senior-devops** | Directory exists, no files |
| **ssh-essentials** | Directory exists, no files |

## Skill File Structure

Each skill follows this pattern:
```
skills/<skill-name>/
├── .clawdhub/          # Marketplace metadata
├── SKILL.md            # Skill definition (name, description, commands)
├── _meta.json          # Version, author, tags
├── scripts/            # Executable scripts (optional)
├── templates/          # Output templates (optional)
└── README.md           # Documentation (optional)
```

## Cross-Venture Skill Usage

| Venture | Relevant Skills |
|---------|----------------|
| Cleveland Municipal AI | railway-skill (deploy), tailscale (VPN), slack (notifications) |
| Virtual Closet | s3 (media storage), afrexai (business automation) |
| April Parker Foundation | slack (team comms), project-context-sync (project state) |
| HAAIS | deepwiki (research), sec-filing-watcher (finance intel) |
| General Development | senior-devops (pending), ssh-essentials (pending) |
