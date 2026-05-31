import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import { useRef } from "react";
import * as THREE from "three";
import type { CharacterKind, CharacterPalette } from "../../config/characterConfig";
import { characterPalettes } from "../../config/characterConfig";

export type HumanoidPose =
  | "idle"
  | "relaxed"
  | "walk"
  | "alert"
  | "aggressive"
  | "talk"
  | "fleeing"
  | "smoking";

interface HumanoidProps {
  kind: CharacterKind;
  pose?: HumanoidPose;
  isSpeaking?: boolean;
  armed?: boolean;
  showWeapon?: boolean;
  scale?: number;
}

function CapsuleLimb({
  rootRef,
  length,
  radius,
  color,
  position,
  rotation,
}: {
  rootRef?: RefObject<THREE.Group>;
  length: number;
  radius: number;
  color: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group ref={rootRef} position={position} rotation={rotation}>
      <mesh castShadow receiveShadow position={[0, -length / 2, 0]}>
        <capsuleGeometry args={[radius, Math.max(0.01, length - radius * 2), 10, 18]} />
        <meshStandardMaterial color={color} roughness={0.62} />
      </mesh>
    </group>
  );
}

function SuitPanels({ palette }: { palette: CharacterPalette }) {
  return (
    <>
      <mesh castShadow position={[-0.18, 1.18, -0.245]} rotation={[0.03, 0.04, -0.06]}>
        <boxGeometry args={[0.22, 0.72, 0.045]} />
        <meshStandardMaterial color={palette.jacket} roughness={0.58} />
      </mesh>
      <mesh castShadow position={[0.18, 1.18, -0.245]} rotation={[0.03, -0.04, 0.06]}>
        <boxGeometry args={[0.22, 0.72, 0.045]} />
        <meshStandardMaterial color={palette.jacket} roughness={0.58} />
      </mesh>
      <mesh castShadow position={[0, 0.77, -0.255]}>
        <boxGeometry args={[0.54, 0.06, 0.055]} />
        <meshStandardMaterial color={palette.accent} roughness={0.48} metalness={0.15} />
      </mesh>
    </>
  );
}

function Hat({ kind, palette }: { kind: CharacterKind; palette: CharacterPalette }) {
  if (kind !== "dealer" && kind !== "bodyguard") return null;

  return (
    <group position={[0, 0.14, -0.02]}>
      <mesh castShadow position={[0, 0.015, 0]}>
        <cylinderGeometry args={[0.23, 0.25, 0.12, 28]} />
        <meshStandardMaterial color={palette.hair} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, -0.045, -0.035]}>
        <boxGeometry args={[0.66, 0.045, 0.38]} />
        <meshStandardMaterial color={palette.hair} roughness={0.52} />
      </mesh>
      {kind === "dealer" ? (
        <mesh castShadow position={[0, -0.105, -0.235]}>
          <boxGeometry args={[0.42, 0.035, 0.06]} />
          <meshStandardMaterial color={palette.accent} roughness={0.4} />
        </mesh>
      ) : null}
    </group>
  );
}

