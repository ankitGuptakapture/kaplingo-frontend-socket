interface ConnectButtonProps {
  connected: boolean;
  onClick: () => void;
}

export function ConnectButton({ connected, onClick }: ConnectButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full py-3 rounded-xl font-bold text-lg transition-colors mb-6 ${connected ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
    >
      {connected ? 'Disconnect' : 'Connect'}
    </button>
  );
} 