import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import build from "../colony-build.json";

export const Route = createFileRoute("/")({ component: Colony });

function Colony() {
  useEffect(() => {
    // The Vite entry owns the simulation DOM. It must only execute in a browser.
    if (document.getElementById("colony-runtime")) return;
    const entry = document.createElement("script");
    entry.id = "colony-runtime";
    entry.type = "module";
    entry.src = build.script;
    entry.onload = () => document.getElementById("colony-loading")?.remove();
    entry.onerror = () => {
      const message = document.getElementById("colony-loading");
      if (message) message.textContent = "The colony could not load. Please refresh this page.";
    };
    document.head.append(entry);
  }, []);
  return (
    <main id="experience" aria-label="Interactive ant colony observatory">
      <div id="scene" />
      <div id="labels" aria-hidden="true" />
      <div id="ui" />
      <p id="colony-loading" role="status" style={{ position: "absolute", inset: "45% 0 auto", textAlign: "center", color: "#f0ead8" }}>Entering the colony…</p>
      <noscript>This interactive colony needs JavaScript and a browser with WebGL. The lifecycle is illustrative; the excavation archive contains measured grain positions and removal records.</noscript>
    </main>
  );
}
