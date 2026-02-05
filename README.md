# Dowe Proxy

Bun-based reverse proxy with automatic SSL via certbot.

## Features

- Routes domains to compiled Bun projects via Unix sockets
- Automatic SSL certificate generation with certbot
- REST API for domain/project management
- Auto-restart on crash with health monitoring

## Install on Debian/Ubuntu

### Quick Install

```bash
curl -fsSL https://dowe-dev.github.io/dowe-proxy/install.sh | sudo bash
```

### Manual Install

```bash
curl -fsSL https://dowe-dev.github.io/dowe-proxy/KEY.gpg | sudo gpg --dearmor -o /usr/share/keyrings/dowe-proxy.gpg

echo "deb [signed-by=/usr/share/keyrings/dowe-proxy.gpg] https://dowe-dev.github.io/dowe-proxy/apt stable main" | sudo tee /etc/apt/sources.list.d/dowe-proxy.list

sudo apt update
sudo apt install dowe-proxy
```

### Post-Installation

1. Edit configuration:

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

## Development

```bash
bun install
bun run dev
```

## Release

Create a new release by tagging:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will automatically:

1. Build Linux binaries (x64 + arm64)
2. Create .deb packages
3. Publish APT repository to GitHub Pages
4. Create GitHub Release with binaries

## API Usage

### Add a Domain

```bash
curl -X POST http://localhost:8080/api/domains \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"hostname": "example.com", "projectId": "project-id"}'
```

### Upload a Project

```bash
bun build ./my-app.ts --compile --target=bun-linux-x64 --outfile my-app

curl -X POST http://localhost:8080/api/projects \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "name=my-app" \
  -F "binary=@./my-app"
```

### Generate SSL Certificate

```bash
curl -X POST http://localhost:8080/api/ssl/example.com/generate \
  -H "X-API-Key: YOUR_API_KEY"
```

## Project Template

Deployed projects must listen on Unix socket:

```typescript
Bun.serve({
  unix: process.env.SOCKET_PATH,
  fetch(req) {
    if (new URL(req.url).pathname === "/health") {
      return new Response("OK");
    }
    return new Response("Hello World!");
  },
});
```

## Configuration

| Variable        | Default                  | Description            |
| --------------- | ------------------------ | ---------------------- |
| `ADMIN_API_KEY` | -                        | API authentication key |
| `HTTP_PORT`     | 80                       | HTTP port              |
| `HTTPS_PORT`    | 443                      | HTTPS port             |
| `ADMIN_PORT`    | 8080                     | Admin API port         |
| `DATA_DIR`      | /var/lib/dowe-proxy/data | Data directory         |
| `CERTBOT_PATH`  | /usr/bin/certbot         | Certbot path           |

## License

MIT
