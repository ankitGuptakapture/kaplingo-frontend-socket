interface ConnectButtonProps {
  connected: boolean;
  isRoomJoined: boolean;
  onClick: () => void;
}

export function ConnectButton({ connected, isRoomJoined, onClick }: ConnectButtonProps) {
  const buttonText = connected ? 'Disconnect' : (isRoomJoined ? 'Start Streaming' : 'Joining Room first');

  return (
    <button
      onClick={onClick}
      disabled={!isRoomJoined && !connected}
      className={`w-full py-3 rounded-xl font-bold text-lg transition-colors mb-6 ${
        connected
          ? 'bg-red-500 hover:bg-red-600 text-white'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      } disabled:bg-gray-400 disabled:cursor-not-allowed`}
    >
      {buttonText}
    </button>
  );
} 