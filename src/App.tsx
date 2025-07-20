import { useRef, useState, useEffect } from 'react';
import { useWebSocket } from './webSocket/useWebSocket';
import { playPCM16 } from './utils/audio';
import { MicrophoneStatus } from './components/MicrophoneStatus';
import { VoicebotLog } from './components/VoicebotLog';
import { ConnectButton } from './components/ConnectButton';
import { recordAudio } from 'vad-web';

const SOCKET_URL = 'http://localhost:8080';
const ROOM_ID = 'fnjnfjnf';
const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SIZE = 1024; // Larger chunks for better quality
const MIN_CHUNK_SIZE = 512; // Minimum chunk size before sending

function App() {
  const [connected, setConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const vadRef = useRef<null | (() => void)>(null);
  const audioBufferRef = useRef<Int16Array[]>([]);

  // WebSocket setup
  const { emit, disconnect, on, off } = useWebSocket({
    url: SOCKET_URL,
  });

  useEffect(() => {
    const handleStream = ({ audioBuffer }: { audioBuffer: ArrayBuffer | Int16Array | Int16Array[] }) => {
      let pcm16;
      if (audioBuffer instanceof ArrayBuffer) {
        pcm16 = new Int16Array(audioBuffer);
      } else if (Array.isArray(audioBuffer)) {
        pcm16 = Int16Array.from(audioBuffer);
      } else if (typeof audioBuffer === 'object' && audioBuffer !== null) {
        pcm16 = Int16Array.from(Object.values(audioBuffer));
      } else {
        console.error('Unknown audioBuffer format', audioBuffer);
        return;
      }
      playPCM16(pcm16, TARGET_SAMPLE_RATE);
    };
    
    const handleSilence = ({ user }: { user: string }) => {
      console.log('Received silence from:', user);
    };
    
    on('audio:stream', handleStream);
    on('audio:silence', handleSilence);
    
    return () => {
      off('audio:stream', handleStream);
      off('audio:silence', handleSilence);
    };
  }, [on, off]);

  // High-quality AudioWorklet processor with better audio processing
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
        if (!input || !input[0] || input[0].length === 0) {
          return true;
        }
        
        const channelData = input[0]; // Mono channel
        const pcm16 = new Int16Array(channelData.length);
        
        // High-quality float32 to int16 conversion with dithering
        for (let i = 0; i < channelData.length; i++) {
          let sample = channelData[i];
          
          // Apply soft clipping to prevent harsh distortion
          if (sample > 0.95) sample = 0.95 + 0.05 * Math.tanh((sample - 0.95) * 20);
          else if (sample < -0.95) sample = -0.95 + 0.05 * Math.tanh((sample + 0.95) * 20);
          
          // Add subtle dithering to reduce quantization noise
          const dither = (Math.random() - 0.5) * (1.0 / 32768.0);
          sample += dither;
          
          // Convert to 16-bit with proper scaling
          const scaled = sample * 32767;
          pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(scaled)));
        }
        
        // Buffer audio chunks for consistent chunk sizes
        this.buffer.push(pcm16);
        this.bufferSize += pcm16.length;
        
        // Send when we have enough data
        if (this.bufferSize >= this.targetChunkSize) {
          this.flushBuffer();
        }
        
        return true;
      }
      
      flushBuffer() {
        if (this.buffer.length === 0) return;
        
        // Combine all buffered chunks
        const totalSamples = this.bufferSize;
        const combinedBuffer = new Int16Array(totalSamples);
        let offset = 0;
        
        for (const chunk of this.buffer) {
          combinedBuffer.set(chunk, offset);
          offset += chunk.length;
        }
        
        // Send the combined buffer
        this.port.postMessage(combinedBuffer.buffer);
        
        // Clear buffer
        this.buffer = [];
        this.bufferSize = 0;
      }
    }
    registerProcessor('pcm16-processor', PCM16Processor);
  `;

  // High-quality resampling using linear interpolation
  const resampleAudio = (inputBuffer: Int16Array, inputSampleRate: number, targetSampleRate: number): Int16Array => {
    if (inputSampleRate === targetSampleRate) {
      return inputBuffer;
    }
    
    const ratio = inputSampleRate / targetSampleRate;
    const outputLength = Math.floor(inputBuffer.length / ratio);
    const output = new Int16Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexInt = Math.floor(srcIndex);
      const srcIndexNext = Math.min(srcIndexInt + 1, inputBuffer.length - 1);
      const fraction = srcIndex - srcIndexInt;
      
      // Linear interpolation for better quality
      const sample1 = inputBuffer[srcIndexInt];
      const sample2 = inputBuffer[srcIndexNext];
      output[i] = Math.round(sample1 + (sample2 - sample1) * fraction);
    }
    
    return output;
  };

  // Send buffered audio chunks for better quality
  const sendBufferedAudio = () => {
    if (audioBufferRef.current.length === 0) return;
    
    // Combine all buffered chunks
    const totalLength = audioBufferRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
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
    
    console.log(`✓ Sent buffered audio: ${combinedBuffer.length} samples`);
    
    // Clear buffer
    audioBufferRef.current = [];
  };

  useEffect(() => {
    emit('room:join', { room: ROOM_ID });
  }, [emit]);

  // Start streaming with high-quality audio settings
  const startStreaming = async () => {
    if (connected) return;
    
    try {
      console.log('Starting high-quality audio streaming...');
      setConnected(true);
      
      // Request high-quality audio with optimal settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1, // Mono for voice
          sampleRate: { ideal: TARGET_SAMPLE_RATE, min: 16000, max: 48000 },
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Advanced constraints for better quality
          googEchoCancellation: true,
          googAutoGainControl: true,
          googNoiseSuppression: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
          googAudioMirroring: false
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Log actual audio track settings
      const audioTrack = stream.getAudioTracks()[0];
      const settings = audioTrack.getSettings();
      console.log('Audio track settings:', settings);
      
      // Create AudioContext with optimal settings
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: TARGET_SAMPLE_RATE,
        latencyHint: 'interactive'
      });
      
      audioContextRef.current = audioContext;
      console.log('AudioContext sample rate:', audioContext.sampleRate);
      
      // Add gain node for volume control if needed
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0; // Adjust if needed
      
      // Create and add worklet
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
      
      // Set up VAD with better settings
      vadRef.current = await recordAudio({
        onSpeechEnd: () => {
          console.log('Speech ended (VAD) - sending buffered audio');
          speakingRef.current = false;
          setIsSpeaking(false);
          
          // Send any buffered audio when speech ends
          sendBufferedAudio();
          
          emit('audio:silence', { room: ROOM_ID });
        },
        onSpeechStart: () => {
          console.log('Speech started (VAD)');
          speakingRef.current = true;
          setIsSpeaking(true);
        },
      });

      // Handle worklet messages with buffering strategy
      workletNode.port.onmessage = (event) => {
        if (event.data) {
          const pcm16 = new Int16Array(event.data);
          
          // Calculate RMS energy for better quality assessment
          const rms = Math.sqrt(
            pcm16.reduce((sum, sample) => sum + sample * sample, 0) / pcm16.length
          ) / 32768;
          
          // Only process chunks with reasonable audio content
          if (rms > 0.001 || speakingRef.current) {
            // Resample if necessary
            let processedBuffer = pcm16;
            if (audioContext.sampleRate !== TARGET_SAMPLE_RATE) {
              processedBuffer = resampleAudio(pcm16, audioContext.sampleRate, TARGET_SAMPLE_RATE);
            }
            
            if (speakingRef.current) {
              // During speech: buffer chunks for batch sending
              audioBufferRef.current.push(processedBuffer);
              
              // Send buffer when it gets large enough
              const totalBufferSize = audioBufferRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
              if (totalBufferSize >= CHUNK_SIZE * 2) {
                sendBufferedAudio();
              }
            } else {
              // Outside speech: send immediately but with larger chunks
              if (processedBuffer.length >= MIN_CHUNK_SIZE) {
                emit('audio:send', { 
                  room: ROOM_ID, 
                  audioBuffer: processedBuffer.buffer 
                });
                console.log(`✓ Sent immediate chunk: ${processedBuffer.length} samples, RMS: ${rms.toFixed(6)}`);
              }
            }
          }
        }
      };
      
      // Connect audio pipeline with gain control
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(gainNode);
      gainNode.connect(workletNode);
      
      // Clean up
      URL.revokeObjectURL(workletURL);
      
      console.log('High-quality audio streaming started successfully');
      
    } catch (error) {
      console.error('Error starting audio streaming:', error);
      setConnected(false);
    }
  };

  // Stop streaming with proper cleanup
  const stopStreaming = () => {
    console.log('Stopping audio streaming...');
    
    // Send any remaining buffered audio
    sendBufferedAudio();
    
    setConnected(false);
    speakingRef.current = false;
    setIsSpeaking(false);

    // Clean up audio worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }
    
    // Dispose VAD
    if (vadRef.current) {
      vadRef.current();
      vadRef.current = null;
    }
    
    // Clear audio buffer
    audioBufferRef.current = [];
    
    // Disconnect websocket
    disconnect();
    
    console.log('Audio streaming stopped');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center">
        <MicrophoneStatus connected={connected} />
        <ConnectButton connected={connected} onClick={connected ? stopStreaming : startStreaming} />
        
        <div className="mt-6 text-center text-gray-400 text-xs space-y-2">
          <div>
            🎵 High-quality audio at {TARGET_SAMPLE_RATE}Hz
          </div>
          <div>
            📦 Chunk size: {CHUNK_SIZE} samples
          </div>
          {isSpeaking && (
            <div className="text-green-600 font-medium">
              🎤 Speech detected - buffering audio
            </div>
          )}
          {connected && (
            <div className="text-blue-600 font-medium">
              🔗 WebSocket connected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;