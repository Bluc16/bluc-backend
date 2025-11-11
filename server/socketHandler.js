// socketHandler.js — robust import for bad-words (works with ESM or CJS), anonymous matching + signaling
// Drop-in replacement for your current file.

let FilterClass;
try {
  // Prefer dynamic ESM import (works if package exports an ESM module)
  const mod = await import("bad-words");
  // mod could be the class itself, or an object with default or Filter property
  FilterClass = mod.default ?? mod.Filter ?? mod;
} catch (err) {
  // Fallback: try to load via require (createRequire) for CommonJS cases
  try {
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const mod2 = require("bad-words");
    FilterClass = mod2.default ?? mod2.Filter ?? mod2;
  } catch (err2) {
    // Last resort: very small simple profanity filter (no package)
    console.warn("bad-words load failed, using tiny fallback filter:", err2?.message ?? err);
    FilterClass = class {
      constructor() { this.bad = ["badword","fuck","shit"]; }
      clean(s) {
        if (!s || typeof s !== "string") return s;
        let out = String(s);
        for (const b of this.bad) {
          const re = new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          out = out.replace(re, (m) => "*".repeat(m.length));
        }
        return out;
      }
    };
  }
}

const filter = new FilterClass();

export default function socketHandler(io) {
  const clients = new Map(); // socketId => { sessionId, interests, gender, displayName }
  const waiting = []; // queue of socketIds waiting for a match

  io.on("connection", (socket) => {
    console.log("socket connected:", socket.id);

    // Anonymous join: payload { sessionId, interests, gender, displayName }
    socket.on("anonymous-join", (payload = {}) => {
      try {
        const {
          sessionId = null,
          interests = [],
          gender = "any",
          displayName = "Guest",
        } = payload;

        const normInterests = Array.isArray(interests)
          ? interests.map((i) => String(i).trim().toLowerCase()).filter(Boolean)
          : [];

        clients.set(socket.id, {
          sessionId,
          interests: normInterests,
          gender: String(gender || "any"),
          displayName: String(displayName || "Guest").trim(),
        });

        // Find partner (simple interest match or any)
        let partnerId = null;
        for (const otherId of waiting) {
          if (otherId === socket.id) continue;
          const other = clients.get(otherId);
          if (!other) continue;

          const common = normInterests.filter((x) => other.interests.includes(x));
          if (common.length > 0 || normInterests.length === 0 || other.interests.length === 0) {
            partnerId = otherId;
            break;
          }
        }

        if (partnerId) {
          const idx = waiting.indexOf(partnerId);
          if (idx !== -1) waiting.splice(idx, 1);

          socket.emit("match-found", { partnerId, partnerInfo: clients.get(partnerId) });
          io.to(partnerId).emit("match-found", { partnerId: socket.id, partnerInfo: clients.get(socket.id) });
        } else {
          if (!waiting.includes(socket.id)) waiting.push(socket.id);
          socket.emit("waiting");
        }
      } catch (err) {
        console.error("anonymous-join error:", err);
        socket.emit("error", { message: "Join failed" });
      }
    });

    // Messaging (with profanity filter + length limit)
    socket.on("send-message", (data = {}) => {
      try {
        const { to, message } = data;
        if (!to || typeof message !== "string") return;
        const trimmed = message.trim();
        if (!trimmed || trimmed.length > 2000) return;

        const clean = filter.clean(trimmed);
        io.to(to).emit("receive-message", { from: socket.id, message: clean });
      } catch (err) {
        console.error("send-message error:", err);
      }
    });

    // WebRTC signaling
    socket.on("video-offer", (data = {}) => {
      try {
        if (data.to && data.sdp) io.to(data.to).emit("video-offer", { from: socket.id, sdp: data.sdp });
      } catch (err) { console.error("video-offer error:", err); }
    });

    socket.on("video-answer", (data = {}) => {
      try {
        if (data.to && data.sdp) io.to(data.to).emit("video-answer", { from: socket.id, sdp: data.sdp });
      } catch (err) { console.error("video-answer error:", err); }
    });

    socket.on("ice-candidate", (data = {}) => {
      try {
        if (data.to && data.candidate) io.to(data.to).emit("ice-candidate", { from: socket.id, candidate: data.candidate });
      } catch (err) { console.error("ice-candidate error:", err); }
    });

    // Skip / next -> remove from waiting and tell client to rejoin
    socket.on("next", () => {
      try {
        const idx = waiting.indexOf(socket.id);
        if (idx !== -1) waiting.splice(idx, 1);
        socket.emit("rejoin");
      } catch (err) {
        console.error("next error:", err);
      }
    });

    // Cleanup on disconnect
    socket.on("disconnect", () => {
      try {
        clients.delete(socket.id);
        const idx = waiting.indexOf(socket.id);
        if (idx !== -1) waiting.splice(idx, 1);
      } catch (err) {
        console.error("disconnect cleanup error:", err);
      }
    });
  });
}
