import { useRef, useState, useEffect } from "react";
import { useWebSocket } from "./webSocket/useWebSocket";
import { PCM16StreamPlayer } from "./utils/audio";
import { MicrophoneStatus } from "./components/MicrophoneStatus";
import { ConnectButton } from "./components/ConnectButton";
import { v4 as uuidv4 } from "uuid";

export const userId = uuidv4();

const SOCKET_URL = "https://kaplingo-backend-socket-uh86.onrender.com";
export const ROOM_ID = "fnjnfjnf";
const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SIZE = 1024;
const SPEECH_THRESHOLD = 0.01; // RMS threshold for speech detection
const SILENCE_DURATION = 500; // ms of silence before sending

function App() {
  const [connected, setConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [bufferDuration, setBufferDuration] = useState(0);
  const [isRoomJoined, setIsRoomJoined] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("english");
  const speakingRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioBufferRef = useRef<Int16Array[]>([]);
  const bufferStartTimeRef = useRef<number | null>(null);
  const bufferSizeRef = useRef(0);
  const lastSpeechTimeRef = useRef<number | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playerRef = useRef<PCM16StreamPlayer | null>(null);

  const { emit, disconnect, on, off } = useWebSocket({
    url: SOCKET_URL,
  });


  useEffect(() => {
    if (!playerRef.current) {
      playerRef.current = new PCM16StreamPlayer(16000);
    }

    const handleStreamStart = () => {
      playerRef.current?.start();
    };

    const handleStream = ({ audioBuffer }: { audioBuffer: ArrayBuffer }) => {
      const pcm16 = new Int16Array(audioBuffer);
      playerRef.current?.playChunk(pcm16);
    };

    const handleStreamStop = () => {
      playerRef.current?.stop();
    };

    on("audio:stream:start", handleStreamStart);
    on("audio:stream", handleStream);
    on("audio:stream:stop", handleStreamStop);

    return () => {
      off("audio:stream:start", handleStreamStart);
      off("audio:stream", handleStream);
      off("audio:stream:stop", handleStreamStop);
      playerRef.current?.stop();
    };
  }, [on, off]);

  useEffect(() => {
    window.addEventListener('beforeunload', () => {
      window.navigator.sendBeacon(`${SOCKET_URL}/api/user-left`, JSON.stringify({ room: ROOM_ID, user: userId }));
    });
  }, [])

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

    audioBufferRef.current = [];
    bufferSizeRef.current = 0;
    bufferStartTimeRef.current = null;
    setBufferDuration(0);
  };

  // Function to handle silence detection
  const handleSilence = () => {
    if (speakingRef.current) {
      sendBufferedAudio();
      emit("audio:silence", { room: ROOM_ID });
      speakingRef.current = false;
      setIsSpeaking(false);
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  };

  // Handle speech detection and buffering
  const handleAudioChunk = (audioData: ArrayBuffer, rms: number) => {
    const pcm16 = new Int16Array(audioData);
    const isSpeech = checkIfSpeaking(rms);
    const now = Date.now();

    // If speech is detected
    if (isSpeech) {
      lastSpeechTimeRef.current = now;

      // Clear any pending silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      if (!speakingRef.current) {
        // Speech just started
        speakingRef.current = true;
        setIsSpeaking(true);
        bufferStartTimeRef.current = now;
      }
    }

    // Buffer audio if we're in a speech segment
    if (speakingRef.current) {
      audioBufferRef.current.push(pcm16);
      bufferSizeRef.current += pcm16.length;
      if (bufferStartTimeRef.current) {
        setBufferDuration((now - bufferStartTimeRef.current) / 1000);
      }
    }

    // If we were speaking but are now silent, start a timeout
    if (speakingRef.current && !isSpeech) {
      if (!silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(handleSilence, SILENCE_DURATION);
      }
    }
  };
  // emit("audio:silence",{room:ROOM_ID})
  // Start streaming
  const handleRoom = () => {
    emit("room:join", { room: ROOM_ID, lang: selectedLanguage, user: userId });
    setIsRoomJoined(true);
  };
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

      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioContext = new AudioContextClass({
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

    // disconnect();
  };

  if (!isRoomJoined) {
    // Initial state - mobile view with fixed height and original theme
    return (
      <div className="h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 relative overflow-hidden flex items-center justify-center p-4">
        {/* Neural network background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />
          {/* Floating AI particles */}
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full opacity-30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${3 + Math.random() * 4
                  }s ease-in-out infinite`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(120,119,198,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(120,119,198,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        </div>

        {/* Mobile container with fixed height */}
        <div className="relative z-10 w-full max-w-sm mx-auto">
          <div className="h-[600px] bg-slate-900/80 backdrop-blur-2xl rounded-3xl border-2 border-slate-700/50 shadow-2xl shadow-black/50 overflow-hidden flex flex-col">
            {/* Mobile status bar */}
            <div className="bg-slate-800/80 px-6 py-3 border-b border-slate-700/30 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-md flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  </div>
                  <span className="text-white text-sm font-medium">
                    Neural Voice
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse" />
                  <span className="text-slate-400 text-xs">Offline</span>
                </div>
              </div>
            </div>

            {/* Main content - flex-1 to fill remaining space */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 space-y-8">
              {/* AI Logo/Icon */}
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-cyan-500/25">
                  <svg
                    className="w-10 h-10 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl animate-ping opacity-20" />
              </div>

              {/* Title */}
              <div className="text-center">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-cyan-200 to-blue-300 bg-clip-text text-transparent mb-3 tracking-tight">
                  Neural Voice
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed">
                  AI-powered voice interaction with neural processing
                </p>
              </div>

              {/* Language Selection Dropdown */}
              <div className="w-full space-y-2">
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  Select Language
                </label>
                <div className="relative">
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/60 backdrop-blur-sm border border-slate-600/50 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-300 appearance-none cursor-pointer"
                  >
                    <option
                      value=""
                      disabled
                      className="bg-slate-800 text-slate-400"
                    >
                      🌐 Choose your language...
                    </option>
                    <option value="english" className="bg-slate-800 text-white">
                      🇺🇸 English
                    </option>
                    <option value="spanish" className="bg-slate-800 text-white">
                      🇪🇸 Spanish
                    </option>
                    <option value="french" className="bg-slate-800 text-white">
                      🇫🇷 French
                    </option>
                    <option value="german" className="bg-slate-800 text-white">
                      🇩🇪 German
                    </option>
                    <option value="hindi" className="bg-slate-800 text-white">
                      🇮🇳 Hindi
                    </option>
                    <option value="russian" className="bg-slate-800 text-white">
                      🇷🇺 Russian
                    </option>
                    <option
                      value="portuguese"
                      className="bg-slate-800 text-white"
                    >
                      🇵🇹 Portuguese
                    </option>
                    <option
                      value="japanese"
                      className="bg-slate-800 text-white"
                    >
                      🇯🇵 Japanese
                    </option>
                    <option value="italian" className="bg-slate-800 text-white">
                      🇮🇹 Italian
                    </option>
                    <option value="dutch" className="bg-slate-800 text-white">
                      🇳🇱 Dutch
                    </option>
                  </select>
                  {/* Custom dropdown arrow */}
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <svg
                      className="w-4 h-4 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
                {/* Selected language display */}
                {selectedLanguage && (
                  <div className="text-xs text-cyan-400 mt-1 flex items-center space-x-1">
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>
                      Language selected:{" "}
                      {selectedLanguage.charAt(0).toUpperCase() +
                        selectedLanguage.slice(1)}
                    </span>
                  </div>
                )}
              </div>

              {/* Join button - disabled until language is selected */}
              <button
                onClick={handleRoom}
                disabled={!selectedLanguage}
                className={`group relative w-full px-8 py-4 rounded-xl font-semibold text-white shadow-2xl transition-all duration-500 transform ${selectedLanguage
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-105 cursor-pointer"
                    : "bg-slate-700 shadow-slate-700/25 cursor-not-allowed opacity-50"
                  }`}
              >
                {selectedLanguage && (
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                )}
                <span className="relative flex items-center justify-center space-x-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span>
                    {selectedLanguage
                      ? "Initialize Neural Link"
                      : "Select Language First"}
                  </span>
                </span>
              </button>
            </div>

            {/* Footer */}
            <div className="bg-slate-800/60 px-6 py-3 border-t border-slate-700/30 flex-shrink-0">
              <div className="text-center">
                <div className="text-slate-500 text-xs">
                  <div className="flex items-center justify-center space-x-1">
                    <div className="w-1 h-1 bg-slate-500 rounded-full" />
                    <span>Neural Networks • Standby mode</span>
                    <div className="w-1 h-1 bg-slate-500 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active interface - mobile view with fixed height and original theme
  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 relative overflow-hidden flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="absolute inset-0">
        {/* Neural network grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(120,119,198,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(120,119,198,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />

        {/* Floating particles */}
        {[...Array(40)].map((_, i) => (
          <div
            key={i}
            className={`absolute rounded-full ${i % 3 === 0
                ? "bg-cyan-400"
                : i % 3 === 1
                  ? "bg-blue-400"
                  : "bg-purple-400"
              }`}
            style={{
              width: `${1 + Math.random() * 2}px`,
              height: `${1 + Math.random() * 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0.1 + Math.random() * 0.2,
              animation: `float ${4 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}

        {/* Radial gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.08),transparent_50%)]" />
      </div>

      {/* Mobile container with fixed height */}
      <div className="relative z-10 w-full max-w-sm mx-auto">
        <div className="h-[600px] bg-slate-900/80 backdrop-blur-2xl rounded-3xl border-2 border-slate-700/50 shadow-2xl shadow-black/50 overflow-hidden flex flex-col">
          {/* Mobile status bar */}
          <div className="bg-slate-800/80 px-6 py-3 border-b border-slate-700/30 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-md flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                </div>
                <span className="text-white text-sm font-medium">
                  Neural Voice
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse" />
                <span className="text-slate-400 text-xs">Active</span>
              </div>
            </div>
          </div>

          {/* Main content - flex-1 to fill remaining space */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 space-y-6">
            {/* Microphone Status */}
            <div className="flex justify-center">
              <MicrophoneStatus connected={connected} isSpeaking={isSpeaking} />
            </div>

            {/* Static/Animated Waveform Visualization */}
            <div className="w-full h-16 flex items-center justify-center bg-slate-800/40 rounded-2xl backdrop-blur-sm border border-slate-700/30 px-4">
              <div className="w-full h-10 flex items-center justify-center relative overflow-hidden">
                {/* Static waveform when not speaking */}
                <div className="flex items-center space-x-1 w-full justify-center">
                  {[...Array(45)].map((_, i) => {
                    const staticHeight =
                      4 + Math.sin(i * 0.4) * 8 + Math.cos(i * 0.2) * 6;
                    const animatedHeight = isSpeaking
                      ? 4 +
                      Math.sin(i * 0.3 + Date.now() * 0.01) * 15 +
                      Math.random() * 12
                      : staticHeight;

                    return (
                      <div
                        key={i}
                        className={`rounded-full transition-all duration-300 ${isSpeaking
                            ? "bg-gradient-to-t from-cyan-500 via-blue-400 to-purple-400 opacity-80"
                            : "bg-gradient-to-t from-slate-600 to-slate-500 opacity-60"
                          }`}
                        style={{
                          width: "2px",
                          height: `${Math.max(4, animatedHeight)}px`,
                          animation: isSpeaking
                            ? `wave ${0.4 + Math.random() * 0.3
                            }s ease-in-out infinite`
                            : "none",
                          animationDelay: `${i * 0.02}s`,
                        }}
                      />
                    );
                  })}
                </div>

                {/* Moving gradient overlay only when speaking */}
                {isSpeaking && (
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent"
                    style={{ animation: "slideWave 2s ease-in-out infinite" }}
                  />
                )}
              </div>
            </div>

            {/* Control Button */}
            <div className="w-full px-2">
              <ConnectButton
                isRoomJoined={isRoomJoined}
                connected={connected}
                onClick={connected ? stopStreaming : startStreaming}
              />
            </div>

            {/* Status Card */}
            <div className="w-full bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/30 p-4">
              {/* Neural activity indicator */}
              {isSpeaking && (
                <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <div className="w-3 h-3 bg-cyan-400 rounded-full animate-ping" />
                        <div className="absolute inset-0 w-3 h-3 bg-cyan-400 rounded-full" />
                      </div>
                      <div>
                        <div className="text-cyan-300 font-medium text-sm">
                          Neural Processing
                        </div>
                        <div className="text-cyan-200/70 text-xs">
                          Analyzing patterns
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-cyan-200 font-mono text-sm">
                        {bufferDuration.toFixed(1)}s
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Ready state */}
              {connected && !isSpeaking && (
                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
                    <div>
                      <div className="text-blue-300 font-medium text-sm">
                        System Ready
                      </div>
                      <div className="text-blue-200/70 text-xs">
                        Listening for input
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* System metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-700/40 rounded-lg p-2 text-center">
                  <div className="text-slate-300 text-xs mb-1">Sample Rate</div>
                  <div className="text-cyan-400 font-mono text-sm font-semibold">
                    {TARGET_SAMPLE_RATE}Hz
                  </div>
                </div>
                <div className="bg-slate-700/40 rounded-lg p-2 text-center">
                  <div className="text-slate-300 text-xs mb-1">Buffer</div>
                  <div className="text-purple-400 font-mono text-sm font-semibold">
                    {CHUNK_SIZE}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-800/60 px-6 py-3 border-t border-slate-700/30 flex-shrink-0">
            <div className="text-center">
              <div className="text-slate-500 text-xs">
                <div className="flex items-center justify-center space-x-1">
                  <div className="w-1 h-1 bg-slate-500 rounded-full" />
                  <span>Neural Networks • Real-time processing</span>
                  <div className="w-1 h-1 bg-slate-500 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
