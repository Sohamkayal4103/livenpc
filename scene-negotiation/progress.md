Original prompt: Build one GTA-style Three.js/React street negotiation scene for a hackathon demo, including visuals, player controls, NPCs, WebSocket game-state bridge, microphone capture, spatial NPC audio playback, proximity trigger, HUD, and tension-driven behavior. Do not build the voice AI backend.

Progress:
- Scaffolded Vite + React + TypeScript project in `scene-negotiation/`.
- Added primitive fallback 3D alley environment, player controller, dealer/bodyguards/bystander NPCs, HUD, WebSocket bridge, AudioWorklet mic capture, spatial NPC audio playback, and tension system.
- Added pointer-lock third-person camera, WASD movement, E conversation trigger, F fullscreen toggle, `window.render_game_to_text`, and `window.advanceTime`.
- Fixed backend probing so an absent WebSocket backend leaves a disconnected HUD state without breaking visual navigation, and made `advanceTime` wait for animation frames during automated tests.
- Added NPC collision, brighter night readability, smaller camera-facing NPC labels, and `README.md` run/controls/backend handoff notes.
- Increased scene readability after user feedback: stronger exposure, brighter fill/meeting lights, lighter wall/ground/character materials, player-local readability light, and reduced harsh shadow opacity.
- Replaced capsule characters with a modular character pipeline: `GameCharacter` wrapper, `RiggedCharacterModel` GLB loader using SkeletonUtils clones + drei `useAnimations`, and an anatomical procedural fallback. Downloaded and wired `public/models/characters/soldier.glb` from the Three.js examples as the current animated human model.
- Commented out the right-side debug HUD blocks for the tension meter and NPC disposition panel in `HUD.tsx`; they can be restored by uncommenting those JSX blocks.
- Fixed character orientation: removed full 3D `lookAt` from NPCs in favor of yaw-only facing so they no longer pitch/tilt, and corrected player forward rotation so walking forward shows the character's back to the camera.
- Tightened player body-facing rule: while `W`/forward is held, the body yaw follows the camera yaw directly, so the character looks ahead and the camera sees their back.

TODO:
- Swap the shared Soldier example model for role-specific Mixamo, Ready Player Me, MetaHuman-to-GLB, or custom Blender-exported characters when art direction is available.
