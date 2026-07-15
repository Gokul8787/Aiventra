"use client";

import { useState } from "react";

export function AIReplayButton({ promptId }: { promptId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function replayPrompt() {
    try {
      setLoading(true);
      setMessage(null);

      const response = await fetch(`/api/ai/prompts/${promptId}/replay`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Prompt replay failed.");
      }

      setMessage("Replay saved to AI history.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Replay failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        onClick={replayPrompt}
        disabled={loading}
        className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold hover:bg-cyan-500 disabled:opacity-50"
      >
        {loading ? "Replaying..." : "Replay Prompt"}
      </button>

      {message && <p className="mt-2 text-xs text-slate-400">{message}</p>}
    </div>
  );
}
