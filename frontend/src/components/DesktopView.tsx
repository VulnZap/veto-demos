import { useEffect, useState, useRef } from "react";
import type { Decision } from "../hooks/useAgentSession";

interface DesktopViewProps {
  lastDecision: Decision | null;
  hasPendingApproval: boolean;
}

export function DesktopView({ lastDecision, hasPendingApproval }: DesktopViewProps) {
  const [flashKey, setFlashKey] = useState(0);
  const [flashType, setFlashType] = useState<"allow" | "deny" | null>(null);
  const [showStamp, setShowStamp] = useState(false);
  const [shaking, setShaking] = useState(false);
  const prevDecisionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastDecision || lastDecision.id === prevDecisionRef.current) return;
    prevDecisionRef.current = lastDecision.id;

    setFlashType(lastDecision.decision);
    setFlashKey((k) => k + 1);

    if (lastDecision.decision === "deny") {
      setShowStamp(true);
      setShaking(true);
      const t1 = setTimeout(() => setShowStamp(false), 1800);
      const t2 = setTimeout(() => setShaking(false), 500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [lastDecision]);

  const vncUrl = `/vnc/vnc_lite.html?autoconnect=true&resize=scale&view_only=true&path=vnc/websockify&show_dot=false&logging=warn`;

  return (
    <div
      className={`relative w-full h-full ${hasPendingApproval ? "approval-glow" : ""} ${shaking ? "screen-shake" : ""}`}
    >
      <iframe
        src={vncUrl}
        className="absolute inset-0 w-full h-full border-0"
        title="Live Desktop"
      />

      <div className="scanlines absolute inset-0 pointer-events-none" />

      {flashType === "deny" && (
        <div
          key={`deny-${flashKey}`}
          className="deny-flash absolute inset-0 bg-red-500/20"
        />
      )}

      {flashType === "allow" && (
        <div
          key={`allow-${flashKey}`}
          className="allow-pulse absolute inset-0"
        />
      )}

      {showStamp && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="animate-stamp">
            <div className="text-red-500 font-mono text-[4rem] font-black border-[6px] border-red-500 px-8 py-3 tracking-[0.2em] select-none stamp-text">
              VETOED
            </div>
          </div>
        </div>
      )}

      {hasPendingApproval && (
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      )}
    </div>
  );
}
