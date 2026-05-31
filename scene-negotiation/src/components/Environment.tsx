import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../systems/GameStateManager";

function BrickRows({ x }: { x: number }) {
  const rows = Array.from({ length: 15 }, (_, row) => row);
  return (
    <group position={[x, 0.05, -1.2]}>
      {rows.map((row) => (
        <mesh
          key={row}
          castShadow
          receiveShadow
          position={[0, 0.22 + row * 0.31, row % 2 ? 1.2 : -0.35]}
        >
          <boxGeometry args={[0.08, 0.035, 2.05]} />
          <meshStandardMaterial color={row % 2 ? "#3d4650" : "#343d46"} roughness={0.88} />
        </mesh>
      ))}
    </group>
  );
}

function Fence({ z }: { z: number }) {
  const posts = Array.from({ length: 12 }, (_, index) => index);
  const rails = Array.from({ length: 3 }, (_, index) => index);
  return (
    <group position={[0, 0, z]}>
      {posts.map((index) => (
        <mesh key={index} castShadow position={[-5.5 + index, 1.15, 0]}>
          <boxGeometry args={[0.035, 2.3, 0.035]} />
          <meshStandardMaterial color="#69717a" metalness={0.7} roughness={0.25} />
        </mesh>
      ))}
      {rails.map((index) => (
        <mesh key={index} castShadow position={[0, 0.42 + index * 0.75, 0]}>
          <boxGeometry args={[10.9, 0.035, 0.035]} />
          <meshStandardMaterial color="#69717a" metalness={0.7} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

function Puddle({ position, scale }: { position: [number, number, number]; scale: [number, number, number] }) {
  return (
    <mesh receiveShadow position={position} rotation={[-Math.PI / 2, 0, 0]} scale={scale}>
      <circleGeometry args={[1, 36]} />
      <meshStandardMaterial
        color="#20323a"
        emissive="#0b1d26"
        metalness={0.2}
        roughness={0.08}
        transparent
        opacity={0.48}
      />
    </mesh>
  );
}

function Dumpster() {
  return (
    <group position={[-4.25, 0.55, 0.7]} rotation={[0, 0.12, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.5, 1.1, 1.15]} />
        <meshStandardMaterial color="#35776b" roughness={0.65} metalness={0.22} />
      </mesh>
      <mesh castShadow position={[0, 0.62, 0]}>
        <boxGeometry args={[1.62, 0.18, 1.22]} />
        <meshStandardMaterial color="#28534c" roughness={0.75} metalness={0.18} />
      </mesh>
      <mesh castShadow position={[0.58, 0.02, -0.62]}>
        <cylinderGeometry args={[0.12, 0.12, 0.1, 16]} />
        <meshStandardMaterial color="#14191c" roughness={0.45} />
      </mesh>
      <mesh castShadow position={[-0.58, 0.02, -0.62]}>
        <cylinderGeometry args={[0.12, 0.12, 0.1, 16]} />
        <meshStandardMaterial color="#14191c" roughness={0.45} />
      </mesh>
    </group>
  );
}

function CrateStack() {
  return (
    <group position={[3.55, 0.35, -1.4]} rotation={[0, -0.18, 0]}>
      {[
        [0, 0, 0],
        [0.82, 0, -0.08],
        [0.36, 0.72, -0.02],
      ].map((offset, index) => (
        <mesh key={index} castShadow receiveShadow position={offset as [number, number, number]}>
          <boxGeometry args={[0.72, 0.72, 0.72]} />
          <meshStandardMaterial color={index === 2 ? "#806648" : "#5e4a34"} roughness={0.82} />
        </mesh>
      ))}
    </group>
  );
}

function BarrelCluster() {
  return (
    <group position={[-3.75, 0.45, -3.2]}>
      {[
        [0, 0, 0],
        [0.58, 0, 0.2],
        [0.2, 0, -0.54],
      ].map((offset, index) => (
        <mesh key={index} castShadow receiveShadow position={offset as [number, number, number]}>
          <cylinderGeometry args={[0.26, 0.28, 0.9, 18]} />
          <meshStandardMaterial
            color={index === 1 ? "#9a4246" : "#4b5866"}
            metalness={0.45}
            roughness={0.48}
          />
        </mesh>
      ))}
    </group>
  );
}

function ParkedCar() {
  return (
    <group position={[3.25, 0.42, 3.45]} rotation={[0, -0.42, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.45, 0.62, 1.22]} />
        <meshStandardMaterial color="#26313b" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh castShadow position={[-0.25, 0.48, 0]}>
        <boxGeometry args={[1.18, 0.5, 1.04]} />
        <meshStandardMaterial color="#344554" roughness={0.35} metalness={0.18} />
      </mesh>
      {[-0.78, 0.78].map((x) =>
        [-0.68, 0.68].map((z) => (
          <mesh key={`${x}-${z}`} castShadow position={[x, -0.33, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.18, 18]} />
            <meshStandardMaterial color="#050607" roughness={0.5} />
          </mesh>
        )),
      )}
      <pointLight position={[-1.32, 0.12, 0.38]} color="#7ee7c0" intensity={0.75} distance={6} />
      <pointLight position={[-1.32, 0.12, -0.38]} color="#7ee7c0" intensity={0.75} distance={6} />
    </group>
  );
}

function OverheadLight() {
  const pointLight = useRef<THREE.PointLight>(null);
  const bulb = useRef<THREE.Mesh>(null);
  const tension = useGameStore((state) => state.gameState.scene.tension_level);

  useFrame(({ clock }) => {
    const flicker =
      4.8 +
      Math.sin(clock.elapsedTime * 19) * 0.05 +
      (tension > 0.62 ? Math.sin(clock.elapsedTime * 47) * 0.24 : 0);
    if (pointLight.current) pointLight.current.intensity = Math.max(3.6, flicker);
    if (bulb.current) {
      const material = bulb.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 2.5 + tension * 1.4;
    }
  });

  return (
    <group position={[0, 4.25, -4.35]}>
      <mesh castShadow position={[0, 0.28, 0]}>
        <boxGeometry args={[1.3, 0.1, 0.18]} />
        <meshStandardMaterial color="#242a31" metalness={0.45} roughness={0.42} />
      </mesh>
      <mesh ref={bulb} position={[0, -0.05, 0]}>
        <sphereGeometry args={[0.16, 24, 16]} />
        <meshStandardMaterial color="#ffe5a8" emissive="#ffc35c" emissiveIntensity={3} />
      </mesh>
      <pointLight
        ref={pointLight}
        castShadow
        color="#ffbe65"
        intensity={4.8}
        distance={22}
        decay={1.55}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </group>
  );
}

function NeonSign() {
  return (
    <group position={[5.86, 2.9, -0.35]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh>
        <boxGeometry args={[1.6, 0.58, 0.08]} />
        <meshStandardMaterial color="#10151b" emissive="#0e2f2a" emissiveIntensity={0.8} />
      </mesh>
      <Text
        position={[0, 0.01, 0.06]}
        fontSize={0.28}
        color="#79f1be"
        anchorX="center"
        anchorY="middle"
      >
        LOT 9
      </Text>
      <pointLight color="#48f0b0" intensity={1.2} distance={9.5} position={[0, 0, 0.5]} />
    </group>
  );
}

export function Environment() {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -1]}>
        <planeGeometry args={[12.4, 23.5, 1, 1]} />
        <meshStandardMaterial color="#242a30" roughness={0.5} metalness={0.12} />
      </mesh>
      <Puddle position={[-1.7, 0.004, -1.5]} scale={[1.6, 0.58, 1]} />
      <Puddle position={[2.2, 0.006, 1.35]} scale={[1.05, 0.38, 1]} />
      <Puddle position={[0.4, 0.006, -7.9]} scale={[1.25, 0.36, 1]} />

      <mesh castShadow receiveShadow position={[-6, 2.35, -1.2]}>
        <boxGeometry args={[0.72, 4.7, 23.2]} />
        <meshStandardMaterial color="#343d47" roughness={0.84} />
      </mesh>
      <mesh castShadow receiveShadow position={[6, 2.35, -1.2]}>
        <boxGeometry args={[0.72, 4.7, 23.2]} />
        <meshStandardMaterial color="#303943" roughness={0.84} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 2.35, -12.05]}>
        <boxGeometry args={[12.5, 4.7, 0.72]} />
        <meshStandardMaterial color="#29313a" roughness={0.88} />
      </mesh>

      <BrickRows x={-5.62} />
      <BrickRows x={5.62} />
      <Fence z={9.35} />
      <Dumpster />
      <CrateStack />
      <BarrelCluster />
      <ParkedCar />
      <OverheadLight />
      <NeonSign />

      <Text
        position={[-5.57, 1.65, -6.2]}
        rotation={[0, Math.PI / 2, -0.08]}
        fontSize={0.42}
        color="#d95454"
        anchorX="center"
        anchorY="middle"
      >
        PAY CASH
      </Text>
      {/*
        Wall graffiti/sign text. Uncomment if we want this environmental detail back.
        <Text
          position={[5.58, 1.15, 3.0]}
          rotation={[0, -Math.PI / 2, 0.07]}
          fontSize={0.34}
          color="#d7c46a"
          anchorX="center"
          anchorY="middle"
        >
          NO CAMS
        </Text>
      */}
    </group>
  );
}
