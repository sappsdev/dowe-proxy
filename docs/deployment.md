# Deployment Guide

Complete guide to deploying Dowe Proxy on Debian/Ubuntu servers.

## Requirements

- Debian 11+ or Ubuntu 20.04+
- Root or sudo access
- Ports 80, 443, and 8080 available
- Domain names pointing to server IP (for SSL)

## Installation

### Quick Install

```bash
curl -fsSL https://sappsdev.github.io/dowe-proxy/install.sh | sudo bash
```

### Manual Install

```bash
curl -fsSL https://sappsdev.github.io/dowe-proxy/KEY.gpg | sudo gpg --dearmor -o /usr/share/keyrings/dowe-proxy.gpg

echo "deb [signed-by=/usr/share/keyrings/dowe-proxy.gpg] https://sappsdev.github.io/dowe-proxy stable main" | sudo tee /etc/apt/sources.list.d/dowe-proxy.list

sudo apt update
sudo apt install dowe-proxy
```

## Configuration

Configuration file: `/etc/dowe-proxy/config.env`

```bash
sudo nano /etc/dowe-proxy/config.env
```

### Configuration Options

| Variable          | Default                    | Description                          |
| ----------------- | -------------------------- | ------------------------------------ |
| `ADMIN_API_KEY`   | `change-me-to-secure-key`  | **Required**: API authentication key |
| `HTTP_PORT`       | `80`                       | HTTP server port                     |
| `HTTPS_PORT`      | `443`                      | HTTPS server port                    |
| `ADMIN_PORT`      | `8080`                     | Admin API port                       |
| `DATA_DIR`        | `/var/lib/dowe-proxy/data` | Database storage directory           |
| `SOCKETS_DIR`     | `/tmp/dowe-proxy`          | Unix sockets directory               |
| `CERTBOT_PATH`    | `/usr/bin/certbot`         | Path to certbot binary               |
| `LETSENCRYPT_DIR` | `/etc/letsencrypt/live`    | Let's Encrypt certificates directory |
| `LOG_LEVEL`       | `info`                     | Log level (debug, info, warn, error) |

### Security Configuration

**Important:** Change the API key before starting:

```bash
ADMIN_API_KEY=your-secure-random-key-here
```

Generate a secure key:

```bash
openssl rand -base64 32
```

## Service Management

### Start/Stop/Restart

```bash
sudo systemctl start dowe-proxy
sudo systemctl stop dowe-proxy
sudo systemctl restart dowe-proxy
```

### Check Status

```bash
sudo systemctl status dowe-proxy
```

### View Logs

```bash
journalctl -u dowe-proxy -f
journalctl -u dowe-proxy --since "1 hour ago"
```

### Enable on Boot

```bash
sudo systemctl enable dowe-proxy
```

## Directory Structure

```
/usr/bin/dowe-proxy              # Binary
/etc/dowe-proxy/config.env       # Configuration
/etc/systemd/system/dowe-proxy.service  # Systemd unit
/var/lib/dowe-proxy/
├── data/                        # Database files
└── projects/                    # Uploaded project binaries
/tmp/dowe-proxy/                 # Unix sockets
/etc/letsencrypt/live/           # SSL certificates
```

## Firewall Configuration

### UFW (Ubuntu)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8080/tcp  # Admin API (consider restricting to specific IPs)
```

### iptables

```bash
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
```

## Deploying a Project

### 1. Build Your Project

On your development machine:

```bash
bun build ./my-app.ts --compile --target=bun-linux-x64 --outfile my-app
```

### 2. Upload Project

```bash
curl -X POST http://your-server:8080/api/projects \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "name=my-app" \
  -F "binary=@./my-app"
```

### 3. Create Domain Mapping

```bash
curl -X POST http://your-server:8080/api/domains \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"hostname": "example.com", "projectId": "PROJECT_ID_FROM_STEP_2"}'
```

### 4. Start the Project

```bash
curl -X POST http://your-server:8080/api/processes/PROJECT_ID/start \
  -H "X-API-Key: YOUR_API_KEY"
```

### 5. Generate SSL Certificate

```bash
curl -X POST http://your-server:8080/api/ssl/example.com/generate \
  -H "X-API-Key: YOUR_API_KEY"
```

## Troubleshooting

### Service Won't Start

Check logs:

```bash
journalctl -u dowe-proxy -n 50
```

Check configuration:

```bash
cat /etc/dowe-proxy/config.env
```

### Port Already in Use

Check what's using the port:

```bash
sudo lsof -i :80
sudo lsof -i :443
```

### SSL Certificate Generation Fails

1. Ensure domain DNS points to server IP
2. Check port 80 is accessible from internet
3. Verify certbot is installed: `which certbot`

### Project Won't Start

Check project logs:

```bash
journalctl -u dowe-proxy | grep "project-name"
```

Verify binary is executable:

```bash
ls -la /var/lib/dowe-proxy/projects/
```

## Updating

```bash
sudo apt update
sudo apt upgrade dowe-proxy
sudo systemctl restart dowe-proxy
```

## Uninstalling

```bash
sudo apt remove dowe-proxy
sudo rm -rf /var/lib/dowe-proxy
sudo rm -rf /etc/dowe-proxy
sudo rm /etc/apt/sources.list.d/dowe-proxy.list
sudo rm /usr/share/keyrings/dowe-proxy.gpg
```
