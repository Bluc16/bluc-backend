// src/App.jsx
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

// backend URL
const backend = import.meta.env.VITE_BACKEND_URL || "https://bluc-backend.onrender.com";

// Auto session creator
function AutoStart() {
  const navigate = useNavigate();

  useEffect(() => {
    const existing = localStorage.getItem("sessionId");
    if (existing) {
      navigate("/video");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${backend}/api/session/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: "Guest", interests: [] }),
        });
        const data = await res.json();
        localStorage.setItem("sessionId", data.sessionId);
        navigate("/video");
      } catch (err) {
        console.error("session create failed", err);
        navigate("/video");
      }
    })();
  }, [navigate]);

  return <div>Starting chat...</div>;
}

// Simple video chat page
function VideoPage() {
  useEffect(() => {
    const sessionId = localStorage.getItem("sessionId");
    const socket = io(backend);

    socket.on("connect", () => {
      socket.emit("anonymous-join", { sessionId, interests: [], displayName: "Guest" });
    });

    socket.on("waiting", () => console.log("Waiting for partner..."));
    socket.on("match-found", (data) => console.log("Matched:", data));

    return () => socket.disconnect();
  }, []);

  return (
    <div style={{ textAlign: "center", padding: "50px" }}>
      <h2>Anonymous Video Chat</h2>
      <p>Connecting you to a random partner...</p>
    </div>
  );
}

// App Router
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AutoStart />} />
        <Route path="/video" element={<VideoPage />} />
      </Routes>
    </BrowserRouter>
  );
}
