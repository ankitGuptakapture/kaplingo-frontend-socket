// Utility to play PCM16 audio data using Web Audio API
export function playPCM16(pcm16: Int16Array, sampleRate = 44100) {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const buffer = audioCtx.createBuffer(1, pcm16.length, sampleRate);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 0x8000;
  }
  buffer.getChannelData(0).set(float32);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
} 


// Manages seamless playback of raw PCM-16 audio streams.
export class PCM16StreamPlayer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime: number = 0;
  private isPlaying: boolean = false;
  private sampleRate: number;

  constructor(sampleRate: number = 16000) {
    this.sampleRate = sampleRate;
  }

  // Initializes the AudioContext. Must be called after a user interaction.
  private initAudioContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext ||
        (window as any).webkitAudioContext)({
        sampleRate: this.sampleRate,
      });
    }
  }

  // Call this when you receive the 'audio:stream:start' event.
  public start() {
    this.initAudioContext();
    if (this.isPlaying || !this.audioCtx) return;

    this.isPlaying = true;
    // Set the start time for the very first chunk.
    this.nextStartTime = this.audioCtx.currentTime;
    console.log("Audio stream playback started.");
  }

  // Call this when you receive the 'audio:stream:stop' event.
  public stop() {
    this.isPlaying = false;
    console.log("Audio stream playback stopped.");
  }

  // Processes and schedules each incoming audio chunk for playback.
  public playChunk(pcm16: Int16Array) {
    if (!this.isPlaying || !this.audioCtx) return;

    // 1. Create an AudioBuffer from the raw PCM data.
    const buffer = this.audioCtx.createBuffer(
      1,
      pcm16.length,
      this.sampleRate
    );

    // 2. Convert the Int16 data to Float32 data [-1.0, 1.0].
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0; // Normalize to [-1, 1] range
    }
    buffer.getChannelData(0).set(float32);

    // 3. Create a source node to play the buffer.
    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);

    // 4. Schedule the chunk to play.
    // If nextStartTime is in the past, it will start immediately.
    const scheduledTime = Math.max(this.nextStartTime, this.audioCtx.currentTime);
    source.start(scheduledTime);

    // 5. Calculate the start time for the *next* chunk.
    this.nextStartTime = scheduledTime + buffer.duration;
  }
}