import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Play,
  Heart,
  Plus,
  MoreVertical,
  Download,
  Trash2,
  Clock,
  Music,
  FolderLock,
  ListRestart,
  FolderOpen,
  ChevronRight,
  ListPlus
} from 'lucide-react';
import { Track, Playlist } from '../types';

interface TrackListProps {
  tracks: Track[];
  onPlayTrack: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  playlists: Playlist[];
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onToggleLike: (track: Track) => void;
  onDeleteTrack?: (trackId: string) => void;
  onExportSingleZip?: (track: Track) => void;
  onOpenFileDirectory?: (track: Track) => void;
  accentColor: string;
  sortBy?: string | null;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: 'title' | 'artist' | 'album' | 'genre' | 'duration' | 'addedAt') => void;
}

export default function TrackList({
  tracks,
  onPlayTrack,
  onAddToQueue,
  playlists,
  onAddToPlaylist,
  onToggleLike,
  onDeleteTrack,
  onExportSingleZip,
  onOpenFileDirectory,
  accentColor,
  sortBy,
  sortOrder,
  onSort,
}: TrackListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  // Reset pagination when tracks list changes (on change tab, filter, sort, search)
  useEffect(() => {
    setCurrentPage(1);
  }, [tracks]);

  // Track context option popovers
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    track: Track;
  } | null>(null);

  // Handle right click to open context menu with dynamic viewport safety
  const handleContextMenuOpen = (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 208; // approx w-52
    const menuHeight = 250; // approx height

    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth) {
      posX = window.innerWidth - menuWidth - 8;
    }
    if (posY + menuHeight > window.innerHeight) {
      posY = window.innerHeight - menuHeight - 8;
    }

    posX = Math.max(8, posX);
    posY = Math.max(8, posY);

    setContextMenu({ x: posX, y: posY, track });
    setActiveMenuTrackId(null); // Close vertical ellipsis menus if open
  };

  // Lazy Pagination to handle up to 100,000+ files gracefully
  const paginatedTracks = useMemo(() => {
    return tracks.slice(0, currentPage * itemsPerPage);
  }, [tracks, currentPage]);

  const hasMore = tracks.length > paginatedTracks.length;

  const loadMore = () => {
    setCurrentPage((prev) => prev + 1);
  };

  // Intersection Observer for seamless auto-loading infinite scroll
  const observerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      {
        root: null, // viewport / parent scroll container
        rootMargin: '350px', // start loading before the user reaches the absolute bottom
        threshold: 0.1,
      }
    );

    const currentSentinel = observerRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [hasMore, currentPage]);

  const formatTrackDuration = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const colors: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500 hover:bg-emerald-500/10 hover:text-white border-emerald-500/20 shadow-emerald-500/20 text-emerald-400 focus:border-emerald-500',
    sky: 'text-sky-400 bg-sky-500 hover:bg-sky-500/10 hover:text-white border-sky-500/20 shadow-sky-500/20 text-sky-400 focus:border-sky-500',
    rose: 'text-rose-400 bg-rose-500 hover:bg-rose-500/10 hover:text-white border-rose-500/20 shadow-rose-500/20 text-rose-400 focus:border-rose-500',
    violet: 'text-violet-400 bg-violet-500 hover:bg-violet-500/10 hover:text-white border-violet-500/20 shadow-violet-500/20 text-violet-400 focus:border-violet-500',
    amber: 'text-amber-400 bg-amber-500 hover:bg-amber-500/10 hover:text-white border-amber-500/20 shadow-amber-500/20 text-amber-400 focus:border-amber-500',
    indigo: 'text-indigo-400 bg-indigo-500 hover:bg-indigo-500/10 hover:text-white border-indigo-500/20 shadow-indigo-500/20 text-indigo-400 focus:border-indigo-500',
    teal: 'text-teal-400 bg-teal-500 hover:bg-teal-500/10 hover:text-white border-teal-500/20 shadow-teal-500/20 text-teal-400 focus:border-teal-500',
  };

  const accentColorClass = colors[accentColor]?.split(' ')[0] || 'text-emerald-400';
  const accentBorderClass = colors[accentColor]?.split(' ')[3] || 'border-emerald-500/20';

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[40vh]" id="no-tracks-indicator-box">
        <div className="p-4 dark:bg-neutral-900 light:bg-zinc-200 dark:border-white/5 light:border-black/5 border rounded-2xl dark:text-neutral-500 light:text-zinc-400 mb-3">
          <FolderLock size={32} />
        </div>
        <h4 className="text-sm font-semibold dark:text-white light:text-zinc-900">No Tracks Found in Selection</h4>
        <p className="text-xs dark:text-neutral-400 light:text-zinc-500 max-w-xs mt-1">
          Import local directories or adjust filters to view songs in this tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" id="tracks-table-wrapper">
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b dark:border-white/5 light:border-black/5 text-[10px] font-bold uppercase tracking-wider dark:text-neutral-500 light:text-zinc-500 font-mono select-none">
        <div className="col-span-1 text-center font-bold">#</div>
        <div
          onClick={() => onSort?.('title')}
          className="col-span-7 sm:col-span-6 lg:col-span-4 flex items-center space-x-1 cursor-pointer dark:hover:text-neutral-200 light:hover:text-zinc-800 transition"
        >
          <span>Title</span>
          {sortBy === 'title' && (
            <span className="text-xs transition-transform duration-200">{sortOrder === 'asc' ? '▲' : '▼'}</span>
          )}
        </div>
        <div
          onClick={() => onSort?.('album')}
          className="col-span-3 hidden sm:flex lg:col-span-3 items-center space-x-1 cursor-pointer dark:hover:text-neutral-200 light:hover:text-zinc-800 transition"
        >
          <span>Album</span>
          {sortBy === 'album' && (
            <span className="text-xs transition-transform duration-200">{sortOrder === 'asc' ? '▲' : '▼'}</span>
          )}
        </div>
        <div
          onClick={() => onSort?.('genre')}
          className="col-span-2 hidden lg:flex lg:col-span-2 items-center space-x-1 cursor-pointer dark:hover:text-neutral-200 light:hover:text-zinc-800 transition"
        >
          <span>Genre</span>
          {sortBy === 'genre' && (
            <span className="text-xs transition-transform duration-200">{sortOrder === 'asc' ? '▲' : '▼'}</span>
          )}
        </div>
        <div
          onClick={() => onSort?.('duration')}
          className="col-span-2 sm:col-span-1 flex items-center justify-center cursor-pointer dark:hover:text-neutral-200 light:hover:text-zinc-800 transition"
        >
          <Clock size={13} className="mr-1" />
          {sortBy === 'duration' && (
            <span className="text-xs transition-transform duration-200">{sortOrder === 'asc' ? '▲' : '▼'}</span>
          )}
        </div>
        <div className="col-span-2 sm:col-span-1 text-center">Actions</div>
      </div>

      {/* Rows */}
      <div className="space-y-1.5" id="tracks-table-body">
        {paginatedTracks.map((track, idx) => (
          <div
            key={track.id}
            onMouseLeave={() => setActiveMenuTrackId(null)}
            onClick={() => onPlayTrack(track)}
            onContextMenu={(e) => handleContextMenuOpen(e, track)}
            className="grid grid-cols-12 gap-4 items-center px-4 py-2.5 dark:bg-neutral-900/55 light:bg-zinc-950/8 dark:hover:bg-neutral-900/80 light:hover:bg-zinc-950/20 border dark:border-white/[0.08] light:border-black/[0.08] dark:hover:border-white/20 light:hover:border-black/20 rounded-xl transition duration-200 group cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
          >
            {/* Number / Play Indicator */}
            <div className="col-span-1 text-center text-xs font-mono dark:text-neutral-400 light:text-zinc-500 dark:group-hover:text-white light:group-hover:text-zinc-950 relative">
              <span className="group-hover:opacity-0 transition-opacity">{idx + 1}</span>
              <Play
                size={12}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity fill-current dark:text-white light:text-zinc-950"
              />
            </div>

            {/* Artwork + Title/Artist */}
            <div className="col-span-7 sm:col-span-6 lg:col-span-4 flex items-center space-x-3 min-w-0 pr-2">
              <div className="w-9 h-9 rounded-lg dark:bg-neutral-800 light:bg-zinc-200 border dark:border-white/5 light:border-black/5 overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                {track.artworkUrl ? (
                  <img src={track.artworkUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Music size={15} className="dark:text-neutral-500 light:text-zinc-400" />
                )}
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-bold dark:text-neutral-200 light:text-zinc-800 truncate dark:group-hover:text-white light:group-hover:text-black transition-colors">
                  {track.title}
                </span>
                <span className="block text-[10.5px] dark:text-neutral-400 light:text-zinc-500 truncate">
                  {track.artist}
                </span>
              </div>
            </div>

            {/* Album */}
            <div className="col-span-3 hidden sm:block lg:col-span-3 text-xs dark:text-neutral-400 light:text-zinc-500 truncate pr-2">
              {track.album}
            </div>

            {/* Genre */}
            <div className="col-span-2 hidden lg:block lg:col-span-2 text-xs dark:text-neutral-400 light:text-zinc-500 truncate pr-2">
              {track.genre}
            </div>

            {/* Time */}
            <div className="col-span-2 sm:col-span-1 text-center text-xs dark:text-neutral-400 light:text-zinc-500 font-mono">
              {formatTrackDuration(track.duration)}
            </div>

            {/* Actions Context Trigger */}
            <div className="col-span-2 sm:col-span-1 flex items-center justify-center space-x-1 relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onToggleLike(track)}
                className={`p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100 ${
                  track.isLiked ? 'opacity-100 text-red-500 hover:text-red-600' : 'dark:text-neutral-500 light:text-zinc-400 dark:hover:text-white light:hover:text-zinc-950'
                }`}
                title={track.isLiked ? 'Dislike Song' : 'Like Song'}
              >
                <Heart size={13} className={track.isLiked ? 'fill-current' : ''} />
              </button>

              <button
                onClick={() => setActiveMenuTrackId(activeMenuTrackId === track.id ? null : track.id)}
                className="p-1.5 dark:text-neutral-400 light:text-zinc-500 dark:hover:text-white light:hover:text-zinc-950 dark:hover:bg-neutral-800 light:hover:bg-zinc-200 rounded-lg transition"
                title="Song options"
              >
                <MoreVertical size={13} />
              </button>

              {/* Tracks Context Sub-Popover Menu */}
              {activeMenuTrackId === track.id && (
                <div
                  className="absolute right-0 top-8 dark:bg-neutral-950 light:bg-white border dark:border-white/10 light:border-black/10 p-1.5 rounded-xl shadow-2xl w-48 text-left z-30 space-y-0.5 animate-fade-in"
                  id={`context-popover-${track.id}`}
                >
                  <button
                    onClick={() => {
                      onPlayTrack(track);
                      setActiveMenuTrackId(null);
                    }}
                    className="w-full text-left font-semibold text-[11px] dark:text-neutral-200 light:text-zinc-800 dark:hover:text-white light:hover:text-zinc-950 dark:hover:bg-white/5 light:hover:bg-black/5 py-1.5 px-3 rounded-lg transition"
                  >
                    Play Now
                  </button>

                  <button
                    onClick={() => {
                      onAddToQueue(track);
                      setActiveMenuTrackId(null);
                    }}
                    className="w-full text-left font-semibold text-[11px] dark:text-neutral-200 light:text-zinc-800 dark:hover:text-white light:hover:text-zinc-950 dark:hover:bg-white/5 light:hover:bg-black/5 py-1.5 px-3 rounded-lg transition"
                  >
                    Add to Queue
                  </button>

                  {/* Playlist sub-directory listings */}
                  {playlists.length > 0 && (
                    <div className="border-t dark:border-white/5 light:border-black/5 my-1 pt-1 font-sans">
                      <span className="block px-3 text-[9px] uppercase tracking-wider dark:text-neutral-500 light:text-zinc-500 font-mono font-bold mb-1">
                        Add to Playlist
                      </span>
                      {playlists.map((playlist) => (
                        <button
                          key={playlist.id}
                          onClick={() => {
                            onAddToPlaylist(playlist.id, track.id);
                            setActiveMenuTrackId(null);
                          }}
                          className="w-full text-left text-[10.5px] truncate dark:text-neutral-300 light:text-zinc-700 dark:hover:text-white light:hover:text-zinc-950 dark:hover:bg-white/5 light:hover:bg-black/5 py-1 px-3 rounded-md transition"
                        >
                          + {playlist.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {onExportSingleZip && (
                    <button
                      onClick={() => {
                        onExportSingleZip(track);
                        setActiveMenuTrackId(null);
                      }}
                      className="w-full text-left font-semibold text-[11px] dark:text-neutral-200 light:text-zinc-800 dark:hover:text-white light:hover:text-zinc-950 dark:hover:bg-white/5 light:hover:bg-black/5 py-1.5 px-3 rounded-lg transition border-t dark:border-white/5 light:border-black/5 mt-1"
                    >
                      Export to ZIP (.zip)
                    </button>
                  )}

                  {onOpenFileDirectory && (
                    <button
                      onClick={() => {
                        onOpenFileDirectory(track);
                        setActiveMenuTrackId(null);
                      }}
                      className="w-full text-left font-semibold text-[11px] dark:text-neutral-200 light:text-zinc-800 dark:hover:text-white light:hover:text-zinc-950 dark:hover:bg-white/5 light:hover:bg-black/5 py-1.5 px-3 rounded-lg transition border-t dark:border-white/5 light:border-black/5 mt-1"
                    >
                      Open File Directory
                    </button>
                  )}

                  {onDeleteTrack && (
                    <button
                      onClick={() => {
                        onDeleteTrack(track.id);
                        setActiveMenuTrackId(null);
                      }}
                      className="w-full text-left font-semibold text-[11px] text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 py-1.5 px-3 rounded-lg transition border-t dark:border-white/5 light:border-black/5 mt-1"
                    >
                      Delete Track
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Infinite scrolling viewport load-more helper */}
      {hasMore && (
        <div ref={observerRef} className="flex justify-center py-8" id="load-more-lazy-box">
          <div className="flex items-center space-x-2.5 text-xs font-mono text-neutral-400 bg-neutral-900/40 border border-white/5 px-4 py-2 rounded-xl backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Autoloading more tracks... ({tracks.length - paginatedTracks.length} remaining)</span>
          </div>
        </div>
      )}

      {/* Floating Custom Right-click Context Menu */}
      {contextMenu && (
        <>
          {/* Backdrop to close menu on outside clicks */}
          <div
            className="fixed inset-0 z-40 bg-transparent cursor-default"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />

          <div
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 dark:bg-neutral-950/95 light:bg-white/95 border dark:border-white/10 light:border-black/10 p-1.5 rounded-xl shadow-2xl w-52 text-left space-y-0.5 animate-fade-in backdrop-blur-md select-none pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="px-3 py-1.5 border-b dark:border-white/5 light:border-black/5 mb-1 truncate">
              <span className="block text-[10.5px] font-bold dark:text-neutral-200 light:text-zinc-800 truncate">
                {contextMenu.track.title}
              </span>
              <span className="block text-[9px] dark:text-neutral-500 light:text-zinc-500 truncate">
                {contextMenu.track.artist}
              </span>
            </div>

            <button
              onClick={() => {
                onPlayTrack(contextMenu.track);
                setContextMenu(null);
              }}
              className="w-full text-left font-semibold text-[11px] dark:text-neutral-200 light:text-zinc-800 dark:hover:text-white light:hover:text-zinc-950 dark:hover:bg-white/5 light:hover:bg-black/5 py-1.5 px-3 rounded-lg transition flex items-center space-x-2"
            >
              <Play size={12} className="fill-current" />
              <span>Play Now</span>
            </button>

            <button
              onClick={() => {
                onAddToQueue(contextMenu.track);
                setContextMenu(null);
              }}
              className="w-full text-left font-semibold text-[11px] dark:text-neutral-200 light:text-zinc-800 dark:hover:text-white light:hover:text-zinc-950 dark:hover:bg-white/5 light:hover:bg-black/5 py-1.5 px-3 rounded-lg transition flex items-center space-x-2"
            >
              <ListPlus size={12} />
              <span>Add to Queue</span>
            </button>

            {/* Playlists option with Fly-out Submenu */}
            <div className="relative group/playlist">
              <button className="w-full text-left font-semibold text-[11px] dark:text-neutral-200 light:text-zinc-800 dark:hover:text-white light:hover:text-zinc-950 dark:hover:bg-white/5 light:hover:bg-black/5 py-1.5 px-3 rounded-lg transition flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Plus size={12} />
                  <span>Add to Playlist</span>
                </span>
                <ChevronRight size={10} className="dark:text-neutral-500 light:text-zinc-500" />
              </button>
              {playlists.length > 0 ? (
                <div
                  className={`absolute top-0 hidden group-hover/playlist:block dark:bg-neutral-950/95 light:bg-white/95 border dark:border-white/10 light:border-black/10 p-1.5 rounded-xl shadow-2xl w-44 hover:block max-h-48 overflow-y-auto z-50 ${
                    contextMenu.x + 208 + 176 > window.innerWidth
                      ? 'right-full mr-1'
                      : 'left-full ml-1'
                  }`}
                >
                  {playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => {
                        onAddToPlaylist(playlist.id, contextMenu.track.id);
                        setContextMenu(null);
                      }}
                      className="w-full text-left text-[10.5px] truncate dark:text-neutral-300 light:text-zinc-700 dark:hover:text-white light:hover:text-zinc-950 dark:hover:bg-white/5 light:hover:bg-black/5 py-1 px-2.5 rounded-md transition"
                    >
                      + {playlist.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  className={`absolute top-0 hidden group-hover/playlist:block dark:bg-neutral-950/95 light:bg-white/95 border dark:border-white/10 light:border-black/10 p-2 rounded-xl shadow-2xl w-40 text-center hover:block z-50 ${
                    contextMenu.x + 208 + 160 > window.innerWidth
                      ? 'right-full mr-1'
                      : 'left-full ml-1'
                  }`}
                >
                  <span className="block text-[9.5px] dark:text-neutral-500 light:text-zinc-500 italic">
                    No custom playlists
                  </span>
                </div>
              )}
            </div>

            {onOpenFileDirectory && (
              <button
                onClick={() => {
                  onOpenFileDirectory(contextMenu.track);
                  setContextMenu(null);
                }}
                className="w-full text-left font-semibold text-[11px] dark:text-neutral-200 light:text-zinc-800 dark:hover:text-white light:hover:text-zinc-950 dark:hover:bg-white/5 light:hover:bg-black/5 py-1.5 px-3 rounded-lg transition flex items-center space-x-2 border-t dark:border-white/5 light:border-black/5 mt-1 pt-1.5"
              >
                <FolderOpen size={12} />
                <span>Show in Explorer</span>
              </button>
            )}

            {onDeleteTrack && (
              <button
                onClick={() => {
                  onDeleteTrack(contextMenu.track.id);
                  setContextMenu(null);
                }}
                className="w-full text-left font-semibold text-[11px] text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 py-1.5 px-3 rounded-lg transition flex items-center space-x-2 border-t dark:border-white/5 light:border-black/5 mt-1 pt-1.5"
              >
                <Trash2 size={12} />
                <span>Delete Track</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
