# API Reference

Dowe Proxy provides a REST API for managing domains, projects, processes, and SSL certificates.

## Authentication

All API requests require the `X-API-Key` header with your configured API key.

```bash
curl http://your-server:8080/api/domains \
  -H "X-API-Key: YOUR_API_KEY"
```

## Base URL

```
http://your-server:8080/api
```

---

## Health Check

### GET /api/health

Check if the proxy is running.

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptime": 12345
  }
}
```

---

## Domains

### GET /api/domains

List all configured domains.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "hostname": "example.com",
      "projectId": "project-id",
      "sslEnabled": true,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET /api/domains/:id

Get a specific domain by ID.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "hostname": "example.com",
    "projectId": "project-id",
    "sslEnabled": true
  }
}
```

### POST /api/domains

Create a new domain mapping.

**Request Body:**

```json
{
  "hostname": "example.com",
  "projectId": "project-id"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "hostname": "example.com",
    "projectId": "project-id"
  }
}
```

### PUT /api/domains/:id

Update a domain.

**Request Body:**

```json
{
  "hostname": "new-domain.com",
  "projectId": "new-project-id"
}
```

### DELETE /api/domains/:id

Delete a domain mapping.

**Response:**

```json
{
  "success": true
}
```

---

## Projects

### GET /api/projects

List all projects.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "project-id",
      "name": "my-app",
      "binaryPath": "/var/lib/dowe-proxy/projects/my-app",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET /api/projects/:id

Get a specific project.

### POST /api/projects

Upload and create a new project.

**Request:** `multipart/form-data`

| Field    | Type   | Description                                  |
| -------- | ------ | -------------------------------------------- |
| `name`   | string | Project name (alphanumeric, hyphens allowed) |
| `binary` | file   | Compiled Bun binary for Linux                |

**Example:**

```bash
curl -X POST http://your-server:8080/api/projects \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "name=my-app" \
  -F "binary=@./my-app-linux"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "project-id",
    "name": "my-app",
    "binaryPath": "/var/lib/dowe-proxy/projects/my-app"
  }
}
```

### DELETE /api/projects/:id

Delete a project and stop its process.

---

## Processes

### GET /api/processes

List all running processes.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "projectId": "project-id",
      "pid": 12345,
      "socketPath": "/tmp/dowe-proxy/project-id.sock",
      "status": "running"
    }
  ]
}
```

### POST /api/processes/:projectId/start

Start a project's process.

**Response:**

```json
{
  "success": true,
  "data": {
    "pid": 12345,
    "socketPath": "/tmp/dowe-proxy/project-id.sock"
  }
}
```

### POST /api/processes/:projectId/stop

Stop a project's process.

### POST /api/processes/:projectId/restart

Restart a project's process.

---

## SSL Certificates

### POST /api/ssl/:hostname/generate

Generate an SSL certificate for a domain using certbot.

**Requirements:**

- Domain must be configured and pointing to this server
- Port 80 must be accessible for ACME challenge
- certbot must be installed

**Example:**

```bash
curl -X POST http://your-server:8080/api/ssl/example.com/generate \
  -H "X-API-Key: YOUR_API_KEY"
```

**Response:**

```json
{
  "success": true,
  "data": {
    "hostname": "example.com",
    "sslEnabled": true,
    "certPath": "/etc/letsencrypt/live/example.com/fullchain.pem"
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes

| Code | Description                               |
| ---- | ----------------------------------------- |
| 200  | Success                                   |
| 400  | Bad Request - Invalid input               |
| 401  | Unauthorized - Invalid or missing API key |
| 404  | Not Found - Resource doesn't exist        |
| 500  | Internal Server Error                     |
