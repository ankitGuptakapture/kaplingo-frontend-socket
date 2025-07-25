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


export class PCM16StreamPlayer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime: number = 0;
  private isPlaying: boolean = false;
  private sampleRate: number;
  private chunkQueue: Int16Array[] = [];
  private isProcessing: boolean = false;

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
    this.chunkQueue = []; // Clear any existing queue
    this.isProcessing = false;
    // Set the start time for the very first chunk.
    this.nextStartTime = this.audioCtx.currentTime;
    console.log("Audio stream playback started.");
  }

  // Call this when you receive the 'audio:stream:stop' event.
  public stop() {
    this.isPlaying = false;
    this.chunkQueue = []; // Clear the queue
    this.isProcessing = false;
    console.log("Audio stream playback stopped.");
  }

  // Processes and schedules each incoming audio chunk for playback.
  public playChunk(pcm16: Int16Array) {
    if (!this.isPlaying || !this.audioCtx) return;

    // Add chunk to queue
    this.chunkQueue.push(pcm16);
    
    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private processQueue() {
    if (!this.isPlaying || !this.audioCtx || this.isProcessing) return;

    this.isProcessing = true;

    // Process only one chunk at a time
    if (this.chunkQueue.length > 0) {
      const pcm16 = this.chunkQueue.shift()!;
      this.scheduleChunk(pcm16);
    }

    this.isProcessing = false;

    // Schedule next chunk processing if queue has more items
    if (this.chunkQueue.length > 0 && this.isPlaying) {
      // Use a small delay to prevent overwhelming the audio context
      setTimeout(() => this.processQueue(), 10);
    }
  }

  private scheduleChunk(pcm16: Int16Array): void {
    if (!this.audioCtx) return;

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

    // 4. Schedule the chunk to play at the correct time in sequence
    const currentTime = this.audioCtx.currentTime;
    const scheduledTime = Math.max(this.nextStartTime, currentTime + 0.01);
    
    source.start(scheduledTime);

    // 5. Calculate the start time for the *next* chunk.
    this.nextStartTime = scheduledTime + buffer.duration;

    console.log(`Scheduled chunk at ${scheduledTime.toFixed(3)}s, next at ${this.nextStartTime.toFixed(3)}s`);
  }

  // Optional: Get current queue length for debugging
  public getQueueLength(): number {
    return this.chunkQueue.length;
  }

  // Optional: Clear the queue manually
  public clearQueue() {
    this.chunkQueue = [];
    this.isProcessing = false;
  }
}
