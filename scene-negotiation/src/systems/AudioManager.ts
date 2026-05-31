import * as THREE from "three";
import type { Vec3 } from "../types/GameState";

type SpeakingCallback = (speaking: boolean) => void;

const stripDataUrlPrefix = (value: string) => {
  const commaIndex = value.indexOf(",");
  return value.startsWith("data:") && commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
};

function base64ToArrayBuffer(base64: string) {
  const clean = stripDataUrlPrefix(base64);
  const binary = window.atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

class AudioManager {
  private context: AudioContext | null = null;
  private activeSources = new Map<string, AudioBufferSourceNode>();

  async ensureContext() {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    return this.context;
  }

  updateListener(position: Vec3, cameraQuaternion: THREE.Quaternion) {
    if (!this.context) return;
    const listener = this.context.listener;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraQuaternion);

    if ("positionX" in listener) {
      listener.positionX.value = position.x;
      listener.positionY.value = position.y + 1.35;
      listener.positionZ.value = position.z;
      listener.forwardX.value = forward.x;
      listener.forwardY.value = forward.y;
      listener.forwardZ.value = forward.z;
      listener.upX.value = up.x;
      listener.upY.value = up.y;
      listener.upZ.value = up.z;
    } else {
      const legacyListener = listener as AudioListener & {
        setPosition?: (x: number, y: number, z: number) => void;
        setOrientation?: (
          x: number,
          y: number,
          z: number,
          xUp: number,
          yUp: number,
          zUp: number,
        ) => void;
      };
      legacyListener.setPosition?.(position.x, position.y + 1.35, position.z);
      legacyListener.setOrientation?.(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  async playNpcAudio(
    npcId: string,
    audioBase64: string,
    position: Vec3,
    onSpeaking?: SpeakingCallback,
  ) {
    const context = await this.ensureContext();
    const existing = this.activeSources.get(npcId);
    if (existing) {
      existing.stop();
      this.activeSources.delete(npcId);
    }

    try {
      const arrayBuffer = base64ToArrayBuffer(audioBase64);
      const buffer = await context.decodeAudioData(arrayBuffer.slice(0));
      const source = context.createBufferSource();
      const panner = context.createPanner();

      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = 1.1;
      panner.maxDistance = 24;
      panner.rolloffFactor = 1.45;
      panner.coneInnerAngle = 130;
      panner.coneOuterAngle = 240;
      panner.coneOuterGain = 0.55;
      panner.positionX.value = position.x;
      panner.positionY.value = position.y + 1.35;
      panner.positionZ.value = position.z;

      source.buffer = buffer;
      source.connect(panner);
      panner.connect(context.destination);
      this.activeSources.set(npcId, source);

      onSpeaking?.(true);
      source.onended = () => {
        this.activeSources.delete(npcId);
        onSpeaking?.(false);
      };
      source.start();
    } catch (error) {
      console.warn("Unable to decode NPC audio chunk", error);
      onSpeaking?.(false);
    }
  }

  stopAll() {
    this.activeSources.forEach((source) => source.stop());
    this.activeSources.clear();
  }
}

export const audioManager = new AudioManager();
