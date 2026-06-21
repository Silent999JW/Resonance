import { useEffect, useRef } from 'react';
import { audioEngine } from '../utils/audioEngine';

interface AudioVisualizerProps {
  isPlaying: boolean;
  accentColor: string;
}

export default function AudioVisualizer({ isPlaying, accentColor }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // Map accents to hex colors
  const colorMap: Record<string, string> = {
    emerald: '#10b981',
    sky: '#0284c7',
    rose: '#f43f5e',
    violet: '#8b5cf6',
    amber: '#f59e0b',
    indigo: '#6366f1',
    teal: '#0d9488'
  };

  const primaryColor = colorMap[accentColor] || '#10b981';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let resizeObserver: ResizeObserver | null = null;

    // Handle high DPI resolution mapping
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    
    // We observe the canvas parent to ensure size is fluid
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    resizeCanvas();

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Clear with soft trails
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, width, height);

      const analyser = audioEngine.analyser;
      if (!analyser || !isPlaying) {
        // Draw ambient resting waves
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        const time = Date.now() * 0.003;
        for (let x = 0; x < width; x++) {
          const y = (height / 2) + Math.sin(x * 0.02 + time) * 3;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `${primaryColor}40`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Render frequencies or waveforms dynamically
      analyser.getByteFrequencyData(dataArray);

      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      // Draw beautiful glows below visual elements
      ctx.shadowBlur = 10;
      ctx.shadowColor = primaryColor;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height * 0.8;

        const grad = ctx.createLinearGradient(x, height, x, height - barHeight);
        grad.addColorStop(0, `${primaryColor}20`);
        grad.addColorStop(0.5, `${primaryColor}60`);
        grad.addColorStop(1, primaryColor);

        ctx.fillStyle = grad;
        
        // Draw soft rounded pill-style frequency bars
        const rx = x;
        const ry = height - barHeight;
        const rw = barWidth - 2;
        const rh = barHeight;
        
        if (rw > 0 && rh > 0) {
          ctx.beginPath();
          ctx.roundRect(rx, ry, rw, rh, [3, 3, 0, 0]);
          ctx.fill();
        }

        x += barWidth;
      }

      ctx.shadowBlur = 0; // reset
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [isPlaying, primaryColor]);

  return (
    <canvas
      ref={canvasRef}
      id="equalizer-waveform-canvas"
      className="w-full h-full block rounded-xl overflow-hidden pointer-events-none opacity-80"
    />
  );
}
