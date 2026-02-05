const socketPath = process.env.SOCKET_PATH || "/tmp/my-project.sock";
const projectId = process.env.PROJECT_ID || "unknown";

const server = Bun.serve({
  unix: socketPath,
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    return new Response(`Hello from project ${projectId}!`, {
      headers: { "Content-Type": "text/plain" },
    });
  },
});

console.log(`Project ${projectId} listening on ${socketPath}`);
