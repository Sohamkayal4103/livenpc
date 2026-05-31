import type { AudioChunkMetadata } from "../types/GameState";

type ChunkHandler = (base64Audio: string, metadata: AudioChunkMetadata) => void;

const floatTo16BitPCM = (input: Float32Array) => {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
};

class MicCapture {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private silentGain: GainNode | null = null;
  private workletUrl: string | null = null;
  private recorder: MediaRecorder | null = null;

  get active() {
    return Boolean(this.stream);
  }

  async start(onChunk: ChunkHandler) {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    if ("AudioWorkletNode" in window) {
      await this.startWorklet(onChunk);
      return;
    }

    this.startMediaRecorderFallback(onChunk);
  }

  stop() {
    this.recorder?.stop();
    this.recorder = null;
    this.worklet?.disconnect();
    this.worklet = null;
    this.source?.disconnect();
    this.source = null;
    this.silentGain?.disconnect();
    this.silentGain = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    void this.context?.close();
    this.context = null;
    if (this.workletUrl) {
      URL.revokeObjectURL(this.workletUrl);
      this.workletUrl = null;
    }
  }

  private async startWorklet(onChunk: ChunkHandler) {
    if (!this.stream) return;
    this.context = new AudioContext();
    const workletCode = `
      class PCMRecorderProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.pending = [];
          this.pendingLength = 0;
          this.chunkSize = 2048;
        }

        process(inputs) {
          const input = inputs[0] && inputs[0][0];
          if (!input) return true;
          this.pending.push(new Float32Array(input));
          this.pendingLength += input.length;
          if (this.pendingLength >= this.chunkSize) {
            const merged = new Float32Array(this.pendingLength);
            let offset = 0;
            for (const part of this.pending) {
              merged.set(part, offset);
              offset += part.length;
            }
            this.port.postMessage(merged, [merged.buffer]);
            this.pending = [];
            this.pendingLength = 0;
          }
          return true;
        }
      }

      registerProcessor("pcm-recorder-processor", PCMRecorderProcessor);
    `;
    this.workletUrl = URL.createObjectURL(
      new Blob([workletCode], { type: "text/javascript" }),
    );
    await this.context.audioWorklet.addModule(this.workletUrl);
    this.source = this.context.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(this.context, "pcm-recorder-processor");
    this.silentGain = this.context.createGain();
    this.silentGain.gain.value = 0;
    this.worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
      const pcm16 = floatTo16BitPCM(event.data);
      const buffer = pcm16.buffer.slice(
        pcm16.byteOffset,
        pcm16.byteOffset + pcm16.byteLength,
      );
      onChunk(arrayBufferToBase64(buffer), {
        encoding: "pcm_s16le",
        sample_rate: this.context?.sampleRate,
        channels: 1,
      });
    };
    this.source.connect(this.worklet);
    this.worklet.connect(this.silentGain);
    this.silentGain.connect(this.context.destination);
  }

  private startMediaRecorderFallback(onChunk: ChunkHandler) {
    if (!this.stream) return;
    this.recorder = new MediaRecorder(this.stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm",
    });
    this.recorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = String(reader.result);
        const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
        onChunk(base64, {
          encoding: "webm_opus",
          mime_type: event.data.type,
          channels: 1,
        });
      };
      reader.readAsDataURL(event.data);
    };
    this.recorder.start(250);
  }
}

export const micCapture = new MicCapture();
