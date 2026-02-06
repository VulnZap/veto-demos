import type { Stats } from "../hooks/useAgentSession";

interface StatsBarProps {
  stats: Stats;
}

function Sparkline({ latencies }: { latencies: number[] }) {
  if (latencies.length < 2) return null;
  const max = Math.max(...latencies, 1);
  const w = 100;
  const h = 16;
  const step = w / (latencies.length - 1);
  const points = latencies.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="opacity-50">
      <polyline
        points={points}
        fill="none"
        stroke="#f97316"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StatsBar({ stats }: StatsBarProps) {
  const total = stats.allowed + stats.denied;

  return (
    <div className="flex items-center justify-between px-3 py-1 border-t border-border bg-card text-[10px] font-mono shrink-0 h-7">
      {total === 0 ? (
        <span className="text-muted-foreground/50">No validations yet</span>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Validated</span>
              <span className="text-foreground font-medium tabular-nums">{total}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500" />
              <span className="text-green-400 tabular-nums">{stats.allowed}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-red-500" />
              <span className="text-red-400 tabular-nums">{stats.denied}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Sparkline latencies={stats.latencies} />
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">avg</span>
              <span
                className={`font-medium tabular-nums ${
                  stats.avgLatency < 50
                    ? "text-green-400"
                    : stats.avgLatency < 200
                      ? "text-primary"
                      : "text-red-400"
                }`}
              >
                {stats.avgLatency}ms
              </span>
            </div>
            {stats.minLatency !== Infinity && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">min</span>
                <span className="text-foreground/70 tabular-nums">{stats.minLatency}ms</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">max</span>
              <span className="text-foreground/70 tabular-nums">{stats.maxLatency}ms</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
