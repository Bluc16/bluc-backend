import express from "express";
import { v4 as uuidv4 } from "uuid";
const router = express.Router();
const sessions = new Map();

router.post("/create", (req, res) => {
  const { displayName = "Guest", gender = "any", interests = [] } = req.body || {};
  const sessionId = uuidv4();
  sessions.set(sessionId, { displayName, gender, interests, createdAt: Date.now() });
  return res.json({ sessionId, displayName, gender, interests });
});

router.get("/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ message: "Not found" });
  res.json(s);
});

export default router;
