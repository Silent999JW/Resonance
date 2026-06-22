import React, { useState } from 'react';
import {
  Music,
  Disc,
  User,
  Tags,
  BarChart2,
  Heart,
  Plus,
  FolderOpen,
  Settings,
  Sun,
  Moon,
  Volume2,
  Pin,
  FilePlus,
  Trash2,
  Download,
  AlertCircle
} from 'lucide-react';
import { Playlist, AppSettings } from '../types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  playlists: Playlist[];
  onAddPlaylist: (title: string, desc?: string) => void;
  onDeletePlaylist: (id: string) => void;
  onPinPlaylist: (id: string) => void;
  onExportPlaylistZip: (playlist: Playlist) => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  foldersCount: number;
  onAddFolder: () => void;
  isScanning: boolean;
  onAuthorizeFolders?: () => void;
}

export default function Sidebar({
  currentTab,
  onSelectTab,
  playlists,
  onAddPlaylist,
  onDeletePlaylist,
  onPinPlaylist,
  onExportPlaylistZip,
  settings,
  onUpdateSettings,
  foldersCount,
  onAddFolder,
  isScanning,
  onAuthorizeFolders,
}: SidebarProps) {
  const [showAddPlaylistModal, setShowAddPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');

  const [activeRightClickPlaylist, setActiveRightClickPlaylist] = useState<string | null>(null);

  const colors: Record<string, string> = {
    emerald: 'text-emerald-500 bg-emerald-500 hover:bg-emerald-500/10',
    sky: 'text-sky-500 bg-sky-500 hover:bg-sky-500/10',
    rose: 'text-rose-500 bg-rose-500 hover:bg-rose-500/10',
    violet: 'text-violet-500 bg-violet-500 hover:bg-violet-500/10',
    amber: 'text-amber-500 bg-amber-500 hover:bg-amber-500/10',
    indigo: 'text-indigo-500 bg-indigo-500 hover:bg-indigo-500/10',
    teal: 'text-teal-500 bg-teal-500 hover:bg-teal-500/10',
  };

  const bgColors: Record<string, string> = {
    emerald: 'bg-emerald-500',
    sky: 'bg-sky-500',
    rose: 'bg-rose-500',
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
    indigo: 'bg-indigo-500',
    teal: 'bg-teal-500',
  };

  const accentColorList = ['emerald', 'sky', 'rose', 'violet', 'amber', 'indigo', 'teal'];

  const handleCreatePlaylistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    onAddPlaylist(newPlaylistName.trim(), newPlaylistDesc.trim());
    setNewPlaylistName('');
    setNewPlaylistDesc('');
    setShowAddPlaylistModal(false);
  };

  const accentColorClass = colors[settings.accentColor] || 'bg-emerald-500';
  const accentBgClass = bgColors[settings.accentColor] || 'bg-emerald-500';
  const accentTextColor = colors[settings.accentColor]?.split(' ')[0] || 'text-emerald-500';

  return (
    <div
      className="w-16 sm:w-60 md:w-64 flex-shrink-0 flex flex-col justify-between border-r h-full relative z-20 transition-all duration-300 bg-black/30 border-white/[0.06] backdrop-blur-3xl text-zinc-100"
      id="desktop-sidebar-root"
    >
      <div className="flex-1 overflow-y-auto no-scrollbar py-4 px-2 sm:py-6 sm:px-4 space-y-6" id="sidebar-scrollable">
        {/* Brand Header */}
        <div className="flex items-center justify-center sm:justify-start space-x-0 sm:space-x-3 px-1 sm:px-2">
          <div className={`p-2 sm:p-2.5 rounded-xl ${accentColorClass} bg-opacity-20 ${accentTextColor} shadow-lg shadow-${settings.accentColor}-500/10`}>
            <Music size={18} className="animate-pulse" />
          </div>
          <div className="hidden sm:block">
            <span className="block text-xs md:text-sm font-black tracking-widest uppercase font-sans text-white">
              Resonance
            </span>
            <span className="block text-[8px] md:text-[9px] tracking-widest text-[#10B981] font-mono uppercase font-bold">
              Hi-Res Audio
            </span>
          </div>
        </div>

        {/* Directory Scan Trigger Box */}
        <div className="px-1 hidden sm:block" id="folder-onboarding-box">
          <div className="bg-white/5 dark:bg-white/5 light:bg-black/5 p-3 rounded-xl border border-white/10 dark:border-white/10 light:border-black/5 space-y-2">
            <div className="flex justify-between items-center text-[11px] text-neutral-400 dark:text-zinc-400 light:text-zinc-600 font-mono">
              <span>Import Folders</span>
              <span className="font-bold text-white dark:text-white light:text-zinc-950">{foldersCount} active</span>
            </div>
            <button
              onClick={onAddFolder}
              disabled={isScanning}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition ${accentBgClass} text-neutral-950 hover:brightness-110 disabled:opacity-50`}
              id="sidebar-add-folder-btn"
            >
              <FolderOpen size={13} />
              <span>{isScanning ? 'Scanning...' : 'Direct Import'}</span>
            </button>
            {foldersCount > 0 && onAuthorizeFolders && (
              <button
                onClick={onAuthorizeFolders}
                className="w-full py-1 px-2 rounded-lg bg-amber-500/20 text-amber-300 dark:text-amber-200 border border-amber-500/30 text-[9.5px] font-bold uppercase tracking-wider hover:bg-amber-500/30 transition flex items-center justify-center space-x-1"
                title="Grant container authorization to preserve offline tracks playback & ZIP packing speed"
                id="sidebar-reauth-folders-btn"
              >
                <AlertCircle size={11} />
                <span>Grant Permission</span>
              </button>
            )}
          </div>
        </div>

        {/* Library Lists */}
        <div className="space-y-2" id="sidebar-routes-library">
          <span className="px-1 sm:px-2 text-[9px] font-bold uppercase tracking-widest text-neutral-500 dark:text-zinc-500 light:text-zinc-400 font-mono block text-center sm:text-left">
            <span className="hidden sm:inline">Library</span>
            <span className="sm:hidden">Lib</span>
          </span>
          <nav className="space-y-1">
            <button
              onClick={() => onSelectTab('songs')}
              className={`w-full flex items-center justify-center sm:justify-start space-x-0 sm:space-x-3 px-2 sm:px-3 py-2 text-xs font-bold rounded-xl transition ${
                currentTab === 'songs'
                  ? `${settings.theme === 'dark' ? 'glass-nav-item-active text-white' : 'glass-nav-item-active-light text-zinc-950'} ${accentTextColor}`
                  : 'text-neutral-400 dark:text-zinc-400 light:text-zinc-600 hover:text-white dark:hover:text-white light:hover:text-zinc-950 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5'
              }`}
              title="All Tracks"
              id="sidebar-tab-songs"
            >
              <Music size={15} className="flex-shrink-0" />
              <span className="hidden sm:block truncate">All Tracks</span>
            </button>

            <button
              onClick={() => onSelectTab('albums')}
              className={`w-full flex items-center justify-center sm:justify-start space-x-0 sm:space-x-3 px-2 sm:px-3 py-2 text-xs font-bold rounded-xl transition ${
                currentTab === 'albums'
                  ? `${settings.theme === 'dark' ? 'glass-nav-item-active text-white' : 'glass-nav-item-active-light text-zinc-950'} ${accentTextColor}`
                  : 'text-neutral-400 dark:text-zinc-400 light:text-zinc-600 hover:text-white dark:hover:text-white light:hover:text-zinc-950 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5'
              }`}
              title="Albums"
              id="sidebar-tab-albums"
            >
              <Disc size={15} className="flex-shrink-0" />
              <span className="hidden sm:block truncate">Albums</span>
            </button>

            <button
              onClick={() => onSelectTab('artists')}
              className={`w-full flex items-center justify-center sm:justify-start space-x-0 sm:space-x-3 px-2 sm:px-3 py-2 text-xs font-bold rounded-xl transition ${
                currentTab === 'artists'
                  ? `${settings.theme === 'dark' ? 'glass-nav-item-active text-white' : 'glass-nav-item-active-light text-zinc-950'} ${accentTextColor}`
                  : 'text-neutral-400 dark:text-zinc-400 light:text-zinc-600 hover:text-white dark:hover:text-white light:hover:text-zinc-950 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5'
              }`}
              title="Artists"
              id="sidebar-tab-artists"
            >
              <User size={15} className="flex-shrink-0" />
              <span className="hidden sm:block truncate">Artists</span>
            </button>

            <button
              onClick={() => onSelectTab('genres')}
              className={`w-full flex items-center justify-center sm:justify-start space-x-0 sm:space-x-3 px-2 sm:px-3 py-2 text-xs font-bold rounded-xl transition ${
                currentTab === 'genres'
                  ? `${settings.theme === 'dark' ? 'glass-nav-item-active text-white' : 'glass-nav-item-active-light text-zinc-950'} ${accentTextColor}`
                  : 'text-neutral-400 dark:text-zinc-400 light:text-zinc-600 hover:text-white dark:hover:text-white light:hover:text-zinc-950 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5'
              }`}
              title="Genres"
              id="sidebar-tab-genres"
            >
              <Tags size={15} className="flex-shrink-0" />
              <span className="hidden sm:block truncate">Genres</span>
            </button>

            <button
              onClick={() => onSelectTab('stats')}
              className={`w-full flex items-center justify-center sm:justify-start space-x-0 sm:space-x-3 px-2 sm:px-3 py-2 text-xs font-bold rounded-xl transition ${
                currentTab === 'stats'
                  ? `${settings.theme === 'dark' ? 'glass-nav-item-active text-white' : 'glass-nav-item-active-light text-zinc-950'} ${accentTextColor}`
                  : 'text-neutral-400 dark:text-zinc-400 light:text-zinc-600 hover:text-white dark:hover:text-white light:hover:text-zinc-950 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5'
              }`}
              title="Statistics"
              id="sidebar-tab-stats"
            >
              <BarChart2 size={15} className="flex-shrink-0" />
              <span className="hidden sm:block truncate">Statistics</span>
            </button>
          </nav>
        </div>

        {/* Smart Playlists Section */}
        <div className="space-y-2" id="sidebar-routes-smart">
          <span className="px-1 sm:px-2 text-[9px] font-bold uppercase tracking-widest text-neutral-500 dark:text-zinc-500 light:text-zinc-400 font-mono block text-center sm:text-left">
            <span className="hidden sm:inline">Automated Mixes</span>
            <span className="sm:hidden">Mixes</span>
          </span>
          <nav className="space-y-1">
            <button
              onClick={() => onSelectTab('smart_liked')}
              className={`w-full flex items-center justify-center sm:justify-start space-x-0 sm:space-x-3 px-2 sm:px-3 py-2 text-xs font-bold rounded-xl transition ${
                currentTab === 'smart_liked'
                  ? `${settings.theme === 'dark' ? 'glass-nav-item-active text-white' : 'glass-nav-item-active-light text-zinc-950'} ${accentTextColor}`
                  : 'text-neutral-400 dark:text-zinc-400 light:text-zinc-600 hover:text-white dark:hover:text-white light:hover:text-zinc-950 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5'
              }`}
              title="Liked Songs"
              id="sidebar-tab-liked"
            >
              <Heart size={15} className="fill-red-500 stroke-red-500 flex-shrink-0" />
              <span className="hidden sm:block truncate">Liked Songs</span>
            </button>

            <button
              onClick={() => onSelectTab('smart_added')}
              className={`w-full flex items-center justify-center sm:justify-start space-x-0 sm:space-x-3 px-2 sm:px-3 py-2 text-xs font-bold rounded-xl transition ${
                currentTab === 'smart_added'
                  ? `${settings.theme === 'dark' ? 'glass-nav-item-active text-white' : 'glass-nav-item-active-light text-zinc-950'} ${accentTextColor}`
                  : 'text-neutral-400 dark:text-zinc-400 light:text-zinc-600 hover:text-white dark:hover:text-white light:hover:text-zinc-950 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5'
              }`}
              title="Recently Added"
              id="sidebar-tab-recent-added"
            >
              <Plus size={15} className="flex-shrink-0" />
              <span className="hidden sm:block truncate">Recently Added</span>
            </button>

            <button
              onClick={() => onSelectTab('smart_played')}
              className={`w-full flex items-center justify-center sm:justify-start space-x-0 sm:space-x-3 px-2 sm:px-3 py-2 text-xs font-bold rounded-xl transition ${
                currentTab === 'smart_played'
                  ? `${settings.theme === 'dark' ? 'glass-nav-item-active text-white' : 'glass-nav-item-active-light text-zinc-950'} ${accentTextColor}`
                  : 'text-neutral-400 dark:text-zinc-400 light:text-zinc-600 hover:text-white dark:hover:text-white light:hover:text-zinc-950 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5'
              }`}
              title="Recently Played"
              id="sidebar-tab-recent-played"
            >
              <Volume2 size={15} className="flex-shrink-0" />
              <span className="hidden sm:block truncate">Recently Played</span>
            </button>
          </nav>
        </div>

        {/* Custom Playlists list panel */}
        <div className="space-y-2" id="sidebar-routes-custom-playlists">
          <div className="flex items-center justify-between px-1 sm:px-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500 dark:text-zinc-500 light:text-zinc-400 font-mono text-center sm:text-left block w-full sm:w-auto">
              <span className="hidden sm:inline">Playlists</span>
              <span className="sm:hidden">Lists</span>
            </span>
            <button
              onClick={() => setShowAddPlaylistModal(true)}
              className="p-1 hover:bg-white/5 text-neutral-400 hover:text-white rounded hidden sm:block"
              title="Create new playlist"
              id="sidebar-create-playlist-trigger"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="space-y-1" id="sidebar-custom-playlist-list">
            {playlists.map((playlist) => {
              const tabId = `playlist_${playlist.id}`;
              const isSelected = currentTab === tabId;
              
              return (
                <div
                  key={playlist.id}
                  className="group relative flex items-center justify-between"
                  onMouseLeave={() => setActiveRightClickPlaylist(null)}
                >
                  <button
                    onClick={() => onSelectTab(tabId)}
                    className={`w-full flex items-center justify-center sm:justify-start space-x-0 sm:space-x-3 px-2 sm:px-3 py-2 text-xs font-bold rounded-xl transition truncate sm:pr-8 ${
                      isSelected
                        ? `${settings.theme === 'dark' ? 'glass-nav-item-active text-white' : 'glass-nav-item-active-light text-zinc-950'} ${accentTextColor}`
                        : 'text-neutral-400 dark:text-zinc-400 light:text-zinc-500 hover:text-white dark:hover:text-white light:hover:text-zinc-900 hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-black/5'
                    }`}
                    title={playlist.name}
                    id={`sidebar-tab-playlist-${playlist.id}`}
                  >
                    <FolderOpen size={15} className="flex-shrink-0" />
                    <span className="hidden sm:block truncate">{playlist.name}</span>
                    {playlist.isPinned && <Pin size={10} className="ml-1 opacity-75 hidden sm:inline" />}
                  </button>

                  {/* Context quick menu triggers on hover */}
                  <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center space-x-1">
                    <button
                      onClick={() => onPinPlaylist(playlist.id)}
                      className="p-1 text-neutral-400 hover:text-white hover:bg-white/5 rounded"
                      title="Pin Playlist"
                      id={`pin-playlist-${playlist.id}`}
                    >
                      <Pin size={11} />
                    </button>
                    <button
                      onClick={() => onExportPlaylistZip(playlist)}
                      className="p-1 text-neutral-400 hover:text-white hover:bg-white/5 rounded"
                      title="Export Playlist to ZIP"
                      id={`export-playlist-zip-${playlist.id}`}
                    >
                      <Download size={11} />
                    </button>
                    <button
                      onClick={() => onDeletePlaylist(playlist.id)}
                      className="p-1 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded"
                      title="Delete Playlist"
                      id={`delete-playlist-${playlist.id}`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}

            {playlists.length === 0 && (
              <span className="text-[9px] text-neutral-500 italic block text-center sm:text-left px-2 py-1">
                <span className="hidden sm:inline">No playlists created yet</span>
                <span className="sm:hidden">—</span>
              </span>
            )}
          </div>
        </div>
      </div>      {/* Sidebar Footer Settings Controls */}
      <div className="p-2 sm:p-4 border-t border-white/5 bg-neutral-950/40" id="sidebar-footer-controls">
        {/* Tab Settings button */}
        <div className="flex items-center justify-center px-1" id="sidebar-footer-settings-theme">
          <button
            onClick={() => onSelectTab('settings')}
            className={`flex items-center space-x-0 sm:space-x-2 text-xs font-bold transition justify-center w-full ${
              currentTab === 'settings' ? accentTextColor : 'text-neutral-400 hover:text-white'
            }`}
            title="Equalizer & Presets"
            id="sidebar-settings-tab-btn"
          >
            <Settings size={15} className="flex-shrink-0" />
            <span className="hidden sm:block truncate font-mono tracking-wider text-center w-full">SYSTEM SETTINGS</span>
          </button>
        </div>
      </div>

      {/* Playlist creation Modal */}
      {showAddPlaylistModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in" id="add-playlist-modal">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div>
              <h4 className="font-bold text-white">Create Custom Playlist</h4>
              <p className="text-xs text-neutral-400">Organize your songs into specialized folders</p>
            </div>

            <form onSubmit={handleCreatePlaylistSubmit} className="space-y-4" id="add-playlist-form">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono block text-neutral-400 font-bold">Playlist Name</label>
                <input
                  type="text"
                  required
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="e.g. Acoustic Sessions"
                  className="w-full bg-neutral-950 border border-white/5 py-2 px-3 rounded-lg text-xs text-neutral-200 outline-none focus:border-emerald-500"
                  id="playlist-name-input-field"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono block text-neutral-400 font-bold font-bold">Description (optional)</label>
                <input
                  type="text"
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  placeholder="e.g. My favorite coffee lounge favorites"
                  className="w-full bg-neutral-950 border border-white/5 py-2 px-3 rounded-lg text-xs text-neutral-200 outline-none focus:border-emerald-500"
                  id="playlist-desc-input-field"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPlaylistModal(false)}
                  className="flex-1 bg-neutral-800 text-neutral-300 rounded-lg py-2 text-xs font-semibold hover:bg-neutral-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 ${accentBgClass} text-neutral-950 rounded-lg py-2 text-xs font-semibold hover:brightness-110 transition`}
                  id="submit-create-playlist-btn"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
