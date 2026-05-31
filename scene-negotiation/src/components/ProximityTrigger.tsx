import { useEffect } from "react";
import { sceneParams } from "../config/sceneConfig";
import { useGameStore } from "../systems/GameStateManager";
import { endNpcConversation, startNpcConversation } from "../systems/PipecatConnection";

async function startConversation() {
  try {
    await startNpcConversation();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Microphone permission denied";
    useGameStore.getState().setMicActive(false, message);
    useGameStore.getState().setPlayerSpeaking(false);
  }
}

function endConversation() {
  void endNpcConversation();
}

export function ProximityTrigger() {
  const distanceToDealer = useGameStore((state) => state.gameState.player.distance_to_dealer);
  const conversationActive = useGameStore((state) => state.gameState.conversation.is_active);
  const canTalk = distanceToDealer <= sceneParams.interactionDistance;

  useEffect(() => {
    useGameStore.getState().setPromptVisible(canTalk && !conversationActive);
  }, [canTalk, conversationActive]);

  useEffect(() => {
    if (conversationActive && distanceToDealer > sceneParams.conversationEndDistance) {
      endConversation();
    }
  }, [conversationActive, distanceToDealer]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.code !== "KeyE" && event.code !== "Enter")) return;
      const state = useGameStore.getState().gameState;
      if (state.conversation.is_active) {
        endConversation();
        return;
      }
      if (state.player.distance_to_dealer <= sceneParams.interactionDistance) {
        void startConversation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null;
}
