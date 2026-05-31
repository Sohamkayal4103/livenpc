import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

interface RiggedCharacterModelProps {
  path: string;
  animationName?: string;
  scale?: number;
}

export function RiggedCharacterModel({
  path,
  animationName = "Idle",
  scale = 1,
}: RiggedCharacterModelProps) {
  const group = useRef<THREE.Group>(null);
  const gltf = useGLTF(path);
  const animations = useMemo(() => gltf.animations ?? [], [gltf.animations]);
  const scene = useMemo(() => cloneSkeleton(gltf.scene), [gltf.scene]);
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    const preferredName =
      names.find((name) => name.toLowerCase() === animationName.toLowerCase()) ??
      names.find((name) => name.toLowerCase().includes(animationName.toLowerCase())) ??
      names[0];

    Object.values(actions).forEach((action) => action?.fadeOut(0.15));
    const nextAction = preferredName ? actions[preferredName] : null;
    nextAction?.reset().fadeIn(0.18).play();

    return () => {
      nextAction?.fadeOut(0.12);
    };
  }, [actions, animationName, names]);

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });
  }, [scene]);

  return (
    <group ref={group} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}
