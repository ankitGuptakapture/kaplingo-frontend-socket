interface ConnectButtonProps {
  connected: boolean;
  isRoomJoined: boolean;
  onClick: () => void;
}

export function ConnectButton({
  connected,
  isRoomJoined,
  onClick,
}: ConnectButtonProps) {
  const buttonText = connected
    ? "Terminate Neural Link"
    : isRoomJoined
    ? "Activate Neural Interface"
    : "Initialize Connection";

  const getButtonStyles = () => {
    if (!isRoomJoined && !connected) {
      return "bg-slate-700 cursor-not-allowed opacity-50 border border-slate-600";
    }
    if (connected) {
      return "bg-gradient-to-r from-red-500 via-pink-500 to-red-600 hover:from-red-600 hover:via-pink-600 hover:to-red-700 shadow-2xl shadow-red-500/25 hover:shadow-red-500/40 border border-red-400/50 hover:border-red-300/70";
    }
    return "bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-700 shadow-2xl shadow-cyan-500/25 hover:shadow-cyan-500/40 border border-cyan-400/50 hover:border-cyan-300/70";
  };

  const getIcon = () => {
    if (connected) {
      return (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 10h6v4H9z"
          />
        </svg>
      );
    }
    return (
      <svg
        className="w-6 h-6"
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
    );
  };

  const getGlowEffect = () => {
    if (!isRoomJoined && !connected) return "";
    if (connected) return "hover:shadow-red-500/50";
    return "hover:shadow-cyan-500/50";
  };

  return (
    <div className="relative">
      {/* Background glow effect */}
      {(connected || isRoomJoined) && (
        <div
          className={`absolute inset-0 rounded-2xl blur-xl opacity-30 ${
            connected
              ? "bg-gradient-to-r from-red-500 to-pink-500"
              : "bg-gradient-to-r from-cyan-500 to-blue-500"
          }`}
        />
      )}

      <button
        onClick={onClick}
        disabled={!isRoomJoined && !connected}
        className={`relative w-full py-5 px-6 rounded-2xl font-bold text-white text-lg transition-all duration-500 transform hover:scale-105 hover:-translate-y-1 ${getButtonStyles()} ${getGlowEffect()}`}
      >
        {/* Inner glow overlay */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />

        <span className="relative flex items-center justify-center space-x-3">
          <div
            className={`transition-transform duration-300 ${
              connected ? "animate-pulse" : ""
            }`}
          >
            {getIcon()}
          </div>
          <span className="tracking-wide">{buttonText}</span>

          {/* Neural activity indicator */}
          {connected && (
            <div className="flex space-x-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 h-4 bg-white/60 rounded-full animate-pulse"
                  style={{
                    animationDelay: `${i * 0.2}s`,
                    animationDuration: "1s",
                  }}
                />
              ))}
            </div>
          )}
        </span>
      </button>
    </div>
  );
}
