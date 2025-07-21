import { useEffect, useRef } from "react";

interface MatrixBackgroundProps {
  className?: string;
}

export const MatrixBackground: React.FC<MatrixBackgroundProps> = ({
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // AI/Tech themed characters - binary, hex, symbols, and some katakana
    const matrixChars =
      "01アイウエオABCDEF0123456789</>{}[]()ニヌネノハヒフヘホマミムメモ▲▼◆◇■□▪▫░▒▓█";
    const fontSize = 16;
    const columns = Math.floor(canvas.width / fontSize);

    // Enhanced drop system with multiple properties
    interface Drop {
      y: number;
      speed: number;
      opacity: number;
      brightness: number;
      trail: number[];
      glitch: boolean;
      glitchTimer: number;
    }

    const drops: Drop[] = [];

    // Initialize drops with enhanced properties
    for (let i = 0; i < columns; i++) {
      drops[i] = {
        y: Math.random() * -100,
        speed: Math.random() * 0.5 + 0.3,
        opacity: Math.random() * 0.8 + 0.2,
        brightness: Math.random() * 0.5 + 0.5,
        trail: [],
        glitch: false,
        glitchTimer: 0,
      };
    }

    // Particle system for additional effects
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
    }

    const particles: Particle[] = [];

    // Create particle
    const createParticle = (x: number, y: number) => {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 60,
        maxLife: 60,
        size: Math.random() * 2 + 1,
      });
    };

    // Neural network nodes
    interface Node {
      x: number;
      y: number;
      pulse: number;
      connections: number[];
    }

    const nodes: Node[] = [];
    const nodeCount = 8;

    // Initialize neural network nodes
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        pulse: Math.random() * Math.PI * 2,
        connections: [],
      });
    }

    // Create connections between nodes
    nodes.forEach((node, i) => {
      const connectionCount = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < connectionCount; j++) {
        const targetIndex = Math.floor(Math.random() * nodeCount);
        if (targetIndex !== i && !node.connections.includes(targetIndex)) {
          node.connections.push(targetIndex);
        }
      }
    });

    let time = 0;

    const draw = () => {
      time += 0.016; // ~60fps

      // Create trailing effect with subtle color
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw neural network connections
      ctx.strokeStyle = "rgba(0, 255, 100, 0.1)";
      ctx.lineWidth = 1;
      nodes.forEach((node) => {
        node.connections.forEach((targetIndex) => {
          const target = nodes[targetIndex];
          const distance = Math.sqrt(
            (target.x - node.x) ** 2 + (target.y - node.y) ** 2
          );
          if (distance < 300) {
            const alpha = (1 - distance / 300) * 0.3;
            ctx.strokeStyle = `rgba(0, 255, 100, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
          }
        });
      });

      // Draw and update neural network nodes
      nodes.forEach((node) => {
        node.pulse += 0.05;
        const pulseIntensity = (Math.sin(node.pulse) + 1) * 0.5;
        const size = 3 + pulseIntensity * 2;

        ctx.fillStyle = `rgba(0, 255, 100, ${0.6 + pulseIntensity * 0.4})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Glow effect
        ctx.shadowColor = "#00ff64";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(node.x, node.y, size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Slowly move nodes
        node.x += Math.sin(time * 0.5 + node.pulse) * 0.2;
        node.y += Math.cos(time * 0.3 + node.pulse) * 0.2;

        // Keep nodes in bounds
        if (node.x < 0) node.x = canvas.width;
        if (node.x > canvas.width) node.x = 0;
        if (node.y < 0) node.y = canvas.height;
        if (node.y > canvas.height) node.y = 0;
      });

      // Draw matrix rain with enhanced effects
      ctx.font = `${fontSize}px 'Courier New', monospace`;

      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i];

        // Update glitch effect
        if (Math.random() > 0.998) {
          drop.glitch = true;
          drop.glitchTimer = 10;
        }

        if (drop.glitch && drop.glitchTimer > 0) {
          drop.glitchTimer--;
          if (drop.glitchTimer <= 0) {
            drop.glitch = false;
          }
        }

        // Update trail
        drop.trail.push(drop.y);
        if (drop.trail.length > 15) {
          drop.trail.shift();
        }

        // Draw trail
        drop.trail.forEach((trailY, index) => {
          const trailOpacity = (index / drop.trail.length) * drop.opacity * 0.5;
          const char =
            matrixChars[Math.floor(Math.random() * matrixChars.length)];

          if (drop.glitch) {
            ctx.fillStyle = `rgba(255, 0, 100, ${trailOpacity})`;
          } else {
            ctx.fillStyle = `rgba(0, 255, 100, ${trailOpacity})`;
          }

          ctx.fillText(char, i * fontSize, trailY * fontSize);
        });

        // Draw main character
        const char =
          matrixChars[Math.floor(Math.random() * matrixChars.length)];

        if (drop.glitch) {
          // Glitch effect
          ctx.fillStyle = `rgba(255, 50, 150, ${drop.opacity})`;
          ctx.fillText(
            char,
            i * fontSize + Math.random() * 4 - 2,
            drop.y * fontSize
          );

          // Add glitch particles
          if (Math.random() > 0.7) {
            createParticle(i * fontSize, drop.y * fontSize);
          }
        } else {
          // Normal green character
          const brightness = drop.brightness;
          ctx.fillStyle = `rgba(0, ${Math.floor(
            255 * brightness
          )}, ${Math.floor(100 * brightness)}, ${drop.opacity})`;
          ctx.fillText(char, i * fontSize, drop.y * fontSize);
        }

        // Bright head character
        if (Math.random() > 0.95) {
          ctx.fillStyle = `rgba(200, 255, 200, ${drop.opacity})`;
          ctx.shadowColor = "#00ff64";
          ctx.shadowBlur = 5;
          ctx.fillText(char, i * fontSize, drop.y * fontSize);
          ctx.shadowBlur = 0;
        }

        // Move drop
        drop.y += drop.speed;

        // Reset drop when it reaches bottom
        if (drop.y * fontSize > canvas.height && Math.random() > 0.975) {
          drop.y = 0;
          drop.speed = Math.random() * 0.5 + 0.3;
          drop.opacity = Math.random() * 0.8 + 0.2;
          drop.brightness = Math.random() * 0.5 + 0.5;
          drop.trail = [];
        }
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];

        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life--;

        const alpha = particle.life / particle.maxLife;
        ctx.fillStyle = `rgba(255, 100, 200, ${alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
        ctx.fill();

        if (particle.life <= 0) {
          particles.splice(i, 1);
        }
      }

      // Add scanning line effect
      const scanY = (time * 100) % canvas.height;
      const gradient = ctx.createLinearGradient(0, scanY - 2, 0, scanY + 2);
      gradient.addColorStop(0, "rgba(0, 255, 100, 0)");
      gradient.addColorStop(0.5, "rgba(0, 255, 100, 0.3)");
      gradient.addColorStop(1, "rgba(0, 255, 100, 0)");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, scanY - 2, canvas.width, 4);
    };

    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      style={{ background: "transparent" }}
    />
  );
};
