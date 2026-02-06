import { useState, useEffect, useCallback, useRef } from "react";

export interface Decision {
  id: string;
  action: string;
  args: Record<string, unknown>;
  decision: "allow" | "deny";
  reason?: string;
  latencyMs: number;
  mode: string;
  timestamp: number;
}

export interface PendingApproval {
  id: string;
  action: string;
  args: Record<string, unknown>;
  reason: string;
  timestamp: number;
  resolved?: "approve" | "deny";
}

export interface AgentStatus {
  step: number;
  maxSteps: number;
  state: "creating_policies" | "initializing" | "running" | "paused" | "stopped" | "done" | "error";
}

export interface Stats {
  allowed: number;
  denied: number;
  totalLatency: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  latencies: number[];
}

interface SessionConfig {
  vetoApiKey: string;
  vetoServerUrl: string;
  llmModel: "claude-sonnet-4.5" | "claude-opus-4.5";
  task: string;
  autoCreatePolicies: boolean;
}

interface AgentSessionState {
  sessionId: string | null;
  connected: boolean;
  decisions: Decision[];
  pendingApprovals: PendingApproval[];
  status: AgentStatus | null;
  error: string | null;
  done: boolean;
  success: boolean;
  stats: Stats;
  lastDecision: Decision | null;
}

const EMPTY_STATS: Stats = {
  allowed: 0,
  denied: 0,
  totalLatency: 0,
  avgLatency: 0,
  minLatency: Infinity,
  maxLatency: 0,
  latencies: [],
};

export function useAgentSession() {
  const [state, setState] = useState<AgentSessionState>({
    sessionId: null,
    connected: false,
    decisions: [],
    pendingApprovals: [],
    status: null,
    error: null,
    done: false,
    success: false,
    stats: EMPTY_STATS,
    lastDecision: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const decisionCounterRef = useRef(0);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const handleEvent = useCallback((msg: { type: string; data: Record<string, unknown> }) => {
    const { type, data } = msg;

    switch (type) {
      case "decision": {
        const id = `decision-${++decisionCounterRef.current}`;
        const decision: Decision = {
          id,
          action: data.action as string,
          args: data.args as Record<string, unknown>,
          decision: data.decision as "allow" | "deny",
          reason: data.reason as string | undefined,
          latencyMs: data.latencyMs as number,
          mode: data.mode as string,
          timestamp: Date.now(),
        };
        setState((s) => {
          const latency = decision.latencyMs;
          const newLatencies = [...s.stats.latencies.slice(-49), latency];
          const total = s.stats.totalLatency + latency;
          const count = s.stats.allowed + s.stats.denied + 1;
          return {
            ...s,
            decisions: [decision, ...s.decisions],
            lastDecision: decision,
            stats: {
              allowed: s.stats.allowed + (decision.decision === "allow" ? 1 : 0),
              denied: s.stats.denied + (decision.decision === "deny" ? 1 : 0),
              totalLatency: total,
              avgLatency: Math.round(total / count),
              minLatency: Math.min(s.stats.minLatency, latency),
              maxLatency: Math.max(s.stats.maxLatency, latency),
              latencies: newLatencies,
            },
          };
        });
        break;
      }

      case "approval_needed":
        setState((s) => ({
          ...s,
          pendingApprovals: [
            {
              id: data.id as string,
              action: data.action as string,
              args: data.args as Record<string, unknown>,
              reason: data.reason as string,
              timestamp: Date.now(),
            },
            ...s.pendingApprovals,
          ],
        }));
        break;

      case "approval_resolved":
        setState((s) => ({
          ...s,
          pendingApprovals: s.pendingApprovals.map((a) =>
            a.id === data.id
              ? { ...a, resolved: data.decision as "approve" | "deny" }
              : a
          ),
        }));
        break;

      case "status":
        setState((s) => ({
          ...s,
          status: {
            step: data.step as number,
            maxSteps: data.maxSteps as number,
            state: data.state as AgentStatus["state"],
          },
        }));
        break;

      case "done":
        setState((s) => ({
          ...s,
          done: true,
          success: data.success as boolean,
          status: s.status ? { ...s.status, state: "done" } : null,
        }));
        break;

      case "error":
        setState((s) => ({
          ...s,
          error: data.message as string,
          status: s.status ? { ...s.status, state: "error" } : null,
        }));
        break;
    }
  }, []);

  const startSession = useCallback(async (config: SessionConfig) => {
    cleanup();

    setState((s) => ({
      ...s,
      error: null,
      done: false,
      success: false,
      decisions: [],
      pendingApprovals: [],
      status: null,
      stats: EMPTY_STATS,
      lastDecision: null,
    }));

    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: config.task,
        vetoApiKey: config.vetoApiKey,
        vetoBaseUrl: config.vetoServerUrl,
        llmModel: config.llmModel,
        useDemoPolicies: config.autoCreatePolicies,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: "Failed to start session" }));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }

    const { sessionId } = await res.json();

    setState((s) => ({ ...s, sessionId }));

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((s) => ({ ...s, connected: true }));
    };

    ws.onclose = () => {
      setState((s) => ({ ...s, connected: false }));
    };

    ws.onerror = () => {
      setState((s) => ({ ...s, error: "WebSocket connection failed" }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleEvent(msg);
    };

    return sessionId;
  }, [cleanup, handleEvent]);

  const approve = useCallback(async (approvalId: string) => {
    if (!state.sessionId) return;
    await fetch(`/api/session/${state.sessionId}/approve/${approvalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
  }, [state.sessionId]);

  const deny = useCallback(async (approvalId: string) => {
    if (!state.sessionId) return;
    await fetch(`/api/session/${state.sessionId}/approve/${approvalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deny" }),
    });
  }, [state.sessionId]);

  const stop = useCallback(async () => {
    if (!state.sessionId) return;
    await fetch(`/api/session/${state.sessionId}/stop`, {
      method: "POST",
    });
  }, [state.sessionId]);

  const reset = useCallback(() => {
    cleanup();
    decisionCounterRef.current = 0;
    setState({
      sessionId: null,
      connected: false,
      decisions: [],
      pendingApprovals: [],
      status: null,
      error: null,
      done: false,
      success: false,
      stats: EMPTY_STATS,
      lastDecision: null,
    });
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return {
    ...state,
    startSession,
    approve,
    deny,
    stop,
    reset,
  };
}
