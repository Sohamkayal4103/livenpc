import { useMemo } from "react";
import { useGameStore } from "../systems/GameStateManager";

const statusLabels = {
  connected: "Backend connected",
  connecting: "Connecting backend",
  disconnected: "Backend disconnected",
  error: "Backend disconnected",
};

export function HUD() {
  const gameState = useGameStore((state) => state.gameState);
  const backend = useGameStore((state) => state.backend);
  const hud = useGameStore((state) => state.hud);

  const dealer = gameState.npcs.find((npc) => npc.role === "dealer");
  const npcSummary = useMemo(
    () =>
      gameState.npcs.map((npc) => ({
        id: npc.id,
        label: `${npc.name} ${npc.disposition}`,
        active: npc.is_speaking || npc.animation_state === "aggressive",
      })),
    [gameState.npcs],
  );

  return (
    <div className="hud">
      <div className="hudTop">
        <div className={`connection ${backend.status}`}>
          <span className="connectionDot" />
          {statusLabels[backend.status]}
        </div>
        {/*
          Debug tension meter. Uncomment this block if we want the demo/debug HUD back.
          <div className="tensionBox" aria-label="Scene tension">
            <span>Tension</span>
            <div className="tensionTrack">
              <div
                className="tensionFill"
                style={{ width: `${Math.round(gameState.scene.tension_level * 100)}%` }}
              />
            </div>
          </div>
        */}
      </div>

      {/*
        Debug NPC disposition panel. Uncomment this block if we want the demo/debug HUD back.
        <div className="npcPanel">
          {npcSummary.map((npc) => (
            <div key={npc.id} className={npc.active ? "npcPill active" : "npcPill"}>
              {npc.label}
            </div>
          ))}
        </div>
      */}

      <div className="hudBottom">
        {hud.promptVisible ? <div className="prompt">Press E to talk</div> : null}
        {gameState.conversation.is_active ? (
          <div className="conversationCard">
            <div className={hud.micActive ? "micLive active" : "micLive"}>
              <span className="micDot" />
              {hud.micActive ? "Live mic" : "Mic inactive"}
            </div>
            <div className="conversationMeta">
              {dealer ? `${dealer.name} ${gameState.player.distance_to_dealer.toFixed(1)}m` : ""}
            </div>
          </div>
        ) : null}
        {hud.micError ? <div className="warning">{hud.micError}</div> : null}
        {hud.subtitle ? <div className="subtitle">{hud.subtitle}</div> : null}
      </div>
    </div>
  );
}
