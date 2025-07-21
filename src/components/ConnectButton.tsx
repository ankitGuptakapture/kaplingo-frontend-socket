interface ConnectButtonProps {
  connected: boolean;
  onClick: () => void;
}

export function ConnectButton({ connected, onClick }: ConnectButtonProps) {
  return (
    <div className="relative w-full">
      {/* Animated background glow */}
      <div
        className={`absolute inset-0 rounded-xl blur-md transition-all duration-300 ${
          connected
            ? "bg-red-500/30 animate-pulse"
            : "bg-green-500/30 animate-pulse"
        }`}
      ></div>

      {/* Main button */}
      <button
        onClick={onClick}
        className={`relative w-full py-4 px-6 rounded-xl font-mono font-bold text-sm transition-all duration-300 border-2 overflow-hidden group ${
          connected
            ? "bg-red-900/20 border-red-500/50 text-red-400 hover:bg-red-900/30 hover:border-red-400 hover:text-red-300"
            : "bg-green-900/20 border-green-500/50 text-green-400 hover:bg-green-900/30 hover:border-green-400 hover:text-green-300"
        }`}
      >
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className={`w-full h-full ${
              connected
                ? "bg-gradient-to-r from-red-500/20 via-transparent to-red-500/20"
                : "bg-gradient-to-r from-green-500/20 via-transparent to-green-500/20"
            } animate-pulse`}
          ></div>
        </div>

        {/* Button content */}
        <div className="relative z-10 flex items-center justify-center gap-3">
          {/* Status indicator */}
          <div
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              connected
                ? "bg-red-400 shadow-lg shadow-red-400/50"
                : "bg-green-400 shadow-lg shadow-green-400/50"
            }`}
          >
            <div
              className={`w-full h-full rounded-full animate-ping ${
                connected ? "bg-red-400" : "bg-green-400"
              }`}
            ></div>
          </div>

          {/* Button text */}
          <span className="tracking-wider">
            {connected ? "TERMINATE CONNECTION" : "INITIATE NEURAL LINK"}
          </span>

          {/* Arrow indicator */}
          <div
            className={`transition-transform duration-300 group-hover:translate-x-1 ${
              connected ? "rotate-180" : ""
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </div>
        </div>

        {/* Hover effect overlay */}
        <div
          className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
            connected
              ? "bg-gradient-to-r from-red-500/10 to-red-600/10"
              : "bg-gradient-to-r from-green-500/10 to-green-600/10"
          }`}
        ></div>

        {/* Scanning line effect */}
        <div
          className={`absolute top-0 left-0 w-full h-0.5 opacity-50 ${
            connected ? "bg-red-400" : "bg-green-400"
          } transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000`}
        ></div>
      </button>
    </div>
  );
}
