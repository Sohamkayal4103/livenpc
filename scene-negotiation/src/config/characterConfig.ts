export type CharacterKind = "player" | "dealer" | "bodyguard" | "bystander";

export interface CharacterPalette {
  skin: string;
  hair: string;
  shirt: string;
  jacket: string;
  pants: string;
  shoes: string;
  accent: string;
}

const sharedHumanoidModel = "/models/characters/soldier.glb";

export const characterModelPaths: Record<CharacterKind, string | null> = {
  player: sharedHumanoidModel,
  dealer: sharedHumanoidModel,
  bodyguard: sharedHumanoidModel,
  bystander: sharedHumanoidModel,
};

export const characterPalettes: Record<CharacterKind, CharacterPalette> = {
  player: {
    skin: "#a97a68",
    hair: "#1c1715",
    shirt: "#1c2740",
    jacket: "#0f1728",
    pants: "#111827",
    shoes: "#07090d",
    accent: "#e2b66d",
  },
  dealer: {
    skin: "#bd856e",
    hair: "#171315",
    shirt: "#f0eadb",
    jacket: "#313943",
    pants: "#222833",
    shoes: "#101216",
    accent: "#d9b574",
  },
  bodyguard: {
    skin: "#a17566",
    hair: "#121112",
    shirt: "#263241",
    jacket: "#4a5867",
    pants: "#171f2a",
    shoes: "#08090c",
    accent: "#737d88",
  },
  bystander: {
    skin: "#9e6f5f",
    hair: "#2b201b",
    shirt: "#7a584b",
    jacket: "#574038",
    pants: "#26333c",
    shoes: "#111315",
    accent: "#f39b67",
  },
};

export const animationNameByPose = {
  idle: "Idle",
  relaxed: "Idle",
  walk: "Walk",
  alert: "Idle",
  aggressive: "Idle",
  talk: "Idle",
  fleeing: "Run",
  smoking: "Idle",
};
