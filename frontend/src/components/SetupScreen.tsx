import { useState } from "react";

const TASKS = [
  {
    id: "flights",
    label: "Search flights NYC to Tokyo",
    detail: "Find the cheapest option across airlines",
    task: "Search for flights from NYC to Tokyo and find the cheapest option",
  },
  {
    id: "headphones",
    label: "Find headphones on Amazon",
    detail: "Best-rated wireless under $100",
    task: "Go to Amazon and find the best-rated wireless headphones under $100",
  },
  {
    id: "research",
    label: "Research AI safety papers",
    detail: "Browse arxiv.org for latest work",
    task: "Research the latest AI safety papers on arxiv.org",
  },
  {
    id: "custom",
    label: "Custom task",
    detail: "Describe what the agent should do",
    task: "",
  },
];

interface SetupScreenProps {
  onStart: (config: {
    vetoApiKey: string;
    vetoServerUrl: string;
    llmModel: "claude-sonnet-4.5" | "claude-opus-4.5";
    task: string;
    autoCreatePolicies: boolean;
  }) => Promise<void>;
}

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [vetoApiKey, setVetoApiKey] = useState("");
  const [llmModel, setLlmModel] = useState<"claude-sonnet-4.5" | "claude-opus-4.5">(
    "claude-sonnet-4.5"
  );
  const [vetoServerUrl, setVetoServerUrl] = useState("https://api.runveto.com");
  const [selectedTask, setSelectedTask] = useState("flights");
  const [customTask, setCustomTask] = useState("");
  const [autoCreatePolicies, setAutoCreatePolicies] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const task =
    selectedTask === "custom"
      ? customTask
      : TASKS.find((t) => t.id === selectedTask)?.task ?? "";

  const canSubmit = vetoApiKey && task && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      await onStart({
        vetoApiKey,
        vetoServerUrl,
        llmModel,
        task,
        autoCreatePolicies,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg animate-in">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary mb-4">
            <span className="text-primary-foreground font-mono text-lg font-bold">V</span>
          </div>
          <h1 className="text-section font-medium mb-2">Veto Demo</h1>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Watch an AI agent control a live browser while Veto validates every action in real time.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Veto API Key</label>
              <a
                href="https://runveto.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Get a key
              </a>
            </div>
            <input
              type="password"
              value={vetoApiKey}
              onChange={(e) => setVetoApiKey(e.target.value)}
              placeholder="veto_sk_..."
              required
              className="w-full px-3 py-2.5 bg-card border border-border text-foreground text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Claude Model</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLlmModel("claude-sonnet-4.5")}
                className={`text-left px-3 py-2.5 border transition-colors ${
                  llmModel === "claude-sonnet-4.5"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-border-subtle"
                }`}
              >
                <span className="block text-xs font-medium">Claude Sonnet 4.5</span>
                <span className="block text-xs text-muted-foreground mt-0.5">Fast and recommended</span>
              </button>
              <button
                type="button"
                onClick={() => setLlmModel("claude-opus-4.5")}
                className={`text-left px-3 py-2.5 border transition-colors ${
                  llmModel === "claude-opus-4.5"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-border-subtle"
                }`}
              >
                <span className="block text-xs font-medium">Claude Opus 4.5</span>
                <span className="block text-xs text-muted-foreground mt-0.5">Stronger reasoning</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Task</label>
            <div className="grid grid-cols-2 gap-2">
              {TASKS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTask(t.id)}
                  className={`text-left px-3 py-2.5 border transition-colors ${
                    selectedTask === t.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-border-subtle"
                  }`}
                >
                  <span className="block text-xs font-medium truncate">{t.label}</span>
                  <span className="block text-xs text-muted-foreground truncate mt-0.5">
                    {t.detail}
                  </span>
                </button>
              ))}
            </div>
            {selectedTask === "custom" && (
              <textarea
                value={customTask}
                onChange={(e) => setCustomTask(e.target.value)}
                placeholder="Describe what the agent should do..."
                rows={2}
                required
                className="w-full mt-2 px-3 py-2.5 bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors resize-none"
              />
            )}
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCreatePolicies}
              onChange={(e) => setAutoCreatePolicies(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm text-muted-foreground">
              Auto-create demo policies
            </span>
          </label>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className={`inline-block transition-transform ${showAdvanced ? "rotate-90" : ""}`}>
              &#9654;
            </span>
            Advanced
          </button>

          {showAdvanced && (
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">
                Veto Server URL
              </label>
              <input
                type="url"
                value={vetoServerUrl}
                onChange={(e) => setVetoServerUrl(e.target.value)}
                className="w-full px-3 py-2 bg-card border border-border text-foreground text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          )}

          {error && (
            <div className="px-3 py-2.5 border border-red-500/30 bg-red-500/5 text-red-400 text-xs font-mono">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary w-full px-4 py-3 text-sm font-bold tracking-wide text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white animate-spin inline-block" />
                Launching...
              </span>
            ) : (
              "Launch Agent"
            )}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground/50 mt-8">
          Model provider credentials stay server-side while Veto evaluates and tunes model behavior.
        </p>
      </div>
    </div>
  );
}
