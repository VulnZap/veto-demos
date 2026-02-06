import { useState, useEffect, useCallback } from "react";
import { useAgentSession } from "./hooks/useAgentSession";
import { SetupScreen } from "./components/SetupScreen";
import { BootSequence } from "./components/BootSequence";
import { LiveView } from "./components/LiveView";

type AppState = "setup" | "booting" | "live";

export default function App() {
  const [appState, setAppState] = useState<AppState>("setup");
  const session = useAgentSession();

  const handleStart = async (config: {
    vetoApiKey: string;
    vetoServerUrl: string;
    llmModel: "claude-sonnet-4.5" | "claude-opus-4.5";
    task: string;
    autoCreatePolicies: boolean;
  }) => {
    await session.startSession(config);
    setAppState("booting");
  };

  const handleBootReady = useCallback(() => {
    setAppState("live");
  }, []);

  const handleBack = () => {
    session.reset();
    setAppState("setup");
  };

  useEffect(() => {
    if (appState === "booting" && session.error) {
      // Stay on boot screen to show error
    }
  }, [appState, session.error]);

  if (appState === "setup") {
    return <SetupScreen onStart={handleStart} />;
  }

  if (appState === "booting") {
    return (
      <BootSequence
        status={session.status}
        connected={session.connected}
        error={session.error}
        onReady={handleBootReady}
      />
    );
  }

  return <LiveView session={session} onBack={handleBack} />;
}
