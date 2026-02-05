# Project Template

Guide to creating projects that work with Dowe Proxy.

## Requirements

Projects deployed to Dowe Proxy must:

1. Be compiled Bun binaries for Linux
2. Listen on a Unix socket (path provided via environment variable)
3. Respond to health checks at `/health`

## Basic Template

```typescript
const socketPath = process.env.SOCKET_PATH;

if (!socketPath) {
  console.error("SOCKET_PATH environment variable required");
  process.exit(1);
}

Bun.serve({
  unix: socketPath,
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    return new Response("Hello from Dowe Proxy!", {
      headers: { "Content-Type": "text/html" },
    });
  },
});

console.log(`Server listening on ${socketPath}`);
```

## Full Example with Routing

```typescript
const socketPath = process.env.SOCKET_PATH;

if (!socketPath) {
  console.error("SOCKET_PATH environment variable required");
  process.exit(1);
}

Bun.serve({
  unix: socketPath,

  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method;

    if (url.pathname === "/health") {
      return Response.json({ status: "healthy", timestamp: Date.now() });
    }

    if (url.pathname === "/" && method === "GET") {
      return new Response(renderHomePage(), {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (url.pathname === "/api/data" && method === "GET") {
      return Response.json({ message: "Hello API!" });
    }

    if (url.pathname === "/api/data" && method === "POST") {
      const body = await request.json();
      return Response.json({ received: body });
    }

    return new Response("Not Found", { status: 404 });
  },
});

function renderHomePage(): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>My App</title>
    </head>
    <body>
      <h1>Welcome to My App</h1>
      <p>Running on Dowe Proxy</p>
    </body>
    </html>
  `;
}

console.log(`Server listening on ${socketPath}`);
```

## Building for Deployment

### For x64 Servers (Intel/AMD)

```bash
bun build ./app.ts --compile --target=bun-linux-x64 --outfile my-app
```

### For ARM64 Servers (Raspberry Pi, AWS Graviton)

```bash
bun build ./app.ts --compile --target=bun-linux-arm64 --outfile my-app
```

## Environment Variables

Your project receives these environment variables:

| Variable      | Description                   |
| ------------- | ----------------------------- |
| `SOCKET_PATH` | Unix socket path to listen on |

You can also use your own environment variables by setting them in your project configuration.

## Uploading to Server

```bash
curl -X POST http://your-server:8080/api/projects \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "name=my-app" \
  -F "binary=@./my-app"
```

## Testing Locally

Create a test script to simulate the proxy environment:

```bash
#!/bin/bash
export SOCKET_PATH=/tmp/test-app.sock
./my-app &
APP_PID=$!

sleep 1

curl --unix-socket /tmp/test-app.sock http://localhost/health

kill $APP_PID
rm /tmp/test-app.sock
```

## Best Practices

### 1. Always Implement Health Check

The proxy uses `/health` to monitor your application:

```typescript
if (url.pathname === "/health") {
  return new Response("OK", { status: 200 });
}
```

### 2. Handle Graceful Shutdown

```typescript
process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  server.stop();
  process.exit(0);
});
```

### 3. Log Important Events

```typescript
console.log(`[${new Date().toISOString()}] Server started on ${socketPath}`);
```

### 4. Handle Errors

```typescript
Bun.serve({
  unix: socketPath,
  error(error) {
    console.error("Server error:", error);
    return new Response("Internal Server Error", { status: 500 });
  },
  fetch(request) {
    // ...
  },
});
```

## Debugging

### Check if Socket Exists

```bash
ls -la /tmp/dowe-proxy/
```

### Test Socket Directly

```bash
curl --unix-socket /tmp/dowe-proxy/PROJECT_ID.sock http://localhost/health
```

### View Project Logs

```bash
journalctl -u dowe-proxy | grep "project-name"
```
