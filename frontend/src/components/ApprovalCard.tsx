import { useEffect, useState } from "react";
import type { PendingApproval } from "../hooks/useAgentSession";

interface ApprovalCardProps {
  approval: PendingApproval;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}

function formatPauseDuration(start: number): string {
  const seconds = Math.floor((Date.now() - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function ApprovalCard({ approval, onApprove, onDeny }: ApprovalCardProps) {
  const [pauseTime, setPauseTime] = useState("0s");
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const isResolved = !!approval.resolved;

  useEffect(() => {
    if (isResolved) return;
    const update = () => {
      setPauseTime(formatPauseDuration(approval.timestamp));
      setPauseSeconds(Math.floor((Date.now() - approval.timestamp) / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [approval.timestamp, isResolved]);

  const urgencyColor =
    pauseSeconds < 30
      ? "text-orange-400"
      : pauseSeconds < 120
        ? "text-orange-300"
        : "text-red-400";

  if (isResolved) {
    const approved = approval.resolved === "approve";
    return (
      <div
        className={`border-2 p-2.5 ${
          approved
            ? "border-green-500/30 bg-green-500/5"
            : "border-red-500/30 bg-red-500/5"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium">{approval.action}</span>
          <span
            className={`ml-auto text-[10px] font-mono font-bold ${
              approved ? "text-green-400" : "text-red-400"
            }`}
          >
            {approved ? "APPROVED" : "DENIED"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-orange-500 animate-pulse-border bg-orange-500/5 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-orange-400 tracking-wider">
          AGENT PAUSED
        </span>
        <span className={`text-[10px] font-mono ${urgencyColor} tabular-nums`}>
          {pauseTime}
        </span>
      </div>

      <div className="mb-1.5">
        <span className="font-mono text-sm font-medium text-foreground">
          {approval.action}
        </span>
      </div>

      <p className="text-[10px] text-muted-foreground font-mono break-all mb-1 line-clamp-2">
        {JSON.stringify(approval.args).slice(0, 120)}
      </p>

      <p className="text-[10px] text-red-400/80 mb-3">{approval.reason}</p>

      <div className="flex gap-2">
        <button
          onClick={() => onApprove(approval.id)}
          className="btn-primary flex-1 px-3 py-2 text-xs font-bold text-primary-foreground tracking-wider"
        >
          APPROVE
        </button>
        <button
          onClick={() => onDeny(approval.id)}
          className="btn-danger flex-1 px-3 py-2 text-xs font-bold tracking-wider"
        >
          DENY
        </button>
      </div>

      <div className="flex items-center justify-center gap-3 mt-2 text-[9px] font-mono text-muted-foreground/50">
        <span>Enter = approve</span>
        <span>Esc = deny</span>
      </div>
    </div>
  );
}
