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
    ? "Terminate Call"
    : isRoomJoined
    ? "Activate Call"
    : "Initialize Call";

  const getButtonStyles = () => {
    if (!isRoomJoined && !connected) {
      return "bg-slate-700 cursor-not-allowed opacity-50 border border-slate-600";
    }
    if (connected) {
      return "bg-gradient-to-r from-red-500 via-pink-500 to-red-600 hover:from-red-600 hover:via-pink-600 hover:to-red-700 shadow-2xl shadow-red-500/30 hover:shadow-red-500/50 border border-red-400/50 hover:border-red-300/70 animate-quantum-glow";
    }
    return "bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-700 shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/50 border border-cyan-400/50 hover:border-cyan-300/70 animate-glow";
  };

  const getIcon = () => {
    if (connected) {
      return (
        <svg
          className="w-6 h-6 animate-neural-pulse"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M9 10h6v4H9z"
          />
        </svg>
      );
    }
    return (
      <svg
        className="w-6 h-6 animate-breathe"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    );
  };

  const getGlowEffect = () => {
    if (!isRoomJoined && !connected) return "";
    if (connected) return "hover:shadow-red-500/60";
    return "hover:shadow-cyan-500/60";
  };

  return (
    <div className="relative animate-fade-in-scale">
      {/* Enhanced background glow effect */}
      {(connected || isRoomJoined) && (
        <>
          <div
            className={`absolute inset-0 rounded-2xl blur-xl opacity-40 animate-breathe ${
              connected
                ? "bg-gradient-to-r from-red-500 via-pink-500 to-red-600"
                : "bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600"
            }`}
          />

          {/* Additional outer glow */}
          <div
            className={`absolute -inset-2 rounded-3xl blur-2xl opacity-20 animate-neural-pulse ${
              connected
                ? "bg-gradient-to-r from-red-400 to-pink-400"
                : "bg-gradient-to-r from-cyan-400 to-blue-400"
            }`}
          />
        </>
      )}

      <button
        onClick={onClick}
        disabled={!isRoomJoined && !connected}
        className={`relative w-full py-5 px-6 rounded-2xl font-bold text-white text-lg transition-all duration-700 transform hover:scale-110 hover:-translate-y-2 magnetic-hover glass-enhanced ${getButtonStyles()} ${getGlowEffect()}`}
      >
        {/* Holographic overlay */}
        {(connected || isRoomJoined) && (
          <div className="absolute inset-0 rounded-2xl holographic opacity-20" />
        )}

        {/* Inner glow overlay */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/15 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500" />

        {/* Shimmer effect */}
        {(connected || isRoomJoined) && (
          <div className="absolute inset-0 rounded-2xl animate-shimmer opacity-30" />
        )}

        <span className="relative flex items-center justify-center space-x-3">
          <div
            className={`transition-all duration-500 ${
              connected ? "animate-neural-pulse scale-110" : "animate-breathe"
            }`}
          >
            {getIcon()}
          </div>

          <span
            className={`tracking-wide font-extrabold ${
              connected ? "animate-shimmer" : ""
            }`}
          >
            {buttonText}
          </span>

          {/* Enhanced neural activity indicator */}
          {connected && (
            <div className="flex space-x-1">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-gradient-to-t from-white/80 to-white/40 rounded-full animate-wave"
                  style={{
                    height: `${12 + Math.sin(i) * 4}px`,
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: "0.8s",
                  }}
                />
              ))}
            </div>
          )}

          {/* Energy particles for active state */}
          {isRoomJoined && !connected && (
            <div className="flex space-x-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-cyan-400 rounded-full animate-magnetic-float opacity-70"
                  style={{
                    animationDelay: `${i * 0.3}s`,
                  }}
                />
              ))}
            </div>
          )}
        </span>

        {/* Neon border effect */}
        {(connected || isRoomJoined) && (
          <div className="absolute inset-0 rounded-2xl neon-border opacity-60" />
        )}
      </button>

      {/* Floating particles around button */}
      {connected && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-red-400 rounded-full animate-magnetic-float opacity-40"
              style={{
                left: `${10 + i * 15}%`,
                top: `${20 + Math.sin(i * 2) * 30}%`,
                animationDelay: `${i * 0.4}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
