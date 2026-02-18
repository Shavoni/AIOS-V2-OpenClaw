---
name: slack
description: Send messages, manage channels, and interact with Slack workspaces. Use for team communication, notifications, and workflow alerts.
metadata: {"openclaw":{"emoji":"💬"}}
---

# Slack

Send messages and manage Slack workspace interactions.

## Authentication

Requires a Slack Bot Token (`xoxb-...`) with appropriate scopes:
- `chat:write` — Send messages
- `channels:read` — List channels
- `channels:history` — Read channel history
- `users:read` — Look up users

## Sending Messages

```bash
curl.exe -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": "C0XXXXXX", "text": "Hello from Scotty-5!"}'
```

## Common Operations

- **Post to channel**: Send notifications, alerts, reports
- **DM a user**: Direct messages for private notifications
- **List channels**: Find the right channel for a message
- **Read history**: Check recent messages in a channel

## Notes

- Always use `curl.exe` on Windows (not `curl`)
- Rate limits apply: ~1 message per second per channel
- Bot must be invited to a channel before posting
