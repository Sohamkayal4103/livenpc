import { animationNameByPose, type CharacterKind } from "../../config/characterConfig";
import { Humanoid, type HumanoidPose } from "./Humanoid";
import { RiggedCharacterModel } from "./RiggedCharacterModel";

interface GameCharacterProps {
  kind: CharacterKind;
  pose?: HumanoidPose;
  modelPath?: string | null;
  isSpeaking?: boolean;
  armed?: boolean;
  showWeapon?: boolean;
  scale?: number;
}

export function GameCharacter({
  kind,
  pose = "idle",
  modelPath,
  isSpeaking = false,
  armed = false,
  showWeapon = false,
  scale = 1,
}: GameCharacterProps) {
  if (modelPath) {
    return (
      <RiggedCharacterModel
        path={modelPath}
        animationName={animationNameByPose[pose]}
        scale={scale}
      />
    );
  }

  return (
    <Humanoid
      kind={kind}
      pose={pose}
      isSpeaking={isSpeaking}
      armed={armed}
      showWeapon={showWeapon}
      scale={scale}
    />
  );
}
