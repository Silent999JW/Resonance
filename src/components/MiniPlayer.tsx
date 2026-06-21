import { Play, Pause, SkipForward, SkipBack, Maximize2, Music, X } from 'lucide-react';
import { Track } from '../types';

interface MiniPlayerProps {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onRestore: () => void;
  onCloseMini: () => void;
  accentColor: string;
}

export default function MiniPlayer({
  track,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onNext,
  onPrevious,
  onRestore,
  onCloseMini,
  accentColor,
}: MiniPlayerProps) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500',
    sky: 'bg-sky-500',
    rose: 'bg-rose-500',
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
    indigo: 'bg-indigo-500',
    teal: 'bg-teal-500',
  };

  const accentColorBg = colors[accentColor] || 'bg-emerald-500';

  return (
    <div
      className="fixed bottom-6 right-6 w-72 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl p-4 z-40 select-none backdrop-blur-lg animate-fade-in"
      id="mini-player-widget-overlay"
    >
      {/* Progress accent strip along the top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-800 rounded-t-2xl overflow-hidden">
        <div style={{ width: `${pct}%` }} className={`h-full ${accentColorBg}`} />
      </div>

      <div className="flex items-center justify-between" id="mini-player-widget-header">
        <span className="text-[9px] uppercase tracking-widest text-neutral-400 font-mono font-bold">
          Mini Widget
        </span>
        <div className="flex items-center space-x-1">
          <button
            onClick={onRestore}
            className="p-1 hover:bg-white/5 rounded text-neutral-400 hover:text-white transition"
            title="Restore Player View"
            id="mini-player-restore-btn"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={onCloseMini}
            className="p-1 hover:bg-white/5 rounded text-neutral-400 hover:text-white transition"
            id="mini-player-close-btn"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-3 mt-3" id="mini-player-widget-body">
        {/* Cover Art miniature */}
        <div className="w-12 h-12 bg-neutral-950 border border-white/5 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
          {track.artworkUrl ? (
            <img src={track.artworkUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <Music size={16} className="text-neutral-500" />
          )}
        </div>

        {/* Text descriptions */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate" id="mini-widget-title">
            {track.title}
          </p>
          <p className="text-[10px] text-neutral-400 truncate" id="mini-widget-artist">
            {track.artist}
          </p>
        </div>
      </div>

      {/* Embedded direct actions bar */}
      <div className="flex items-center justify-center space-x-4 mt-4" id="mini-player-widget-actions">
        <button
          onClick={onPrevious}
          className="p-1 text-neutral-400 hover:text-white transition active:scale-95 transform"
          id="mini-widget-prev"
        >
          <SkipBack size={15} />
        </button>

        <button
          onClick={onPlayPause}
          className={`p-2.5 rounded-full text-black hover:scale-105 active:scale-95 transition transform ${accentColorBg}`}
          id="mini-widget-play-pause"
        >
          {isPlaying ? (
            <Pause size={13} fill="currentColor" strokeWidth={0} />
          ) : (
            <Play size={13} fill="currentColor" strokeWidth={0} className="translate-x-0.5" />
          )}
        </button>

        <button
          onClick={onNext}
          className="p-1 text-neutral-400 hover:text-white transition active:scale-95 transform"
          id="mini-widget-next"
        >
          <SkipForward size={15} />
        </button>
      </div>
    </div>
  );
}
