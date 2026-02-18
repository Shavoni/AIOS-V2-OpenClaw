---
name: tailscale
description: Manage Tailscale VPN network — connect devices, configure exit nodes, manage ACLs, and monitor network status.
metadata: {"openclaw":{"emoji":"🔗"}}
---

# Tailscale

Manage your Tailscale VPN network for secure device connectivity.

## Authentication

```bash
# Login (opens browser)
tailscale up

# Login with auth key (headless)
tailscale up --authkey=tskey-auth-XXXX

# Check login status
tailscale status

# Logout
tailscale logout
```

## Network Status

```bash
# Show all devices and their status
tailscale status

# Show current device IP
tailscale ip

# Show IPv4 only
tailscale ip -4

# Show IPv6 only
tailscale ip -6

# Ping a device
tailscale ping <device-name-or-ip>
```

## Exit Nodes

```bash
# Use a device as exit node
tailscale up --exit-node=<device-name-or-ip>

# Stop using exit node
tailscale up --exit-node=

# Advertise this device as exit node
tailscale up --advertise-exit-node
```

## File Transfer

```bash
# Send file to a device
tailscale file cp <file> <device-name>:

# Receive files (check default receive directory)
tailscale file get <output-directory>
```

## DNS

```bash
# Check DNS status
tailscale dns status

# Use MagicDNS (enabled by default)
# Access devices by name: device-name.tailnet-name.ts.net
```

## Common Workflows

### Connect Two Machines

```bash
# On both machines:
tailscale up

# Check connectivity:
tailscale ping <other-device>

# SSH to other device (if SSH is enabled):
ssh user@<device-name>
```

### Share a Device

```bash
# Share with another user
tailscale share <device> <user@email>
```

## Notes

- Always use `tailscale` CLI (not API) for local operations
- Tailscale runs as a system service on Windows
- MagicDNS allows accessing devices by hostname
- ACL changes require admin access to the Tailscale admin console
- Use `127.0.0.1` not `localhost` for local service access
