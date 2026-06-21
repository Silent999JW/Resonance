import { useState, useEffect } from 'react';
import { Sliders, RefreshCw, Volume2, Flame, Settings, Sparkles, ChevronDown, Sun, Moon, Palette } from 'lucide-react';
import { AppSettings, EQ_BANDS, PRESETS } from '../types';
import { audioEngine } from '../utils/audioEngine';

interface AudioSettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  foldersCount: number;
  onRescan: () => void;
  isScanning: boolean;
  onClearLibrary: () => void;
}

export default function AudioSettingsPanel({
  settings,
  onUpdateSettings,
  foldersCount,
  onRescan,
  isScanning,
  onClearLibrary,
}: AudioSettingsPanelProps) {
  const [activeEqPreset, setActiveEqPreset] = useState<string>('Custom');

  // Sync EQ values if a preset is clicked
  const applyPreset = (presetName: string) => {
    const found = PRESETS.find((p) => p.name === presetName);
    if (found) {
      setActiveEqPreset(presetName);
      audioEngine.setEqualizerGains(found.gains);
      onUpdateSettings({ equalizerGains: [...found.gains] });
    }
  };

  const handleBandChange = (index: number, val: number) => {
    setActiveEqPreset('Custom');
    const newGains = [...settings.equalizerGains];
    newGains[index] = val;
    audioEngine.setEqualizerGain(index, val);
    onUpdateSettings({ equalizerGains: newGains });
  };

  const handleToggleEq = (checked: boolean) => {
    audioEngine.setEqualizerEnabled(checked);
    onUpdateSettings({ equalizerEnabled: checked });
  };

  const handlePlaybackSpeed = (speed: number) => {
    audioEngine.setPlaybackSpeed(speed);
    onUpdateSettings({ playbackSpeed: speed });
  };

  const handleCrossfadeStr = (duration: number) => {
    audioEngine.setCrossfade(duration);
    onUpdateSettings({ crossfadeDuration: duration });
  };

  const colors: Record<string, string> = {
    emerald: 'text-emerald-500 bg-emerald-500',
    sky: 'text-sky-500 bg-sky-500',
    rose: 'text-rose-500 bg-rose-500',
    violet: 'text-violet-500 bg-violet-500',
    amber: 'text-amber-500 bg-amber-500',
    indigo: 'text-indigo-500 bg-indigo-500',
    teal: 'text-teal-500 bg-teal-500',
  };

  const accentColorClass = colors[settings.accentColor] || 'bg-emerald-500';
  const accentTextColor = colors[settings.accentColor]?.split(' ')[0] || 'text-emerald-500';

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-4" id="audio-settings-container">
      {/* 10-Band Equalizer section */}
      <div className="acrylic-card dark:acrylic-card light:acrylic-card-light p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${accentColorClass} bg-opacity-10 ${accentTextColor}`}>
              <Sliders size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">10-Band Equalizer</h3>
              <p className="text-xs text-neutral-400">Tweak gains to accommodate your acoustical output</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* EQ preset selection dropdown */}
            <div className="relative">
              <select
                value={activeEqPreset}
                onChange={(e) => applyPreset(e.target.value)}
                disabled={!settings.equalizerEnabled}
                className="appearance-none bg-neutral-800 text-neutral-200 text-xs px-4 py-2 pr-8 rounded-lg outline-none border border-white/5 cursor-pointer disabled:opacity-50"
              >
                <option value="Custom">Custom</option>
                {PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3 text-neutral-400 pointer-events-none" />
            </div>

            {/* EQ Enable switch */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.equalizerEnabled}
                onChange={(e) => handleToggleEq(e.target.checked)}
                className="sr-only peer"
                id="eq-toggle-input"
              />
              <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-200 after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              <span className="ml-2 text-xs font-medium text-neutral-300">Enabled</span>
            </label>
          </div>
        </div>

        {/* 10 Vertical sliders */}
        <div className="grid grid-cols-10 gap-2 md:gap-4 h-48 pt-4 pb-2" id="eq-sliders-rack">
          {EQ_BANDS.map((frequency, idx) => {
            const gain = settings.equalizerGains[idx] ?? 0;
            return (
              <div key={frequency} className="flex flex-col items-center h-full justify-between">
                <span className="text-[10px] font-mono text-neutral-400">{gain > 0 ? `+${gain}` : gain} dB</span>
                <div className="w-full h-24 flex items-center justify-center relative">
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={gain}
                    disabled={!settings.equalizerEnabled}
                    onChange={(e) => handleBandChange(idx, parseInt(e.target.value))}
                    className="absolute appearance-none mx-auto w-24 h-1 bg-neutral-800 rounded-lg outline-none cursor-pointer disabled:opacity-30"
                    style={{
                      transform: 'rotate(-90deg)',
                      WebkitAppearance: 'none',
                    }}
                  />
                </div>
                <div className="text-center mt-2">
                  <span className="text-[10px] font-mono text-neutral-300">
                    {frequency >= 1000 ? `${frequency / 1000}k` : frequency}Hz
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Playback Quality settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Crossfade, Speed, Normalization bundle */}
        <div className="acrylic-card dark:acrylic-card light:acrylic-card-light p-6 rounded-2xl space-y-6">
          <div className="flex items-center space-x-3 mb-2">
            <div className={`p-2 rounded-lg ${accentColorClass} bg-opacity-10 ${accentTextColor}`}>
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-white dark:text-white light:text-zinc-900">Audio Processing</h3>
              <p className="text-xs text-neutral-400">Adjust crossfading and speed multipliers</p>
            </div>
          </div>

          {/* Crossfade */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-300 dark:text-neutral-300 light:text-zinc-600">Crossfade Duration</span>
              <span className="font-mono text-neutral-200 dark:text-neutral-200 light:text-zinc-800">
                {settings.crossfadeDuration === 0 ? 'Gapless' : `${settings.crossfadeDuration} seconds`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={settings.crossfadeDuration}
              onChange={(e) => handleCrossfadeStr(parseInt(e.target.value))}
              className="w-full h-1 bg-neutral-800 dark:bg-neutral-800 light:bg-zinc-200 rounded-lg outline-none appearance-none cursor-pointer"
              style={{ accentColor: settings.theme === 'dark' ? 'rgb(16, 185, 129)' : 'rgb(5, 150, 105)' }}
              id="crossfade-duration-selector"
            />
          </div>

          {/* Normalization */}
          <div className="flex items-center justify-between border-t border-white/5 dark:border-white/5 light:border-black/5 pt-4">
            <div>
              <span className="text-xs text-neutral-200 dark:text-neutral-200 light:text-zinc-700 block font-semibold">Volume Normalization</span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-400 light:text-zinc-500 block leading-tight">Protects level dynamics from hard clipping</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.replayGainNormalized}
                onChange={(e) => onUpdateSettings({ replayGainNormalized: e.target.checked })}
                className="sr-only peer"
                id="normalization-toggle-input"
              />
              <div className="w-11 h-6 bg-neutral-800 dark:bg-neutral-800 light:bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-200 dark:after:bg-neutral-200 light:after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Playback speed */}
          <div className="space-y-3 border-t border-white/5 dark:border-white/5 light:border-black/5 pt-4">
            <span className="text-xs text-neutral-200 dark:text-neutral-200 light:text-zinc-700 block font-semibold">Playback Speed</span>
            <div className="grid grid-cols-6 gap-1" id="speed-selectors-rack">
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handlePlaybackSpeed(rate)}
                  className={`py-1.5 px-0.5 rounded-lg text-[10px] font-mono border transition-all ${
                    settings.playbackSpeed === rate
                      ? `${accentColorClass} text-white border-transparent`
                      : 'bg-neutral-800 dark:bg-neutral-800 light:bg-zinc-200 border-white/5 dark:border-white/5 light:border-zinc-300 text-neutral-400 dark:text-neutral-400 light:text-zinc-600 hover:text-neutral-200 dark:hover:text-neutral-200 light:hover:text-zinc-900'
                  }`}
                  id={`speed-selector-btn-${rate}`}
                >
                  {rate.toFixed(1)}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Appearance & Customize Panel */}
        <div className="acrylic-card dark:acrylic-card light:acrylic-card-light p-6 rounded-2xl space-y-6">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${accentColorClass} bg-opacity-10 ${accentTextColor}`}>
              <Palette size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-white dark:text-white light:text-zinc-900">Appearance Settings</h3>
              <p className="text-xs text-neutral-400">Personalize application colors and panels</p>
            </div>
          </div>

          {/* Premium Ambient BG (Exposed directly now for customization) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-300 font-semibold block">Premium Ambient BG</span>
              <span className="text-[9px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest leading-none">Aura Flow</span>
            </div>
            <p className="text-[10px] text-neutral-400 leading-tight">Flowing hardware-accelerated gradients that bring your virtual playback stage to life.</p>
            
            <div className="grid grid-cols-3 gap-2 pt-2" id="settings-premium-themes">
              {[
                { id: 'classic', style: 'bg-zinc-850 hover:bg-zinc-800 border border-white/5', name: 'Classic' },
                { id: 'nebula', style: 'bg-nebula border border-white/10', name: 'Nebula' },
                { id: 'sunset', style: 'bg-sunset border border-white/10', name: 'Sunset' },
                { id: 'aurora', style: 'bg-aurora border border-white/10', name: 'Aurora' },
                { id: 'matrix', style: 'bg-matrix border border-white/10', name: 'Matrix' },
                { id: 'cyberpunk', style: 'bg-cyberpunk border border-white/10', name: 'Cyberpunk' },
                { id: 'nordic', style: 'bg-nordic border border-white/10', name: 'Nordic' },
                { id: 'sakura', style: 'bg-sakura border border-white/10', name: 'Sakura' },
                { id: 'crimson', style: 'bg-crimson border border-white/10', name: 'Crimson' },
              ].map((themeOpt) => {
                const isSelected = (settings.premiumTheme || 'classic') === themeOpt.id;
                return (
                  <button
                    key={themeOpt.id}
                    onClick={() => onUpdateSettings({ premiumTheme: themeOpt.id })}
                    className={`h-12 rounded-xl group relative transition-all hover:scale-105 select-none ${themeOpt.style} ${
                      isSelected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-neutral-900 scale-102 font-bold' : 'opacity-70 hover:opacity-100'
                    }`}
                    title={themeOpt.name}
                    id={`settings-premium-theme-${themeOpt.id}`}
                  >
                    <span className="absolute bottom-1.5 left-0 right-0 text-[8px] tracking-wide text-center text-white/80 font-mono font-medium truncate px-1">
                      {themeOpt.name}
                    </span>
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brand Accent */}
          <div className="space-y-2 border-t border-white/5 dark:border-white/5 light:border-black/5 pt-4">
            <span className="text-xs text-neutral-300 dark:text-neutral-300 light:text-zinc-600 font-semibold block font-mono">System Accent Color</span>
            <div className="flex flex-wrap gap-2 pt-1" id="accent-colors-list">
              {Object.keys(colors).map((colorName) => {
                const meta = colors[colorName];
                const bgClass = meta.split(' ')[1];
                const isSelected = settings.accentColor === colorName;
                return (
                  <button
                    key={colorName}
                    onClick={() => onUpdateSettings({ accentColor: colorName })}
                    title={colorName.charAt(0).toUpperCase() + colorName.slice(1)}
                    className={`w-8 h-8 rounded-full ${bgClass} relative flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-sm ${
                      isSelected
                        ? 'ring-2 ring-emerald-500 dark:ring-white light:ring-zinc-900 border-2 border-white dark:border-neutral-900 light:border-white scale-105'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {isSelected && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full shadow-inner" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Library controls and statistics summaries */}
        <div className="acrylic-card dark:acrylic-card light:acrylic-card-light p-6 rounded-2xl space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 rounded-lg bg-emerald-500 bg-opacity-10 text-emerald-500">
                <Settings size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-white dark:text-white light:text-zinc-900">Library Maintenance</h3>
                <p className="text-xs text-neutral-400">Configure connected folders and active scans</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-neutral-950/40 dark:bg-neutral-950/40 light:bg-zinc-100 p-4 rounded-xl border border-white/5 dark:border-white/5 light:border-zinc-300 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 dark:text-neutral-400 light:text-zinc-600 font-semibold">Folders Monitored</span>
                  <span className="font-bold text-white dark:text-white light:text-zinc-900 font-mono">{foldersCount}</span>
                </div>
                <div className="text-[11px] text-neutral-400 dark:text-neutral-400 light:text-zinc-600 leading-tight">
                  Folder scanner recursively indexes songs. Changes are automatically detected on start.
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-2 pt-4 border-t border-white/5 dark:border-white/5 light:border-black/5 flex-wrap gap-y-2">
            <button
              onClick={onRescan}
              disabled={isScanning}
              className="flex-1 min-w-[110px] bg-neutral-800 dark:bg-neutral-800 light:bg-zinc-200 text-neutral-200 dark:text-neutral-200 light:text-zinc-800 text-xs py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 border border-white/5 dark:border-white/5 light:border-zinc-300 hover:bg-neutral-700 dark:hover:bg-neutral-750 light:hover:bg-zinc-300 transition"
              id="rescan-library-btn"
            >
              <RefreshCw size={12} className={isScanning ? 'animate-spin' : ''} />
              <span className="truncate">{isScanning ? 'Scanning...' : 'Rescan Folders'}</span>
            </button>

            <button
              onClick={onClearLibrary}
              className="flex-1 min-w-[110px] bg-rose-500/10 text-rose-400 dark:text-rose-400 light:text-rose-600 border border-rose-500/20 text-xs py-2 px-3 rounded-lg hover:bg-rose-500/20 transition"
              id="clear-library-btn"
            >
              Clear Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
