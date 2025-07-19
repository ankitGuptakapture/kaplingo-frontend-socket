import { useRef, useState, useEffect } from 'react';
import { useWebSocket } from './webSocket/useWebSocket';
import { playPCM16 } from './utils/audio';
import { MicrophoneStatus } from './components/MicrophoneStatus';
import { VoicebotLog } from './components/VoicebotLog';
import { ConnectButton } from './components/ConnectButton';
import { recordAudio } from 'vad-web';

const SOCKET_URL = 'http://localhost:8080'; // Change to your backend
const ROOM_ID = 'fnjnfjnf'; // Example room id

function App() {
  const [connected, setConnected] = useState(false);

  const [isSpeaking, setIsSpeaking] = useState(false); // Use state for UI updates
  const speakingRef = useRef(false); // Use ref for worklet handler
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const vadRef = useRef<null | (() => void)>(null); // dispose function
  const audioBufferRef = useRef<Int16Array[]>([]); // Buffer to accumulate audio during speech

  // WebSocket setup
  const { emit, disconnect, on, off } = useWebSocket({
    url: SOCKET_URL,
  });

  useEffect(() => {
    const handleStream = ({ audioBuffer }:{audioBuffer: ArrayBuffer | Int16Array | Int16Array[]}) => {
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
      playPCM16(pcm16, 16000); // or your actual sample rate
    
    };
    
    const handleSilence = ({ user }: { user: string }) => {
      
    };
    
    on('audio:stream', handleStream);
    on('audio:silence', handleSilence);
    
    return () => {
      off('audio:stream', handleStream);
      off('audio:silence', handleSilence);
    };
  }, [on, off]);

  // AudioWorklet processor code as a string
  const workletProcessor = `
    class PCM16Processor extends AudioWorkletProcessor {
      process(inputs) {
        const input = inputs[0][0];
        if (input) {
          const pcm16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            let s = Math.max(-1, Math.min(1, input[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
        }
        return true;
      }
    }
    registerProcessor('pcm16-processor', PCM16Processor);
  `;

  // Helper function to send accumulated audio buffer
  const sendAccumulatedAudio = () => {
    if (audioBufferRef.current.length > 0) {
      // Concatenate all buffered audio chunks
      const totalLength = audioBufferRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedBuffer = new Int16Array(totalLength);
      let offset = 0;
      
      audioBufferRef.current.forEach(chunk => {
        combinedBuffer.set(chunk, offset);
        offset += chunk.length;
      });
      
      emit('audio:send', { room: ROOM_ID, audioBuffer: combinedBuffer.buffer });
     
      
      // Clear the buffer
      audioBufferRef.current = [];
    } else {
     
    }
  };

  // Alternative: Send chunks immediately during speech
  const sendChunkImmediately = (pcm16: Int16Array) => {
    emit('audio:send', { room: ROOM_ID, audioBuffer: pcm16.buffer });
  };

  useEffect(()=>{
    emit('room:join', { room: ROOM_ID });
  },[])
  // Start streaming audio using AudioWorklet and VAD
  const startStreaming = async () => {
    if (connected) return;
    setConnected(true);
   
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    
    const blob = new Blob([workletProcessor], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await audioContext.audioWorklet.addModule(url);
    
    const workletNode = new AudioWorkletNode(audioContext, 'pcm16-processor');
    workletNodeRef.current = workletNode;

    // VAD is still set up for future use, but we're not using it for sending audio
    vadRef.current = await recordAudio({
      onSpeechEnd: () => {
        speakingRef.current = false;
        setIsSpeaking(false);
     
        emit('audio:silence', { room: ROOM_ID });
      },
      onSpeechStart: () => {
        speakingRef.current = true;
        setIsSpeaking(true);
 
      },
    });

    // Handle audio worklet messages
    workletNode.port.onmessage = (event) => {
      if (event.data) {
        const pcm16 = new Int16Array(event.data);
        
        // Calculate energy level to filter out very quiet audio
        const energy = Math.sqrt(pcm16.reduce((sum, v) => sum + v * v, 0) / pcm16.length) / 32768;
        
        // Send all chunks when mic is on, regardless of VAD
        if (energy > 0.01) { // Only send if there's some audio energy
          sendChunkImmediately(pcm16);
          
        }
      }
    };
    
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(workletNode);
    workletNode.connect(audioContext.destination);
    
    URL.revokeObjectURL(url); // Clean up blob URL
  };

  // Stop streaming audio
  const stopStreaming = () => {
    setConnected(false);
    speakingRef.current = false;
    setIsSpeaking(false);

    
    // Send any remaining buffered audio before stopping
    sendAccumulatedAudio();
    
    workletNodeRef.current?.disconnect();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    vadRef.current?.(); // Call dispose function
    disconnect();
    
    // Clear audio buffer
    audioBufferRef.current = [];
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center">
        <MicrophoneStatus connected={connected} />
        <ConnectButton connected={connected} onClick={connected ? stopStreaming : startStreaming} />
        {/* <VoicebotLog log={log} /> */}
        <div className="mt-6 text-center text-gray-400 text-xs">
          Audio chunks sent continuously when mic is on (energy &gt; 0.01).
          {isSpeaking && (
            <div className="mt-2 text-green-600 font-medium">
              🎤 Speech detected by VAD
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;