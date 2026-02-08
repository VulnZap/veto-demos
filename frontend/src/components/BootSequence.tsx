import { useEffect, useState, useRef } from "react";
import type { AgentStatus } from "../hooks/useAgentSession";
import { playSound } from "../lib/sound";
import { VetoLogo } from "./VetoLogo";

interface BootStep {
  label: string;
  state: "pending" | "active" | "done";
  timeMs?: number;
}

interface BootSequenceProps {
  status: AgentStatus | null;
  connected: boolean;
  error: string | null;
  onReady: () => void;
}

function mapStatusToSteps(
  connected: boolean,
  status: AgentStatus | null,
): BootStep[] {
  const states: BootStep["state"][] = ["pending", "pending", "pending", "pending"];
  const labels = ["Connecting to Veto", "Creating policies", "Launching browser", "Agent active"];

  if (!connected) {
    states[0] = "active";
  } else if (!status) {
    states[0] = "done";
    states[1] = "active";
  } else if (status.state === "creating_policies") {
    states[0] = "done";
    states[1] = "active";
  } else if (status.state === "initializing") {
    states[0] = "done";
    states[1] = "done";
    states[2] = "active";
  } else if (status.state === "running") {
    states[0] = "done";
    states[1] = "done";
    states[2] = "done";
    states[3] = "done";
  } else {
    states[0] = "done";
    states[1] = "done";
    states[2] = "active";
  }

  return labels.map((label, i) => ({ label, state: states[i] ?? "pending" }));
}

export function BootSequence({ status, connected, error, onReady }: BootSequenceProps) {
  const steps = mapStatusToSteps(connected, status);
  const allDone = steps.every((s) => s.state === "done");
  const prevDoneCountRef = useRef(0);
  const [timers, setTimers] = useState<Record<number, number>>({});
  const startTimesRef = useRef<Record<number, number>>({});

  useEffect(() => {
    const doneCount = steps.filter((s) => s.state === "done").length;
    if (doneCount > prevDoneCountRef.current) {
      playSound("boot");
      const justCompleted = doneCount - 1;
      const start = startTimesRef.current[justCompleted];
      if (start) {
        setTimers((t) => ({ ...t, [justCompleted]: Date.now() - start }));
      }
    }
    prevDoneCountRef.current = doneCount;

    steps.forEach((step, i) => {
      if (step.state === "active" && !startTimesRef.current[i]) {
        startTimesRef.current[i] = Date.now();
      }
    });
  }, [steps]);

  useEffect(() => {
    if (allDone) {
      const t = setTimeout(onReady, 600);
      return () => clearTimeout(t);
    }
  }, [allDone, onReady]);

  const doneCount = steps.filter((s) => s.state === "done").length;
  const progress = (doneCount / steps.length) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-8">
          <VetoLogo size={48} />
        </div>

        <div className="text-center mb-8">
          <span className="text-xs font-mono tracking-[0.3em] text-muted-foreground">
            INITIALIZING
          </span>
        </div>

        <div className="space-y-3 mb-8">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 transition-opacity duration-300 ${
                step.state === "pending" ? "opacity-30" : "opacity-100"
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {step.state === "done" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" className="text-primary">
                    <path
                      d="M2 7l3.5 3.5L12 3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="square"
                    />
                  </svg>
                ) : step.state === "active" ? (
                  <div className="w-2 h-2 bg-primary boot-pulse" />
                ) : (
                  <div className="w-2 h-2 border border-border" />
                )}
              </div>
              <span
                className={`text-sm font-mono flex-1 ${
                  step.state === "done"
                    ? "text-foreground"
                    : step.state === "active"
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
              {step.state === "done" && timers[i] !== undefined && (
                <span className="text-xs font-mono text-muted-foreground">
                  {timers[i] < 1000 ? `${timers[i]}ms` : `${(timers[i] / 1000).toFixed(1)}s`}
                </span>
              )}
              {step.state === "active" && (
                <span className="text-xs font-mono text-muted-foreground boot-dots">...</span>
              )}
            </div>
          ))}
        </div>

        <div className="h-0.5 bg-border overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {error && (
          <div className="mt-6 px-3 py-2 border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
