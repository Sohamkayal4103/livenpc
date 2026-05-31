# Street Negotiation Scene

GTA-style hackathon demo scene built with Vite, React, TypeScript, React Three Fiber, drei, Three.js, and Zustand.

## Run

```bash
npm install
npm run dev -- --host 127.0.0.1
```

The backend URL defaults to `ws://localhost:8765`. To connect immediately on page load:

```bash
VITE_BACKEND_AUTOCONNECT=true npm run dev -- --host 127.0.0.1
```

Without a backend, the scene remains fully navigable and the HUD shows `Backend disconnected`.

## Controls

- `W/A/S/D` or arrow keys: move
- Mouse click: lock camera look
- Mouse movement: rotate camera while locked
- `E`: start or end dealer conversation when close
- `Esc`: release pointer lock
- `F`: fullscreen

## Backend Contract

Outbound messages:

- `game_state_update`
- `conversation_start`
- `conversation_end`
- `player_audio`

Inbound messages:

- `npc_audio`
- `npc_action`
- `tension_override`
- `subtitle`

The exact game-state shape lives in `src/types/GameState.ts`.

## Characters

Characters are routed through `src/components/characters/GameCharacter.tsx`.

- If `src/config/characterConfig.ts` points a role to a `.glb`, the scene uses the rigged GLB path.
- If a role has `null`, it falls back to the procedural humanoid in `Humanoid.tsx`.

The current demo uses `public/models/characters/soldier.glb`, an animated Three.js example GLB, so the people are real skinned humanoid models instead of placeholder capsule figures. Swap the paths in `characterConfig.ts` for Mixamo, Ready Player Me, or custom Blender-exported characters.
