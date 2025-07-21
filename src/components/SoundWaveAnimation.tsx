import { useEffect, useState } from "react";

interface SoundWaveAnimationProps {
  isActive: boolean;
  intensity?: number;
}

export function SoundWaveAnimation({
  isActive,
  intensity = 1,
}: SoundWaveAnimationProps) {
  const [waveData, setWaveData] = useState<number[]>([]);

  useEffect(() => {
    if (!isActive) {
      setWaveData([]);
      return;
    }

    const interval = setInterval(() => {
      // Generate random wave data for animation
      const newWaveData = Array.from(
        { length: 32 },
        () => Math.random() * intensity * 100
      );
      setWaveData(newWaveData);
    }, 50); // Update every 50ms for smooth animation

    return () => clearInterval(interval);
  }, [isActive, intensity]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex items-center justify-center">
      {/* Central AI Core */}
      <div className="relative">
        {/* Outer energy ring */}
        <div className="absolute inset-0 w-96 h-96 rounded-full border-2 border-cyan-400/30 animate-spin-slow">
          <div className="absolute top-0 left-1/2 w-2 h-2 bg-cyan-400 rounded-full transform -translate-x-1/2 -translate-y-1 animate-pulse"></div>
          <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-green-400 rounded-full transform -translate-x-1/2 translate-y-1 animate-pulse"></div>
          <div className="absolute left-0 top-1/2 w-2 h-2 bg-blue-400 rounded-full transform -translate-x-1 -translate-y-1/2 animate-pulse"></div>
          <div className="absolute right-0 top-1/2 w-2 h-2 bg-purple-400 rounded-full transform translate-x-1 -translate-y-1/2 animate-pulse"></div>
        </div>

        {/* Inner energy ring */}
        <div className="absolute inset-8 rounded-full border border-green-400/40 animate-spin-reverse">
          <div className="absolute top-0 left-1/2 w-1 h-1 bg-green-400 rounded-full transform -translate-x-1/2 -translate-y-1 animate-ping"></div>
          <div className="absolute bottom-0 left-1/2 w-1 h-1 bg-cyan-400 rounded-full transform -translate-x-1/2 translate-y-1 animate-ping"></div>
        </div>

        {/* Central core */}
        <div className="absolute inset-16 rounded-full bg-gradient-to-br from-green-400/20 via-cyan-400/20 to-blue-400/20 backdrop-blur-sm border border-green-400/50 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 via-cyan-400 to-blue-400 animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-green-400 animate-ping"></div>
            </div>
          </div>
        </div>

        {/* Circular sound waves */}
        {[...Array(8)].map((_, ringIndex) => (
          <div
            key={ringIndex}
            className="absolute inset-0 rounded-full border border-green-400/20"
            style={{
              transform: `scale(${1 + ringIndex * 0.15})`,
              animation: `soundRipple 2s infinite ${ringIndex * 0.25}s`,
            }}
          />
        ))}
      </div>

      {/* Radial sound wave bars */}
      <div className="absolute inset-0 flex items-center justify-center">
        {waveData.map((height, index) => {
          const angle = (index / waveData.length) * 360;
          const radius = 200;
          const x = Math.cos((angle * Math.PI) / 180) * radius;
          const y = Math.sin((angle * Math.PI) / 180) * radius;

          return (
            <div
              key={index}
              className="absolute w-1 bg-gradient-to-t from-green-400 via-cyan-400 to-blue-400 rounded-full origin-bottom transition-all duration-75"
              style={{
                height: `${Math.max(height, 10)}px`,
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                transform: `rotate(${angle + 90}deg)`,
                opacity: height / 100,
              }}
            />
          );
        })}
      </div>

      {/* Floating particles */}
      {[...Array(20)].map((_, index) => (
        <div
          key={index}
          className="absolute w-1 h-1 bg-green-400 rounded-full animate-float"
          style={{
            left: `${20 + Math.random() * 60}%`,
            top: `${20 + Math.random() * 60}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${3 + Math.random() * 2}s`,
          }}
        />
      ))}

      {/* Corner energy indicators */}
      <div className="absolute top-8 left-8">
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-green-400 rounded-full animate-pulse"
              style={{
                height: `${8 + (waveData[i] || 0) / 10}px`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="absolute top-8 right-8">
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-cyan-400 rounded-full animate-pulse"
              style={{
                height: `${8 + (waveData[i + 5] || 0) / 10}px`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-8 left-8">
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-blue-400 rounded-full animate-pulse"
              style={{
                height: `${8 + (waveData[i + 10] || 0) / 10}px`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-8 right-8">
        <div className="flex gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-purple-400 rounded-full animate-pulse"
              style={{
                height: `${8 + (waveData[i + 15] || 0) / 10}px`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Neural network connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
        {[...Array(12)].map((_, index) => {
          const startAngle = (index / 12) * 360;
          const endAngle = ((index + 3) / 12) * 360;
          const radius = 150;

          const x1 =
            window.innerWidth / 2 +
            Math.cos((startAngle * Math.PI) / 180) * radius;
          const y1 =
            window.innerHeight / 2 +
            Math.sin((startAngle * Math.PI) / 180) * radius;
          const x2 =
            window.innerWidth / 2 +
            Math.cos((endAngle * Math.PI) / 180) * radius;
          const y2 =
            window.innerHeight / 2 +
            Math.sin((endAngle * Math.PI) / 180) * radius;

          return (
            <line
              key={index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="url(#gradient)"
              strokeWidth="1"
              className="animate-pulse"
              style={{ animationDelay: `${index * 0.2}s` }}
            />
          );
        })}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.4" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
