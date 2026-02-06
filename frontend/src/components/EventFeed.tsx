import type { Decision, PendingApproval } from "../hooks/useAgentSession";
import { ApprovalCard } from "./ApprovalCard";

interface EventFeedProps {
  decisions: Decision[];
  pendingApprovals: PendingApproval[];
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}

function DecisionRow({ decision }: { decision: Decision }) {
  const isAllowed = decision.decision === "allow";

  return (
    <div className="animate-slide-in flex items-stretch gap-0 bg-card border border-border overflow-hidden">
      <div className={`w-1 shrink-0 ${isAllowed ? "bg-green-500" : "bg-red-500"}`} />
      <div className="flex-1 px-2.5 py-2 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-foreground">
            {decision.action}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/60 uppercase">
            {decision.mode}
          </span>
          <span className="ml-auto flex items-center gap-2 shrink-0">
            <span
              className={`font-mono text-[10px] tabular-nums ${
                decision.latencyMs < 50
                  ? "text-green-400"
                  : decision.latencyMs < 200
                    ? "text-yellow-400"
                    : "text-red-400"
              }`}
            >
              {decision.latencyMs}ms
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-px ${
                isAllowed
                  ? "bg-green-500/10 text-green-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {isAllowed ? "ALLOW" : "DENY"}
            </span>
          </span>
        </div>
        {decision.args && Object.keys(decision.args).length > 0 && (
          <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
            {formatArgs(decision.args)}
          </p>
        )}
        {!isAllowed && decision.reason && (
          <p className="text-[10px] text-red-400/70 truncate mt-0.5">{decision.reason}</p>
        )}
      </div>
    </div>
  );
}

function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "";
  return entries
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(", ")
    .slice(0, 100);
}

export function EventFeed({
  decisions,
  pendingApprovals,
  onApprove,
  onDeny,
}: EventFeedProps) {
  const unresolvedApprovals = pendingApprovals.filter((a) => !a.resolved);
  const resolvedApprovals = pendingApprovals.filter((a) => a.resolved);
  const total = decisions.length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border bg-surface-elevated flex items-center justify-between shrink-0">
        <span className="text-[10px] font-mono font-bold tracking-[0.15em] text-muted-foreground">
          DECISIONS
        </span>
        {total > 0 && (
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
            {total}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {unresolvedApprovals.map((a) => (
          <ApprovalCard
            key={a.id}
            approval={a}
            onApprove={onApprove}
            onDeny={onDeny}
          />
        ))}
        {resolvedApprovals.map((a) => (
          <ApprovalCard
            key={a.id}
            approval={a}
            onApprove={onApprove}
            onDeny={onDeny}
          />
        ))}
        {decisions.map((d) => (
          <DecisionRow key={d.id} decision={d} />
        ))}
        {total === 0 && unresolvedApprovals.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <div className="w-2 h-2 bg-primary boot-pulse" />
            <span className="text-xs text-muted-foreground font-mono">
              Waiting for actions...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
