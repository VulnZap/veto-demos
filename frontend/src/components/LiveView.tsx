import { useRef, useEffect, useCallback } from "react";
import type { useAgentSession, Decision } from "../hooks/useAgentSession";
import { playSound } from "../lib/sound";
import { StatusBar } from "./StatusBar";
import { DesktopView } from "./DesktopView";
import { EventFeed } from "./EventFeed";
import { StatsBar } from "./StatsBar";

type SessionReturn = ReturnType<typeof useAgentSession>;

interface LiveViewProps {
  session: SessionReturn;
  onBack: () => void;
}

export function LiveView({ session, onBack }: LiveViewProps) {
  const startTimeRef = useRef(Date.now());
  const prevDecisionCountRef = useRef(0);
  const prevApprovalCountRef = useRef(0);
  const hasPendingApproval = session.pendingApprovals.some((a) => !a.resolved);
  const firstUnresolvedId = session.pendingApprovals.find((a) => !a.resolved)?.id;

  useEffect(() => {
    const count = session.decisions.length;
    if (count > prevDecisionCountRef.current && count > 0) {
      const latest = session.decisions[0] as Decision | undefined;
      if (latest?.decision === "allow") playSound("allow");
      else if (latest) playSound("deny");
    }
    prevDecisionCountRef.current = count;
  }, [session.decisions]);

  useEffect(() => {
    const count = session.pendingApprovals.filter((a) => !a.resolved).length;
    if (count > prevApprovalCountRef.current) {
      playSound("alert");
    }
    prevApprovalCountRef.current = count;
  }, [session.pendingApprovals]);

  const handleApprove = useCallback(
    (id: string) => {
      playSound("click");
      session.approve(id);
    },
    [session],
  );

  const handleDeny = useCallback(
    (id: string) => {
      playSound("click");
      session.deny(id);
    },
    [session],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!firstUnresolvedId) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Enter") {
        e.preventDefault();
        handleApprove(firstUnresolvedId);
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleDeny(firstUnresolvedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [firstUnresolvedId, handleApprove, handleDeny]);

  return (
    <div className="h-screen flex flex-col">
      <StatusBar
        status={session.status}
        connected={session.connected}
        error={session.error}
        done={session.done}
        success={session.success}
        startTime={startTimeRef.current}
        onStop={session.stop}
        onBack={onBack}
      />

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative">
          <DesktopView
            lastDecision={session.lastDecision}
            hasPendingApproval={hasPendingApproval}
          />
        </div>
        <div className="w-[340px] flex flex-col min-h-0 border-l border-border">
          <EventFeed
            decisions={session.decisions}
            pendingApprovals={session.pendingApprovals}
            onApprove={handleApprove}
            onDeny={handleDeny}
          />
        </div>
      </div>

      <StatsBar stats={session.stats} />
    </div>
  );
}
