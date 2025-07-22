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
    if (isSpeaking) return "text-white drop-shadow-lg";
    if (connected) return "text-white";
    return "text-slate-400";
  };

  const getStatusText = () => {
    if (isSpeaking) return "Voice Processing";
    if (connected) return "System Active";
    return "Offline";
  };

  return (
    <div className="flex flex-col items-center animate-fade-in-scale">
      <div className="relative mb-4">
        {/* Enhanced neural network rings for speaking */}
        {isSpeaking && (
          <>
            <div className="absolute -inset-6 rounded-full border-2 border-cyan-400/40 animate-ripple" />
            <div
              className="absolute -inset-8 rounded-full border border-blue-400/30 animate-ripple"
              style={{ animationDelay: "0.3s" }}
            />
            <div
              className="absolute -inset-10 rounded-full border border-purple-400/20 animate-ripple"
              style={{ animationDelay: "0.6s" }}
            />
            <div
              className="absolute -inset-12 rounded-full border border-pink-400/10 animate-ripple"
              style={{ animationDelay: "0.9s" }}
            />

            {/* Quantum glow effect */}
            <div className="absolute -inset-8 rounded-full animate-quantum-glow opacity-60" />
          </>
        )}

        {/* Breathing effect for connected state */}
        {connected && !isSpeaking && (
          <div className="absolute -inset-4 rounded-full border border-blue-400/20 animate-breathe" />
        )}

        {/* Main microphone container with enhanced effects */}
        <div className="relative">
          <div
            className={`w-20 h-20 rounded-full bg-gradient-to-br ${getStatusColor()} p-1 shadow-2xl transform transition-all duration-700 ${
              isSpeaking
                ? "scale-115 shadow-cyan-500/60 animate-neural-pulse"
                : connected
                ? "scale-105 shadow-blue-500/40 animate-breathe"
                : "scale-95 shadow-slate-500/20"
            } ${isSpeaking ? "animate-quantum-glow" : ""}`}
          >
            {/* Inner glass effect */}
            <div className="w-full h-full rounded-full bg-slate-900/30 backdrop-blur-sm flex items-center justify-center glass-enhanced">
              <MicrophoneIcon
                className={`w-8 h-8 ${getIconColor()} transition-all duration-500 ${
                  isSpeaking
                    ? "animate-neural-pulse scale-110"
                    : connected
                    ? "animate-breathe"
                    : ""
                }`}
              />

              {/* Holographic overlay when speaking */}
              {isSpeaking && (
                <div className="absolute inset-0 rounded-full holographic opacity-30" />
              )}
            </div>
          </div>

          {/* Enhanced neural processing indicator */}
          {isSpeaking && (
            <>
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/30 via-blue-500/30 to-purple-500/30 animate-neural-pulse" />

              {/* Energy flow particles */}
              <div className="absolute inset-0 rounded-full overflow-hidden">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-magnetic-float opacity-60"
                    style={{
                      left: `${20 + i * 10}%`,
                      top: `${30 + Math.sin(i) * 20}%`,
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {/* Enhanced connection status dot */}
          <div className="absolute -bottom-0.5 -right-0.5">
            <div
              className={`w-5 h-5 rounded-full border-2 border-slate-900 transition-all duration-500 ${
                isSpeaking
                  ? "bg-cyan-400 animate-neural-pulse shadow-lg shadow-cyan-400/50"
                  : connected
                  ? "bg-blue-400 animate-breathe shadow-md shadow-blue-400/30"
                  : "bg-slate-500"
              }`}
            />

            {/* Status dot glow */}
            {(isSpeaking || connected) && (
              <div
                className={`absolute inset-0 rounded-full ${
                  isSpeaking ? "bg-cyan-400" : "bg-blue-400"
                } animate-ripple opacity-40`}
              />
            )}
          </div>

          {/* Shimmer effect overlay */}
          {connected && (
            <div className="absolute inset-0 rounded-full animate-shimmer opacity-20" />
          )}
        </div>
      </div>

      <div className="text-center animate-slide-in-up">
        <div
          className={`text-base font-semibold transition-all duration-500 mb-1 ${
            isSpeaking
              ? "text-cyan-300 animate-shimmer"
              : connected
              ? "text-blue-300"
              : "text-slate-400"
          }`}
        >
          {getStatusText()}
        </div>

        {/* Enhanced status description */}
        <div
          className={`text-xs transition-colors duration-300 ${
            isSpeaking
              ? "text-cyan-200/80"
              : connected
              ? "text-blue-200/70"
              : "text-slate-500"
          }`}
        >
          {isSpeaking
            ? "Voice processing active"
            : connected
            ? "Ready for voice input"
            : "System offline"}
        </div>

        {/* Status indicator bars */}
        {isSpeaking && (
          <div className="flex justify-center space-x-1 mt-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-gradient-to-t from-cyan-400 to-blue-500 rounded-full animate-wave"
                style={{
                  height: `${8 + Math.random() * 8}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
