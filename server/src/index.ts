import { Encoder } from "@colyseus/schema";
import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";

Encoder.BUFFER_SIZE = 64 * 1024;
import { monitor } from "@colyseus/monitor";
import express from "express";
import cors from "cors";
import http from "http";
import dotenv from "dotenv";
import { GameRoom } from "./rooms/GameRoom";

dotenv.config();

const port = parseInt(process.env.PORT || "2567");
const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/rooms/find/:code", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const rooms = await matchMaker.query({ name: "game", private: false });
  const match = rooms.find((r) => r.metadata?.roomCode === code);
  if (match) {
    res.json({ roomId: match.roomId });
  } else {
    res.status(404).json({ error: "room not found" });
  }
});

// Colyseus monitor (dev only)
if (process.env.NODE_ENV !== "production") {
  app.use("/colyseus", monitor());
}

const server = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
    maxPayload: 2000000,
  }),
});

// Register room types
gameServer.define("game", GameRoom);

gameServer.listen(port).then(() => {
  console.log(`Scribble Fighters server listening on port ${port}`);
  console.log(`   Monitor: http://localhost:${port}/colyseus`);
});
