import { MicrophoneIcon } from '@heroicons/react/24/solid';

interface MicrophoneStatusProps {
  connected: boolean;
}

export function MicrophoneStatus({ connected }: MicrophoneStatusProps) {
  return (
    <div className="flex flex-col items-center mb-6">
      <div className={`rounded-full p-4 mb-2 ${connected ? 'bg-green-100' : 'bg-gray-200'}`}> 
        <MicrophoneIcon className={`w-12 h-12 ${connected ? 'text-green-500' : 'text-slate-400'}`} />
      </div>
      <span className={`text-sm font-semibold ${connected ? 'text-green-600' : 'text-gray-500'}`}>{connected ? 'Connected' : 'Disconnected'}</span>
    </div>
  );
} 