import { Music, Minimize2, Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Volume2, VolumeX, Flame } from 'lucide-react';
import { Track } from '../types';
import AudioVisualizer from './AudioVisualizer';

interface FullscreenPlayerProps {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleFullscreen: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  isRepeat: boolean;
  onToggleRepeat: () => void;
  accentColor: string;
}

export default function FullscreenPlayer({
  track,
  isPlaying,
  currentTime,
  duration,
  volume,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onToggleFullscreen,
  isShuffle,
  onToggleShuffle,
  isRepeat,
  onToggleRepeat,
  accentColor,
}: FullscreenPlayerProps) {
  
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const colors: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500 fill-emerald-500 hover:text-emerald-300',
    sky: 'text-sky-400 bg-sky-500 fill-sky-500 hover:text-sky-300',
    rose: 'text-rose-400 bg-rose-500 fill-rose-500 hover:text-rose-300',
    violet: 'text-violet-400 bg-violet-500 fill-violet-500 hover:text-violet-300',
    amber: 'text-amber-400 bg-amber-500 fill-amber-500 hover:text-amber-300',
    indigo: 'text-indigo-400 bg-indigo-500 fill-indigo-500 hover:text-indigo-300',
    teal: 'text-teal-400 bg-teal-500 fill-teal-500 hover:text-teal-300',
  };

  const accentColorText = colors[accentColor]?.split(' ')[0] || 'text-emerald-400';
  const accentColorBg = colors[accentColor]?.split(' ')[1] || 'bg-emerald-500';

  return (
    <div
      className="fixed inset-0 bg-neutral-950/98 z-50 flex flex-col items-center justify-between p-6 sm:p-12 text-white overflow-hidden"
      id="fullscreen-panel-overlay"
    >
      {/* Blurred artwork background */}
      <div className="absolute inset-0 -z-10 overflow-hidden opacity-30 select-none">
        {track.artworkUrl ? (
          <img
            src={track.artworkUrl}
            alt=""
            className="w-full h-full object-cover blur-[80px] scale-125"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-neutral-900 blur-2xl" />
        )}
      </div>

      {/* Header */}
      <div className="w-full max-w-5xl flex items-center justify-between z-10" id="fullscreen-player-header">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-md ${accentColorBg} text-neutral-950 font-bold text-xs uppercase font-mono`}>
            Immersive
          </div>
          <span className="text-xs uppercase tracking-widest text-neutral-400 font-mono">
            Now Rendering
          </span>
        </div>

        <button
          onClick={onToggleFullscreen}
          className="p-3 bg-white/5 border border-white/10 text-neutral-300 hover:text-white rounded-full hover:bg-white/10 transition backdrop-blur-md"
          id="minimize-fullscreen-player-btn"
        >
          <Minimize2 size={18} />
        </button>
      </div>

      {/* Art, Details and Visualizer container */}
      <div className="w-full max-w-4xl flex flex-col md:flex-row items-center justify-center gap-10 md:gap-16 my-auto z-10" id="fullscreen-player-body">
        {/* Big Rotating / Pulsing Album Art */}
        <div className="relative group flex-shrink-0 flex items-center justify-center select-none" id="fullscreen-artwork-wrapper">
          {/* Pulsing ambient outer glow */}
          <div className="absolute -inset-6 rounded-full bg-gradient-to-r from-emerald-500/20 to-indigo-500/20 blur-2xl transition duration-1000 animate-slow-glow-pulse" />
          
          {/* Physical vinyl turntable / CD platter container */}
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full border border-white/10 p-2.5 bg-neutral-950 shadow-[0_0_50px_rgba(0,0,0,0.85)] flex items-center justify-center ambient-float">
            
            {/* Vinyl record grooves background overlay */}
            <div className={`absolute inset-0 rounded-full border border-white/5 bg-[radial-gradient(circle,_transparent_35%,_rgba(255,255,255,0.01)_36%,_rgba(0,0,0,0.65)_38%,_transparent_39%,_rgba(255,255,255,0.015)_40%,_rgba(0,0,0,0.7)_45%,_transparent_46%,_rgba(255,255,255,0.01)_50%,_rgba(0,0,0,0.8)_60%,_transparent_61%)] pointer-events-none z-10 ${isPlaying ? 'animate-vinyl-spin' : ''}`} style={{ animationDuration: '30s' }} />
            
            {/* The rotating record center container */}
            <div className={`w-full h-full rounded-full overflow-hidden transition-transform duration-[1500ms] ${isPlaying ? 'animate-vinyl-spin' : ''}`}>
              {track.artworkUrl ? (
                <img
                  src={track.artworkUrl}
                  alt=""
                  className="w-full h-full object-cover select-none rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 bg-neutral-900 rounded-full relative">
                  <Music size={52} className={`${accentColorText} opacity-70`} strokeWidth={1} />
                  <span className="text-[7.5px] uppercase tracking-widest mt-2 text-neutral-500 font-mono">
                    HIFI PLAYBACK
                  </span>
                </div>
              )}
            </div>

            {/* Vinyl spindle center hole */}
            <div className="absolute w-8 h-8 rounded-full bg-neutral-950 border border-white/10 flex items-center justify-center z-20 shadow-inner">
              <div className="w-3.5 h-3.5 rounded-full bg-neutral-900 border border-amber-500/40" />
            </div>
          </div>
        </div>

        {/* Info & Visualizer Column */}
        <div className="flex-1 w-full space-y-6 flex flex-col justify-center text-center md:text-left" id="fullscreen-player-description-box">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight truncate text-white">
              {track.title}
            </h1>
            <p className="text-base sm:text-lg text-neutral-400 font-medium truncate">
              {track.artist}
            </p>
            <p className="text-xs sm:text-sm text-neutral-500 truncate italic">
              {track.album}
            </p>
          </div>

          {/* Real-time spectrum Visualizer */}
          <div className="h-28 w-full bg-neutral-900/60 border border-white/5 p-2 rounded-xl backdrop-blur-md relative overflow-hidden shadow-inner">
            <AudioVisualizer isPlaying={isPlaying} accentColor={accentColor} />
            <div className="absolute bottom-2 right-3 text-[10px] font-mono text-neutral-500 select-none uppercase">
              Web Audio Analyser
            </div>
          </div>
        </div>
      </div>

      {/* Playback Controls Footer */}
      <div className="w-full max-w-4xl space-y-6 z-10" id="fullscreen-player-controls-strip">
        {/* Seek timeline */}
        <div className="space-y-2" id="fullscreen-seek-timeline">
          <div className="flex justify-between text-xs text-neutral-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="group relative w-full h-2 bg-neutral-800 rounded-full cursor-pointer">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              id="fullscreen-timeline-input-slider"
            />
            {/* Range bar background filler */}
            <div className="absolute top-0 left-0 h-full bg-neutral-800 rounded-full w-full" />
            <div
              style={{ width: `${pct}%` }}
              className={`absolute top-0 left-0 h-full rounded-full transition-colors group-hover:brightness-125 ${accentColorBg}`}
            />
            {/* Grabber marker inside visual slider */}
            <div
              style={{ left: `${pct}%` }}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </div>

        {/* Playback Action panel */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6" id="fullscreen-player-actions-panel">
          {/* Mute toggle / Volume Slider */}
          <div className="flex items-center space-x-3 w-40 justify-center sm:justify-start">
            <button
              onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
              className="text-neutral-400 hover:text-white transition"
              id="fullscreen-mute-toggle-btn"
            >
              {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-24 accent-emerald-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              id="fullscreen-volume-input-slider"
            />
          </div>

          {/* Trigger Deck */}
          <div className="flex items-center space-x-6 sm:space-x-8">
            <button
              onClick={onToggleShuffle}
              className={`transition transform hover:scale-105 ${
                isShuffle ? `${accentColorText} scale-105` : 'text-neutral-500 hover:text-neutral-300'
              }`}
              title="Shuffle queue"
              id="fullscreen-shuffle-btn"
            >
              <Shuffle size={18} />
            </button>

            <button
              onClick={onPrevious}
              className="text-neutral-400 hover:text-white transition transform hover:scale-105"
              id="fullscreen-prev-btn"
            >
              <SkipBack size={22} />
            </button>

            <button
              onClick={onPlayPause}
              className={`p-5 rounded-full text-black hover:scale-105 active:scale-95 transition transform shadow-lg flex items-center justify-center ${accentColorBg}`}
              id="fullscreen-play-pause-btn"
            >
              {isPlaying ? (
                <Pause size={24} fill="currentColor" strokeWidth={0} />
              ) : (
                <Play size={24} fill="currentColor" strokeWidth={0} className="translate-x-0.5" />
              )}
            </button>

            <button
              onClick={onNext}
              className="text-neutral-400 hover:text-white transition transform hover:scale-105"
              id="fullscreen-next-btn"
            >
              <SkipForward size={22} />
            </button>

            <button
              onClick={onToggleRepeat}
              className={`transition transform hover:scale-105 ${
                isRepeat ? `${accentColorText} scale-105` : 'text-neutral-500 hover:text-neutral-300'
              }`}
              title="Repeat current"
              id="fullscreen-repeat-btn"
            >
              <Repeat size={18} />
            </button>
          </div>

          {/* Active stats display indicator */}
          <div className="text-right hidden sm:block w-40 text-neutral-400 font-mono text-xs">
            <span className="block opacity-60 uppercase text-[10px]">Track Format</span>
            <span className="block font-bold text-white uppercase mt-0.5">
              {track.fileName.split('.').pop() || 'MP3'} Lossless/HD
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
