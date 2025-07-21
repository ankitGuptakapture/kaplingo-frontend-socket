import { MicrophoneIcon } from "@heroicons/react/24/solid";

interface MicrophoneStatusProps {
  connected: boolean;
  isSpeaking?: boolean;
}

export function MicrophoneStatus({
  connected,
  isSpeaking = false,
}: MicrophoneStatusProps) {
  const getStatusColor = () => {
    if (isSpeaking) return "from-cyan-400 via-blue-500 to-purple-500";
    if (connected) return "from-blue-400 via-cyan-500 to-blue-600";
    return "from-slate-600 to-slate-700";
  };

  const getIconColor = () => {
    if (isSpeaking) return "text-white";
    if (connected) return "text-white";
    return "text-slate-400";
  };

  const getStatusText = () => {
    if (isSpeaking) return "Neural Processing";
    if (connected) return "System Active";
    return "Offline";
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative mb-4">
        {/* Neural network rings for speaking - smaller for mobile */}
        {isSpeaking && (
          <>
            <div className="absolute -inset-6 rounded-full border border-cyan-400/30 animate-ping" />
            <div
              className="absolute -inset-8 rounded-full border border-blue-400/20 animate-ping"
              style={{ animationDelay: "0.5s" }}
            />
            <div
              className="absolute -inset-10 rounded-full border border-purple-400/10 animate-ping"
              style={{ animationDelay: "1s" }}
            />
          </>
        )}

        {/* Main microphone container - mobile optimized */}
        <div className="relative">
          <div
            className={`w-20 h-20 rounded-full bg-gradient-to-br ${getStatusColor()} p-1 shadow-2xl transform transition-all duration-500 ${
              isSpeaking
                ? "scale-110 shadow-cyan-500/50"
                : connected
                ? "scale-100 shadow-blue-500/30"
                : "scale-95"
            }`}
          >
            <div className="w-full h-full rounded-full bg-slate-900/20 backdrop-blur-sm flex items-center justify-center">
              <MicrophoneIcon
                className={`w-8 h-8 ${getIconColor()} transition-all duration-300 ${
                  isSpeaking ? "animate-pulse" : ""
                }`}
              />
            </div>
          </div>

          {/* Neural processing indicator */}
          {isSpeaking && (
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/20 via-blue-500/20 to-purple-500/20 animate-pulse" />
          )}

          {/* Connection status dot - smaller for mobile */}
          <div className="absolute -bottom-0.5 -right-0.5">
            <div
              className={`w-5 h-5 rounded-full border-2 border-slate-900 ${
                isSpeaking
                  ? "bg-cyan-400 animate-pulse"
                  : connected
                  ? "bg-blue-400"
                  : "bg-slate-500"
              }`}
            />
          </div>
        </div>
      </div>

      <div className="text-center">
        <div
          className={`text-base font-semibold transition-colors duration-300 mb-1 ${
            isSpeaking
              ? "text-cyan-300"
              : connected
              ? "text-blue-300"
              : "text-slate-400"
          }`}
        >
          {getStatusText()}
        </div>

        {/* Status description - more compact */}
        <div className="text-xs text-slate-500">
          {isSpeaking
            ? "Processing audio"
            : connected
            ? "Ready to listen"
            : "Offline"}
        </div>
      </div>
    </div>
  );
}
