---
name: deepwiki
description: Query and analyze GitHub repository documentation via DeepWiki's research API. Ask questions, browse wiki structure, and read specific documentation pages.
metadata: {"openclaw":{"emoji":"📚"}}
---

# DeepWiki

Query GitHub repository documentation using DeepWiki's MCP-based research API.

## Commands

### Ask a Question
Ask a question about a GitHub repository and get an AI-powered, context-grounded response.
```bash
node ./scripts/deepwiki.js ask <owner/repo> "your question"
```

### Read Wiki Structure
Get a list of documentation topics for a GitHub repository.
```bash
node ./scripts/deepwiki.js structure <owner/repo>
```

### Read Wiki Contents
View documentation about a specific path in a GitHub repository's wiki.
```bash
node ./scripts/deepwiki.js contents <owner/repo> <path>
```

## Examples

**Ask about Devin's MCP usage:**
```bash
node ./scripts/deepwiki.js ask cognitionlabs/devin "How do I use MCP?"
```

**Get the structure for the React docs:**
```bash
node ./scripts/deepwiki.js structure facebook/react
```

## Notes
- Base Server: `https://mcp.deepwiki.com/mcp`
- Works for public repositories only.
- No authentication required.