export function Humanoid({
  kind,
  pose = "idle",
  isSpeaking = false,
  armed = false,
  showWeapon = false,
  scale = 1,
}: HumanoidProps) {
  const root = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Mesh>(null);
  const leftUpperArm = useRef<THREE.Group>(null);
  const rightUpperArm = useRef<THREE.Group>(null);
  const leftForearm = useRef<THREE.Group>(null);
  const rightForearm = useRef<THREE.Group>(null);
  const leftThigh = useRef<THREE.Group>(null);
  const rightThigh = useRef<THREE.Group>(null);
  const leftShin = useRef<THREE.Group>(null);
  const rightShin = useRef<THREE.Group>(null);
  const leftFoot = useRef<THREE.Mesh>(null);
  const rightFoot = useRef<THREE.Mesh>(null);
  const palette = characterPalettes[kind];

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const speaking = isSpeaking || pose === "talk";
    const walking = pose === "walk" || pose === "fleeing";
    const tense = pose === "alert" || pose === "aggressive";
    const runMultiplier = pose === "fleeing" ? 1.45 : 1;
    const stride = walking ? Math.sin(t * 7.6 * runMultiplier) : 0;
    const idleBreath = Math.sin(t * 1.7) * 0.018;
    const talkGesture = speaking ? Math.sin(t * 8.5) * 0.2 : 0;

    if (root.current) {
      root.current.position.y = idleBreath * 0.28 + (walking ? Math.abs(stride) * 0.025 : 0);
    }
    if (chest.current) {
      chest.current.scale.y = 1 + idleBreath;
      chest.current.rotation.x = tense ? -0.05 : 0;
    }
    if (head.current) {
      head.current.rotation.x = speaking ? Math.sin(t * 10) * 0.055 : Math.sin(t * 1.1) * 0.025;
      head.current.rotation.z = tense ? Math.sin(t * 2.2) * 0.025 : Math.sin(t * 0.8) * 0.015;
    }
    if (jaw.current) {
      jaw.current.scale.y = speaking ? 1.2 + Math.abs(Math.sin(t * 18)) * 1.1 : 1;
      jaw.current.position.y = speaking ? -0.11 - Math.abs(Math.sin(t * 18)) * 0.018 : -0.11;
    }

    const leftArmSwing = walking ? -stride * 0.46 : 0;
    const rightArmSwing = walking ? stride * 0.46 : 0;
    const alertBend = tense ? -0.42 : -0.08;
    const aggressiveBend = pose === "aggressive" ? -0.78 : alertBend;

    if (leftUpperArm.current) {
      leftUpperArm.current.rotation.set(
        leftArmSwing + aggressiveBend - talkGesture * 0.35,
        0,
        0.23,
      );
    }
    if (rightUpperArm.current) {
      rightUpperArm.current.rotation.set(
        rightArmSwing + aggressiveBend + talkGesture * 0.35,
        0,
        -0.23,
      );
    }
    if (leftForearm.current) {
      leftForearm.current.rotation.set(
        tense ? -0.56 : speaking ? -0.45 - Math.abs(talkGesture) : -0.18,
        0,
        0.18,
      );
    }
    if (rightForearm.current) {
      rightForearm.current.rotation.set(
        pose === "aggressive" ? -0.88 : speaking ? -0.42 - Math.abs(talkGesture) : -0.18,
        0,
        -0.18,
      );
    }

    if (leftThigh.current) leftThigh.current.rotation.x = walking ? stride * 0.55 : 0.02;
    if (rightThigh.current) rightThigh.current.rotation.x = walking ? -stride * 0.55 : -0.02;
    if (leftShin.current) leftShin.current.rotation.x = walking ? Math.max(0, -stride) * 0.48 : 0;
    if (rightShin.current) rightShin.current.rotation.x = walking ? Math.max(0, stride) * 0.48 : 0;
    if (leftFoot.current) leftFoot.current.rotation.x = walking ? -0.06 - stride * 0.16 : -0.06;
    if (rightFoot.current) rightFoot.current.rotation.x = walking ? -0.06 + stride * 0.16 : -0.06;
  });

  return (
    <group ref={root} scale={scale}>
      <mesh castShadow receiveShadow position={[0, 0.78, 0]} scale={[0.33, 0.16, 0.2]}>
        <sphereGeometry args={[1, 24, 18]} />
        <meshStandardMaterial color={palette.pants} roughness={0.64} />
      </mesh>

      <mesh ref={chest} castShadow receiveShadow position={[0, 1.18, -0.015]} scale={[0.42, 0.55, 0.25]}>
        <sphereGeometry args={[1, 32, 20]} />
        <meshStandardMaterial color={palette.shirt} roughness={0.54} />
      </mesh>
      <mesh castShadow position={[0, 1.48, -0.01]} scale={[0.5, 0.13, 0.24]}>
        <sphereGeometry args={[1, 24, 14]} />
        <meshStandardMaterial color={palette.jacket} roughness={0.56} />
      </mesh>
      <SuitPanels palette={palette} />

      <mesh castShadow position={[0, 1.62, 0]}>
        <cylinderGeometry args={[0.085, 0.105, 0.18, 18]} />
        <meshStandardMaterial color={palette.skin} roughness={0.56} />
      </mesh>

      <group ref={head} position={[0, 1.78, 0]}>
        <mesh castShadow receiveShadow scale={[0.22, 0.28, 0.2]}>
          <sphereGeometry args={[1, 32, 24]} />
          <meshStandardMaterial color={palette.skin} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, 0.11, 0.02]} scale={[0.225, 0.105, 0.205]}>
          <sphereGeometry args={[1, 24, 14]} />
          <meshStandardMaterial color={palette.hair} roughness={0.55} />
        </mesh>
        <mesh castShadow position={[0, 0.03, -0.205]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[0.06, 0.08, 0.08]} />
          <meshStandardMaterial color={palette.skin} roughness={0.54} />
        </mesh>
        {[-0.075, 0.075].map((x) => (
          <mesh key={x} position={[x, 0.04, -0.19]}>
            <sphereGeometry args={[0.018, 10, 8]} />
            <meshStandardMaterial color="#07090c" roughness={0.35} />
          </mesh>
        ))}
        <mesh ref={jaw} castShadow position={[0, -0.11, -0.2]}>
          <boxGeometry args={[0.16, 0.045, 0.045]} />
          <meshStandardMaterial color="#6d453c" roughness={0.64} />
        </mesh>
        <Hat kind={kind} palette={palette} />
      </group>

      <CapsuleLimb
        rootRef={leftUpperArm}
        length={0.38}
        radius={0.065}
        color={palette.jacket}
        position={[-0.42, 1.45, -0.01]}
        rotation={[0, 0, 0.23]}
      />
      <CapsuleLimb
        rootRef={rightUpperArm}
        length={0.38}
        radius={0.065}
        color={palette.jacket}
        position={[0.42, 1.45, -0.01]}
        rotation={[0, 0, -0.23]}
      />
      <CapsuleLimb
        rootRef={leftForearm}
        length={0.36}
        radius={0.055}
        color={kind === "dealer" ? palette.skin : palette.jacket}
        position={[-0.48, 1.1, -0.04]}
        rotation={[-0.16, 0, 0.16]}
      />
      <CapsuleLimb
        rootRef={rightForearm}
        length={0.36}
        radius={0.055}
        color={kind === "dealer" ? palette.skin : palette.jacket}
        position={[0.48, 1.1, -0.04]}
        rotation={[-0.16, 0, -0.16]}
      />
      {[-0.52, 0.52].map((x) => (
        <mesh key={x} castShadow position={[x, 0.78, -0.07]} scale={[0.055, 0.07, 0.05]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={palette.skin} roughness={0.56} />
        </mesh>
      ))}

      <CapsuleLimb
        rootRef={leftThigh}
        length={0.43}
        radius={0.075}
        color={palette.pants}
        position={[-0.15, 0.7, 0.02]}
      />
      <CapsuleLimb
        rootRef={rightThigh}
        length={0.43}
        radius={0.075}
        color={palette.pants}
        position={[0.15, 0.7, 0.02]}
      />
      <CapsuleLimb
        rootRef={leftShin}
        length={0.4}
        radius={0.065}
        color={palette.pants}
        position={[-0.15, 0.36, 0.005]}
      />
      <CapsuleLimb
        rootRef={rightShin}
        length={0.4}
        radius={0.065}
        color={palette.pants}
        position={[0.15, 0.36, 0.005]}
      />
      <mesh ref={leftFoot} castShadow receiveShadow position={[-0.15, 0.075, -0.105]}>
        <boxGeometry args={[0.17, 0.09, 0.31]} />
        <meshStandardMaterial color={palette.shoes} roughness={0.5} />
      </mesh>
      <mesh ref={rightFoot} castShadow receiveShadow position={[0.15, 0.075, -0.105]}>
        <boxGeometry args={[0.17, 0.09, 0.31]} />
        <meshStandardMaterial color={palette.shoes} roughness={0.5} />
      </mesh>

      {armed ? (
        <mesh
          castShadow
          visible={showWeapon}
          position={[0.5, 0.9, -0.19]}
          rotation={[pose === "aggressive" ? -0.9 : -0.25, 0.05, -0.2]}
        >
          <boxGeometry args={[0.06, 0.16, 0.32]} />
          <meshStandardMaterial color="#050608" roughness={0.34} metalness={0.65} />
        </mesh>
      ) : null}

      {pose === "smoking" ? (
        <mesh position={[0.52, 0.96, -0.28]} rotation={[0.4, 0, 0.25]}>
          <cylinderGeometry args={[0.012, 0.012, 0.22, 8]} />
          <meshStandardMaterial color="#e2e0cf" emissive={palette.accent} emissiveIntensity={0.45} />
        </mesh>
      ) : null}
    </group>
  );
}
