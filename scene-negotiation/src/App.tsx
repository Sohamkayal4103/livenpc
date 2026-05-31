import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import { HUD } from "./components/HUD";
import { PhonePanel } from "./components/PhonePanel";
import { Scene } from "./components/Scene";
import { selectTextSnapshot, useGameStore } from "./systems/GameStateManager";
import { endNpcConversation } from "./systems/PipecatConnection";

export default function App() {
  useEffect(() => {
    // Audio + state now run over Pipecat (see systems/PipecatConnection.ts);
    // the connection is established lazily when the player starts a conversation.
    useGameStore.getState().setBackendStatus("disconnected");

    window.render_game_to_text = () =>
      JSON.stringify(selectTextSnapshot(useGameStore.getState().gameState));
    window.advanceTime = async (ms: number) => {
      window.dispatchEvent(new CustomEvent("codex-advance-time", { detail: { ms } }));
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const step = (now: number) => {
          if (now - start >= ms) {
            resolve();
            return;
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      return window.render_game_to_text?.() ?? "{}";
    };

    return () => {
      void endNpcConversation();
      delete window.render_game_to_text;
      delete window.advanceTime;
    };
  }, []);

  return (
    <div className="appShell">
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ position: [0, 3, 11], fov: 52, near: 0.1, far: 80 }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <HUD />
      <PhonePanel />
    </div>
  );
}
