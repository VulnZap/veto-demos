import { useEffect, useState } from "react";
import type { AgentStatus } from "../hooks/useAgentSession";

interface StatusBarProps {
  status: AgentStatus | null;
  connected: boolean;
  error: string | null;
  done: boolean;
  success: boolean;
  startTime: number;
  onStop: () => void;
  onBack: () => void;
}

const STATE_LABELS: Record<string, string> = {
  creating_policies: "CREATING POLICIES",
  initializing: "INITIALIZING",
  running: "RUNNING",
  paused: "AWAITING APPROVAL",
  stopped: "STOPPED",
  done: "COMPLETE",
  error: "ERROR",
};

const STATE_COLORS: Record<string, string> = {
  creating_policies: "bg-orange-500",
  initializing: "bg-yellow-500",
  running: "bg-green-500",
  paused: "bg-orange-500",
  stopped: "bg-muted-foreground",
  done: "bg-blue-500",
  error: "bg-red-500",
};

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function StatusBar({
  status,
  connected,
  error,
  done,
  startTime,
  onStop,
  onBack,
  success,
}: StatusBarProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (done || error) return;
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(interval);
  }, [startTime, done, error]);

  const stateKey = status?.state ?? (connected ? "running" : "error");
  const label = STATE_LABELS[stateKey] ?? "CONNECTING";
  const dotColor = STATE_COLORS[stateKey] ?? "bg-muted-foreground";

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-card shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-mono text-[10px] font-bold">V</span>
          </div>
          <span className="text-xs font-medium hidden sm:inline">Veto</span>
        </div>

        <div className="h-3 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 ${dotColor} ${stateKey === "running" ? "animate-pulse" : ""}`}
          />
          <span className="text-[10px] font-mono font-medium tracking-wider">{label}</span>
        </div>

        {status && status.step > 0 && (
          <>
            <div className="h-3 w-px bg-border" />
            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
              Step {status.step}/{status.maxSteps}
            </span>
          </>
        )}

        <div className="h-3 w-px bg-border" />

        <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
          {formatElapsed(elapsed)}
        </span>

        {connected && (
          <>
            <div className="h-3 w-px bg-border" />
            <div className="w-1 h-1 bg-green-500 heartbeat" />
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {error && (
          <span className="text-[10px] text-red-400 font-mono mr-1 max-w-[180px] truncate">
            {error}
          </span>
        )}
        {done ? (
          <button onClick={onBack} className="btn-secondary px-2.5 py-1 text-[10px] font-medium">
            {success ? "New Session" : "Try Again"}
          </button>
        ) : (
          <button onClick={onStop} className="btn-danger px-2.5 py-1 text-[10px] font-medium">
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
