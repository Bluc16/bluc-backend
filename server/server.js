import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";

import sessionRoutes from "./routes/sessionRoutes.js";
import socketHandler from "./socketHandler.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || process.env.VITE_CLIENT_URL || "*",
    credentials: true,
  },
});

app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL || process.env.VITE_CLIENT_URL || "*", credentials: true }));

const limiter = rateLimit({ windowMs: 10000, max: 20 });
app.use(limiter);

app.use("/api/session", sessionRoutes);
app.get("/health", (req, res) => res.json({ ok: true }));

socketHandler(io);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

