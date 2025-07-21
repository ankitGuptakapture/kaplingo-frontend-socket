import { useRef, useState, useEffect } from 'react';
import { useWebSocket } from './webSocket/useWebSocket';
import { PCM16StreamPlayer, playPCM16 } from './utils/audio';
import { MicrophoneStatus } from './components/MicrophoneStatus';
import { ConnectButton } from './components/ConnectButton';

const SOCKET_URL = 'https://kaplingo-backend-socket-uh86.onrender.com/';
const ROOM_ID = 'fnjnfjnf';
const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SIZE = 1024;
const MIN_CHUNK_SIZE = 512;
const SPEECH_THRESHOLD = 0.2; // RMS threshold for speech detection - increased to filter background noise
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


    on('audio:stream:start', handleStreamStart);
    on('audio:stream', handleStream);
    on('audio:stream:stop', handleStreamStop);

  
    return () => {
      off('audio:stream:start', handleStreamStart);
      off('audio:stream', handleStream);
      off('audio:stream:stop', handleStreamStop);
      playerRef.current?.stop();
    };
  }, [on, off]);

  useEffect(() => {
    emit('room:join', { room: ROOM_ID });
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

    const totalLength = audioBufferRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
    if (totalLength === 0) return;

    const combinedBuffer = new Int16Array(totalLength);
    let offset = 0;

    audioBufferRef.current.forEach(chunk => {
      combinedBuffer.set(chunk, offset);
      offset += chunk.length;
    });

    emit('audio:send', {
      room: ROOM_ID,
      audioBuffer: combinedBuffer.buffer
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
      emit('audio:silence', { room: ROOM_ID });
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
        }
      });

      mediaStreamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: TARGET_SAMPLE_RATE,
        latencyHint: 'interactive'
      });

      audioContextRef.current = audioContext;

      const blob = new Blob([workletProcessor], { type: 'application/javascript' });
      const workletURL = URL.createObjectURL(blob);

      await audioContext.audioWorklet.addModule(workletURL);

      const workletNode = new AudioWorkletNode(audioContext, 'pcm16-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers'
      });

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
      console.log('Audio streaming started with manual speech detection');

    } catch (error) {
      console.error('Error starting audio streaming:', error);
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

    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center">
        <MicrophoneStatus connected={connected} />
        <ConnectButton isRoomJoined={true} connected={connected} onClick={connected ? stopStreaming : startStreaming} />

        <div className="mt-6 text-center text-gray-400 text-xs space-y-2">
          <div>🎵 Audio at {TARGET_SAMPLE_RATE}Hz</div>
          <div>📦 Chunk size: {CHUNK_SIZE} samples</div>

          {isSpeaking && (
            <div className="mt-4 space-y-2">
              <div className="text-green-600 font-medium animate-pulse">
                🎤 Speaking - collecting audio
              </div>
              <div className="text-sm text-gray-500">
                Buffered: {bufferDuration.toFixed(1)}s
              </div>
            </div>
          )}

          {connected && !isSpeaking && (
            <div className="text-blue-600 font-medium">
              🔗 Ready - waiting for speech
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
