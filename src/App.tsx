import { useRef, useState, useEffect } from "react";
import { useWebSocket } from "./webSocket/useWebSocket";
import { playPCM16 } from "./utils/audio";
import { MicrophoneStatus } from "./components/MicrophoneStatus";
import { ConnectButton } from "./components/ConnectButton";
import { MatrixBackground } from "./components/MatrixBackground";

const SOCKET_URL = "http://localhost:8080";
const ROOM_ID = "fnjnfjnf";
const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SIZE = 1024;
const MIN_CHUNK_SIZE = 512;
const SPEECH_THRESHOLD = 0.01; // RMS threshold for speech detection
const SILENCE_DURATION = 500; // ms of silence before sending

function App() {
  const [connected, setConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [bufferDuration, setBufferDuration] = useState(0);

  const speakingRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioBufferRef = useRef<Int16Array[]>([]);
  const bufferStartTimeRef = useRef<number | null>(null);
  const bufferSizeRef = useRef(0);
  const lastSpeechTimeRef = useRef<number | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { emit, disconnect, on, off } = useWebSocket({
    url: SOCKET_URL,
  });

  useEffect(() => {
    const handleStream = ({ audioBuffer }: { audioBuffer: ArrayBuffer }) => {
      const pcm16 = new Int16Array(audioBuffer);
      playPCM16(pcm16, TARGET_SAMPLE_RATE);
    };

    on("audio:stream", handleStream);

    return () => {
      off("audio:stream", handleStream);
    };
  }, [on, off]);

  useEffect(() => {
    emit("room:join", { room: ROOM_ID });
  }, []);

  // Audio processing worklet
  const workletProcessor = `
    class PCM16Processor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.buffer = [];
        this.bufferSize = 0;
        this.targetChunkSize = ${CHUNK_SIZE};
      }
      
      process(inputs) {
        const input = inputs[0];
        if (!input || !input[0] || input[0].length === 0) return true;
        
        const channelData = input[0];
        const pcm16 = new Int16Array(channelData.length);
        
        for (let i = 0; i < channelData.length; i++) {
          let sample = channelData[i];
          
          // Soft clipping to prevent distortion
          if (sample > 0.95) sample = 0.95 + 0.05 * Math.tanh((sample - 0.95) * 20);
          else if (sample < -0.95) sample = -0.95 + 0.05 * Math.tanh((sample + 0.95) * 20);
          
          const dither = (Math.random() - 0.5) * (1.0 / 32768.0);
          sample += dither;
          
          const scaled = sample * 32767;
          pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(scaled)));
        }
        
        this.buffer.push(pcm16);
        this.bufferSize += pcm16.length;
        
        if (this.bufferSize >= this.targetChunkSize) {
          this.flushBuffer();
        }
        
        return true;
      }
      
      flushBuffer() {
        if (this.buffer.length === 0) return;
        
        const totalSamples = this.bufferSize;
        const combinedBuffer = new Int16Array(totalSamples);
        let offset = 0;
        
        for (const chunk of this.buffer) {
          combinedBuffer.set(chunk, offset);
          offset += chunk.length;
        }
        
        // Calculate RMS for speech detection
        let sumSquares = 0;
        for (let i = 0; i < combinedBuffer.length; i++) {
          sumSquares += (combinedBuffer[i] / 32768) ** 2;
        }
        const rms = Math.sqrt(sumSquares / combinedBuffer.length);
        
        this.port.postMessage({
          audioData: combinedBuffer.buffer,
          rms: rms
        });
        
        this.buffer = [];
        this.bufferSize = 0;
      }
    }
    registerProcessor('pcm16-processor', PCM16Processor);
  `;

  // Check if user is speaking based on RMS
  const checkIfSpeaking = (rms: number) => {
    return rms > SPEECH_THRESHOLD;
  };

  // Send collected audio when speech ends
  const sendBufferedAudio = () => {
    if (audioBufferRef.current.length === 0) return;

    const totalLength = audioBufferRef.current.reduce(
      (sum, chunk) => sum + chunk.length,
      0
    );
    if (totalLength === 0) return;

    const combinedBuffer = new Int16Array(totalLength);
    let offset = 0;

    audioBufferRef.current.forEach((chunk) => {
      combinedBuffer.set(chunk, offset);
      offset += chunk.length;
    });

    emit("audio:send", {
      room: ROOM_ID,
      audioBuffer: combinedBuffer.buffer,
    });

    console.log(`✓ Sent buffered audio: ${combinedBuffer.length} samples`);

    // Reset buffer
    audioBufferRef.current = [];
    bufferSizeRef.current = 0;
    bufferStartTimeRef.current = null;
    setBufferDuration(0);
  };

  // Handle speech detection and buffering
  const handleAudioChunk = (audioData: ArrayBuffer, rms: number) => {
    const pcm16 = new Int16Array(audioData);
    const isSpeech = checkIfSpeaking(rms);
    const now = Date.now();

    // Handle speech detection
    if (isSpeech) {
      lastSpeechTimeRef.current = now;

      if (!speakingRef.current) {
        // Speech just started
        speakingRef.current = true;
        setIsSpeaking(true);
        bufferStartTimeRef.current = now;

        // Clear any existing silence timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
      }
    }

    // Buffer audio if we're in a speech segment
    if (speakingRef.current) {
      audioBufferRef.current.push(pcm16);
      bufferSizeRef.current += pcm16.length;

      // Update buffer duration
      if (bufferStartTimeRef.current) {
        setBufferDuration((now - bufferStartTimeRef.current) / 1000);
      }
    }

    // Handle silence detection
    if (speakingRef.current && !isSpeech && lastSpeechTimeRef.current) {
      const timeSinceLastSpeech = now - lastSpeechTimeRef.current;

      // Set timeout to end speech if silence continues
      if (!silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          if (speakingRef.current) {
            console.log("Speech ended - sending buffered audio");
            speakingRef.current = false;
            setIsSpeaking(false);
            sendBufferedAudio();
          }
          silenceTimeoutRef.current = null;
        }, SILENCE_DURATION);
      }
    }
  };

  // Start streaming
  const startStreaming = async () => {
    if (connected) return;

    try {
      setConnected(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: { ideal: TARGET_SAMPLE_RATE },
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)({
        sampleRate: TARGET_SAMPLE_RATE,
        latencyHint: "interactive",
      });

      audioContextRef.current = audioContext;

      const blob = new Blob([workletProcessor], {
        type: "application/javascript",
      });
      const workletURL = URL.createObjectURL(blob);

      await audioContext.audioWorklet.addModule(workletURL);

      const workletNode = new AudioWorkletNode(
        audioContext,
        "pcm16-processor",
        {
          numberOfInputs: 1,
          numberOfOutputs: 0,
          channelCount: 1,
          channelCountMode: "explicit",
          channelInterpretation: "speakers",
        }
      );

      workletNodeRef.current = workletNode;

      // Handle audio chunks with RMS values
      workletNode.port.onmessage = (event) => {
        if (event.data && event.data.audioData) {
          handleAudioChunk(event.data.audioData, event.data.rms);
        }
      };

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(workletNode);

      URL.revokeObjectURL(workletURL);
      console.log("Audio streaming started with manual speech detection");
    } catch (error) {
      console.error("Error starting audio streaming:", error);
      setConnected(false);
    }
  };

  // Stop streaming
  const stopStreaming = () => {
    // Clear silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    // Send any remaining buffered audio
    if (speakingRef.current) {
      sendBufferedAudio();
    }

    setConnected(false);
    setIsSpeaking(false);
    speakingRef.current = false;

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Reset all buffer references
    audioBufferRef.current = [];
    bufferSizeRef.current = 0;
    bufferStartTimeRef.current = null;
    lastSpeechTimeRef.current = null;
    setBufferDuration(0);

    disconnect();
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Matrix Background Animation */}
      <MatrixBackground />

      {/* Ambient Glow Effects */}
      <div className="absolute inset-0 z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/5 rounded-full blur-2xl"></div>
      </div>

      {/* Main Container */}
      <div className="relative w-full max-w-md bg-black/80 backdrop-blur-2xl rounded-2xl shadow-2xl border border-green-500/20 p-8 flex flex-col items-center z-20 overflow-hidden">
        {/* Animated Border */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-green-400/20 via-cyan-400/20 to-green-400/20 p-[1px]">
          <div className="w-full h-full bg-black/90 rounded-2xl"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 w-full flex flex-col items-center">
          {/* Header with AI Branding */}
          <div className="w-full text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-cyan-400 rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                </div>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 via-cyan-400 to-green-400 bg-clip-text text-transparent">
                NEURAL VOICE
              </h1>
            </div>
            <p className="text-gray-400 text-sm font-mono">
              AI-Powered Audio Interface
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="w-1 h-1 bg-green-400 rounded-full animate-ping"></div>
              <span className="text-xs text-green-400 font-mono">
                SYSTEM ACTIVE
              </span>
              <div className="w-1 h-1 bg-green-400 rounded-full animate-ping"></div>
            </div>
          </div>

          {/* Enhanced Microphone Status */}
          <div className="mb-6">
            <MicrophoneStatus connected={connected} />
          </div>

          {/* Enhanced Connect Button */}
          <div className="mb-8">
            <ConnectButton
              connected={connected}
              onClick={connected ? stopStreaming : startStreaming}
            />
          </div>

          {/* Advanced Status Panel */}
          <div className="w-full bg-gray-900/50 rounded-xl p-6 border border-green-500/20 backdrop-blur-sm">
            {/* System Status Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-mono text-green-400">
                SYSTEM STATUS
              </span>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    connected ? "bg-green-400 animate-pulse" : "bg-gray-500"
                  }`}
                ></div>
                <span className="text-xs font-mono text-gray-400">
                  {connected ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
            </div>

            {/* Technical Specs */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-black/30 rounded-lg p-3 border border-green-500/10">
                <div className="text-xs text-gray-400 font-mono mb-1">
                  SAMPLE RATE
                </div>
                <div className="text-sm text-green-400 font-mono">
                  {TARGET_SAMPLE_RATE}Hz
                </div>
              </div>
              <div className="bg-black/30 rounded-lg p-3 border border-cyan-500/10">
                <div className="text-xs text-gray-400 font-mono mb-1">
                  CHUNK SIZE
                </div>
                <div className="text-sm text-cyan-400 font-mono">
                  {CHUNK_SIZE}
                </div>
              </div>
            </div>

            {/* Dynamic Status Display */}
            <div className="space-y-4">
              {/* Speaking Status */}
              {isSpeaking && (
                <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-green-400 rounded-full animate-pulse"
                          style={{
                            height: `${12 + Math.random() * 8}px`,
                            animationDelay: `${i * 0.1}s`,
                          }}
                        ></div>
                      ))}
                    </div>
                    <span className="text-green-400 font-mono text-sm">
                      RECORDING ACTIVE
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-400 font-mono">
                        BUFFER DURATION
                      </span>
                      <span className="text-xs text-green-400 font-mono">
                        {bufferDuration.toFixed(2)}s
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-400 to-cyan-400 h-2 rounded-full transition-all duration-300 relative"
                        style={{
                          width: `${Math.min(bufferDuration * 10, 100)}%`,
                        }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Listening Status */}
              {connected && !isSpeaking && (
                <div className="bg-cyan-500/10 rounded-lg p-4 border border-cyan-500/20">
                  <div className="flex items-center justify-center gap-3">
                    <div className="relative">
                      <div className="w-4 h-4 border-2 border-cyan-400 rounded-full animate-spin border-t-transparent"></div>
                      <div className="absolute inset-0 w-4 h-4 border border-cyan-400/30 rounded-full animate-ping"></div>
                    </div>
                    <span className="text-cyan-400 font-mono text-sm">
                      LISTENING MODE
                    </span>
                  </div>
                </div>
              )}

              {/* Disconnected Status */}
              {!connected && (
                <div className="bg-gray-500/10 rounded-lg p-4 border border-gray-500/20">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                    <span className="text-gray-400 font-mono text-sm">
                      SYSTEM STANDBY
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Footer */}
          <div className="mt-6 text-center">
            <div className="text-xs text-gray-500 font-mono mb-2">
              POWERED BY NEURAL NETWORKS
            </div>
            <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
              <span>WebSocket</span>
              <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
              <span>WebAudio API</span>
              <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
              <span>Real-time AI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
