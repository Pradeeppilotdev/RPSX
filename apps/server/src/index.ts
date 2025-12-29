import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Server } from "socket.io";
import { createServer } from "http";
import { setupSocketIO } from "./websocket/socket";
import { setupRoutes } from "./api/routes";
import { initDB } from "./db/init";
import { startBatchSettler } from "./services/batchSettler";

const app = new Hono();

// CORS
app.use("*", cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// API routes
setupRoutes(app);

// Create HTTP server
const server = createServer((req, res) => {
  app.fetch(req, res);
});

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
});

setupSocketIO(io);

// Initialize database
await initDB();

// Start batch settler
startBatchSettler();

const port = Number(process.env.PORT) || 3001;
server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📡 WebSocket ready`);
  console.log(`💾 Database connected`);
});

