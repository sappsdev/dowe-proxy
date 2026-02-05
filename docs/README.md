# Dowe Proxy

A lightweight, high-performance reverse proxy built with Bun that routes domains to compiled Bun projects via Unix sockets with automatic SSL certificate generation using certbot.

## Features

- **Domain-based routing** - Route multiple domains to different backend projects
- **Unix socket communication** - Fast, efficient inter-process communication
- **Automatic SSL** - Generate and renew SSL certificates via certbot
- **Process management** - Auto-restart crashed processes with health monitoring
- **REST API** - Full management API for domains, projects, and SSL
- **Systemd integration** - Runs as a background service

## Quick Start

### Installation (Debian/Ubuntu)

```bash
curl -fsSL https://sappsdev.github.io/dowe-proxy/install.sh | sudo bash
```

### Manual Installation

```bash
curl -fsSL https://sappsdev.github.io/dowe-proxy/KEY.gpg | sudo gpg --dearmor -o /usr/share/keyrings/dowe-proxy.gpg

echo "deb [signed-by=/usr/share/keyrings/dowe-proxy.gpg] https://sappsdev.github.io/dowe-proxy stable main" | sudo tee /etc/apt/sources.list.d/dowe-proxy.list

sudo apt update
sudo apt install dowe-proxy
```

### Post-Installation

1. Configure the proxy:

```bash
sudo nano /etc/dowe-proxy/config.env
```

2. **Important**: Change `ADMIN_API_KEY` to a secure value!

3. Start the service:

```bash
sudo systemctl start dowe-proxy
sudo systemctl status dowe-proxy
```

4. View logs:

```bash
journalctl -u dowe-proxy -f
```

## Documentation

- [API Reference](api.md) - Complete REST API documentation
- [Deployment Guide](deployment.md) - Server setup and configuration
- [Project Template](project-template.md) - How to create deployable projects

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Dowe Proxy                              │
├─────────────────────────────────────────────────────────────┤
│  HTTP :80  │  HTTPS :443  │  Admin API :8080               │
├─────────────────────────────────────────────────────────────┤
│                    Proxy Router                              │
│         (Domain → Project mapping via database)              │
├─────────────────────────────────────────────────────────────┤
│                   Process Manager                            │
│        (Spawn, monitor, restart project binaries)           │
├─────────────────────────────────────────────────────────────┤
│  Project A      │  Project B      │  Project C              │
│  (Unix Socket)  │  (Unix Socket)  │  (Unix Socket)          │
└─────────────────────────────────────────────────────────────┘
```

## License

MIT
