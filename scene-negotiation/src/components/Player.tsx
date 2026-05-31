import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { characterModelPaths } from "../config/characterConfig";
import { DEALER_ID, sceneParams } from "../config/sceneConfig";
import { GameCharacter } from "./characters/GameCharacter";
import { useGameStore } from "../systems/GameStateManager";
import { distance } from "../systems/TensionSystem";
import { yawForForwardDirection } from "../utils/characterFacing";

const obstacles = [
  { x: -4.25, z: 0.7, radius: 1.05 },
  { x: 3.8, z: -1.35, radius: 1.2 },
  { x: -3.6, z: -3.15, radius: 0.9 },
  { x: 3.25, z: 3.45, radius: 1.35 },
  { x: 0, z: -6.7, radius: 0.72 },
  { x: -2.35, z: -5.7, radius: 0.55 },
  { x: 2.55, z: -5.2, radius: 0.55 },
];

function resolveCollisions(position: THREE.Vector3) {
  position.x = THREE.MathUtils.clamp(
    position.x,
    sceneParams.alleyBounds.minX,
    sceneParams.alleyBounds.maxX,
  );
  position.z = THREE.MathUtils.clamp(
    position.z,
    sceneParams.alleyBounds.minZ,
    sceneParams.alleyBounds.maxZ,
  );

  for (const obstacle of obstacles) {
    const dx = position.x - obstacle.x;
    const dz = position.z - obstacle.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    const minDistance = obstacle.radius + 0.34;
    if (length > 0.001 && length < minDistance) {
      const push = (minDistance - length) / length;
      position.x += dx * push;
      position.z += dz * push;
    }
  }
}

export function Player() {
  const group = useRef<THREE.Group>(null);
  const movingVisual = useRef(false);
  const yaw = useRef(0);
  const pitch = useRef(0.12);
  const keys = useRef(new Set<string>());
  const [isMoving, setIsMoving] = useState(false);
  const playerPosition = useRef(
    new THREE.Vector3(
      sceneParams.playerStart.x,
      sceneParams.playerStart.y,
      sceneParams.playerStart.z,
    ),
  );
  const smoothedCamera = useRef(new THREE.Vector3(0, 3, 11));
  const { camera, gl } = useThree();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (event.code === "KeyF") {
        const target = gl.domElement.parentElement ?? gl.domElement;
        if (!document.fullscreenElement) {
          void target.requestFullscreen?.();
        } else {
          void document.exitFullscreen?.();
        }
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      keys.current.delete(event.code);
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      yaw.current += event.movementX * 0.0021;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - event.movementY * 0.0015,
        -0.35,
        0.58,
      );
    };
    const lockPointer = () => {
      if (document.pointerLockElement !== gl.domElement) {
        const lockRequest = gl.domElement.requestPointerLock?.();
        void Promise.resolve(lockRequest).catch(() => {
          useGameStore.getState().setPointerLocked(false);
        });
      }
    };
    const handlePointerLock = () => {
      useGameStore.getState().setPointerLocked(document.pointerLockElement === gl.domElement);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLock);
    gl.domElement.addEventListener("click", lockPointer);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerlockchange", handlePointerLock);
      gl.domElement.removeEventListener("click", lockPointer);
    };
  }, [gl.domElement]);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const sprinting = keys.current.has("ShiftLeft") || keys.current.has("ShiftRight");
    const speed = sprinting ? 5.25 : 2.75;
    const forward = new THREE.Vector3(Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, Math.sin(yaw.current));
    const movement = new THREE.Vector3();

    if (keys.current.has("KeyW") || keys.current.has("ArrowUp")) movement.add(forward);
    if (keys.current.has("KeyS") || keys.current.has("ArrowDown")) movement.sub(forward);
    if (keys.current.has("KeyD") || keys.current.has("ArrowRight")) movement.add(right);
    if (keys.current.has("KeyA") || keys.current.has("ArrowLeft")) movement.sub(right);

    const moving = movement.lengthSq() > 0.001;
    if (movingVisual.current !== moving) {
      movingVisual.current = moving;
      setIsMoving(moving);
    }
    if (moving) {
      movement.normalize();
      playerPosition.current.addScaledVector(movement, speed * dt);
      resolveCollisions(playerPosition.current);
    }

    const bob = moving ? Math.sin(clock.elapsedTime * (sprinting ? 13 : 8)) * 0.045 : 0;
    if (group.current) {
      group.current.position.set(
        playerPosition.current.x,
        playerPosition.current.y + bob,
        playerPosition.current.z,
      );
      const movingForward = keys.current.has("KeyW") || keys.current.has("ArrowUp");
      const bodyYaw = movingForward
        ? yaw.current
        : moving
          ? yawForForwardDirection(movement)
          : yaw.current;
      group.current.rotation.set(
        0,
        bodyYaw,
        0,
      );
    }

    const cameraDistance = 5.25;
    const cameraHeight = 2.45 + pitch.current * 1.7;
    const cameraTarget = playerPosition.current
      .clone()
      .addScaledVector(forward, -cameraDistance)
      .add(new THREE.Vector3(0, cameraHeight, 0));
    smoothedCamera.current.lerp(cameraTarget, 1 - Math.pow(0.001, dt));
    camera.position.copy(smoothedCamera.current);
    camera.lookAt(
      playerPosition.current.x,
      playerPosition.current.y + 1.25 + pitch.current,
      playerPosition.current.z,
    );

    const state = useGameStore.getState().gameState;
    const playerForward = forward.clone().normalize();
    let lookingAt: string | null = null;
    let bestDot = 0.82;
    for (const npc of state.npcs) {
      const toNpc = new THREE.Vector3(
        npc.position.x - playerPosition.current.x,
        0,
        npc.position.z - playerPosition.current.z,
      );
      const npcDistance = toNpc.length();
      if (npcDistance > 8 || npcDistance < 0.001) continue;
      const dot = playerForward.dot(toNpc.normalize());
      if (dot > bestDot) {
        bestDot = dot;
        lookingAt = npc.id;
      }
    }

    const dealer = state.npcs.find((npc) => npc.id === DEALER_ID);
    const movingSpeed = moving ? speed : 0;
    useGameStore.getState().setPlayerPosition(
      {
        x: playerPosition.current.x,
        y: playerPosition.current.y,
        z: playerPosition.current.z,
      },
      movingSpeed,
      dealer && distance(playerPosition.current, dealer.position) < 7 ? lookingAt : null,
    );
  });

  return (
    <group ref={group} position={[sceneParams.playerStart.x, 0, sceneParams.playerStart.z]}>
      <GameCharacter
        kind="player"
        modelPath={characterModelPaths.player}
        pose={isMoving ? "walk" : "idle"}
      />
    </group>
  );
}
