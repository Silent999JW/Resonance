import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Music,
  Disc,
  User,
  Tags,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Heart,
  Plus,
  FolderOpen,
  Sliders,
  ChevronRight,
  Activity,
  ArrowRight,
  Minimize2,
  Download,
  Pin,
  Check,
  X,
  AlertCircle,
  FolderSync
} from 'lucide-react';

import { Track, Playlist, PlayHistoryEntry, AppSettings } from './types';
import { musicDb } from './utils/db';
import { parseAudioMetadata } from './utils/metadata';
import { audioEngine, AudioEngineState } from './utils/audioEngine';

import Sidebar from './components/Sidebar';
import TrackList from './components/TrackList';
import AudioSettingsPanel from './components/AudioSettingsPanel';
import StatsView from './components/StatsView';
import FullscreenPlayer from './components/FullscreenPlayer';
import MiniPlayer from './components/MiniPlayer';

// Import JSZip for playlist export
import JSZip from 'jszip';

export default function App() {
  // --- LIBRARY STATE ---
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [history, setHistory] = useState<PlayHistoryEntry[]>([]);
  const [folders, setFolders] = useState<{ id: string; name: string; handle: FileSystemDirectoryHandle }[]>([]);

  // --- PLAYBACK QUEUE STATE ---
  const [queue, setQueue] = useState<Track[]>([]);
  const [activeQueueIndex, setActiveQueueIndex] = useState<number>(-1);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);

  // --- SETTINGS STATE ---
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    accentColor: 'emerald',
    crossfadeDuration: 0,
    equalizerEnabled: false,
    equalizerGains: Array(10).fill(0),
    volume: 0.8,
    playbackSpeed: 1.0,
    replayGainNormalized: true,
  });

  // --- HUD / UI NAVIGATION STATE ---
  const [currentTab, setCurrentTab] = useState<string>('songs');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [globalSearchShortcutFocused, setGlobalSearchShortcutFocused] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Background utilities state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const [zipActiveName, setZipActiveName] = useState<string>('');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isRepeat, setIsRepeat] = useState<boolean>(false);

  // Sorting state for the library tracks
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'album' | 'genre' | 'duration' | 'addedAt' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'title' | 'artist' | 'album' | 'genre' | 'duration' | 'addedAt') => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Modals / Panels toggles
  const [isFullscreenMode, setIsFullscreenMode] = useState<boolean>(false);
  const [isMiniMode, setIsMiniMode] = useState<boolean>(false);

  // In-app directory locator modal
  const [locatingTrack, setLocatingTrack] = useState<Track | null>(null);
  const [locatingFolderFiles, setLocatingFolderFiles] = useState<string[]>([]);
  const [isLocatingScanActive, setIsLocatingScanActive] = useState<boolean>(false);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  // Custom metadata visual editor
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  // Playback state mirroring from engine
  const [playbackState, setPlaybackState] = useState<AudioEngineState>({
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    volume: 0.8,
    playbackSpeed: 1.0,
  });

  // --- LOAD INITIAL DATA ON HYDRATION ---
  useEffect(() => {
    async function loadData() {
      try {
        const loadedTracks = await musicDb.getAllTracks();
        const loadedPlaylists = await musicDb.getAllPlaylists();
        const loadedHistory = await musicDb.getHistory();
        
        // Restore browser security permission tokens for monitored folders if they exist
        const loadedFolders = await musicDb.getFolders();
        setFolders(loadedFolders);

        setTracks(loadedTracks);
        setPlaylists(loadedPlaylists);
        setHistory(loadedHistory);

        // Settings load
        const theme = await musicDb.getSetting<'dark' | 'light'>('theme', 'dark');
        const accent = await musicDb.getSetting<string>('accentColor', 'emerald');
        const crossfade = await musicDb.getSetting<number>('crossfadeDuration', 0);
        const eqEnabled = await musicDb.getSetting<boolean>('equalizerEnabled', false);
        const eqGains = await musicDb.getSetting<number[]>('equalizerGains', Array(10).fill(0));
        const volume = await musicDb.getSetting<number>('volume', 0.8);
        const speed = await musicDb.getSetting<number>('playbackSpeed', 1.0);
        const normalized = await musicDb.getSetting<boolean>('replayGainNormalized', true);
        const premiumTheme = await musicDb.getSetting<string>('premiumTheme', 'classic');

        const loadedSettings: AppSettings = {
          theme,
          accentColor: accent,
          crossfadeDuration: crossfade,
          equalizerEnabled: eqEnabled,
          equalizerGains: eqGains,
          volume,
          playbackSpeed: speed,
          replayGainNormalized: normalized,
          premiumTheme,
        };

        setSettings(loadedSettings);

        // Sync values directly into audioEngine
        audioEngine.setVolume(volume);
        audioEngine.setPlaybackSpeed(speed);
        audioEngine.setCrossfade(crossfade);
        audioEngine.setEqualizerEnabled(eqEnabled);
        audioEngine.setEqualizerGains(eqGains);

      } catch (err) {
        console.error('IndexedDB loading failed:', err);
      }
    }
    loadData();
  }, []);

  // --- AUDIO DISPATCH SYNC & SUB ---
  useEffect(() => {
    // 1. Sync Playback Metrics state
    const unsubscribeState = audioEngine.subscribeState((newState) => {
      setPlaybackState(newState);
    });

    // 2. Track complete callback
    const unsubscribeEnded = audioEngine.subscribeTrackEnded(() => {
      handleNextTrack();
    });

    // 3. Play count trigger: called only when a song is listened for 30s!
    const unsubscribeQualified = audioEngine.subscribePlayQualified(async (trackId, listenDur) => {
      setTracks((prevTracks) => {
        const updated = prevTracks.map((t) => {
          if (t.id === trackId) {
            const upTrack = {
              ...t,
              playCount: (t.playCount || 0) + 1,
              lastPlayedAt: Date.now(),
            };
            musicDb.saveTrack(upTrack); // save in indexeddb
            return upTrack;
          }
          return t;
        });
        return updated;
      });

      // Append play to chronological auditing history
      const historyEntry: PlayHistoryEntry = {
        id: `hist_${Date.now()}_${trackId}`,
        trackId,
        playedAt: Date.now(),
        listenDuration: Math.round(listenDur),
        completed: true,
      };

      await musicDb.addHistoryEntry(historyEntry);
      
      // Update history state to trigger instant stats rerendering
      setHistory((prev) => [...prev, historyEntry]);
    });

    return () => {
      unsubscribeState();
      unsubscribeEnded();
      unsubscribeQualified();
    };
  }, [queue, activeQueueIndex]);

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus Search: Ctrl + F or Cmd + F
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setGlobalSearchShortcutFocused(true);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      // Space Play/Pause
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleGlobalPlayPause();
      }

      // Skip: Alt/Ctrl + ArrowRight
      if ((e.ctrlKey || e.altKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextTrack();
      }

      // Back: Alt/Ctrl + ArrowLeft
      if ((e.ctrlKey || e.altKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevTrack();
      }

      // Like current song: Ctrl + L
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (currentTrack) {
          handleToggleLike(currentTrack);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTrack, queue, activeQueueIndex, playbackState.isPlaying]);

  // --- ACCENT CLASSIFICATION MAPS ---
  const accentClasses: Record<string, string> = {
    emerald: 'bg-emerald-500 fill-emerald-500 text-emerald-400 border-emerald-500/10 shadow-emerald-500/10 focus:border-emerald-500',
    sky: 'bg-sky-500 fill-sky-500 text-sky-400 border-sky-500/10 shadow-sky-500/10 focus:border-sky-500',
    rose: 'bg-rose-500 fill-rose-500 text-rose-400 border-rose-500/10 shadow-rose-500/10 focus:border-rose-500',
    violet: 'bg-violet-500 fill-violet-500 text-violet-400 border-violet-500/10 shadow-violet-500/10 focus:border-violet-500',
    amber: 'bg-amber-500 fill-amber-500 text-amber-400 border-amber-500/10 shadow-amber-500/10 focus:border-amber-500',
    indigo: 'bg-indigo-500 fill-indigo-500 text-indigo-400 border-indigo-500/10 shadow-indigo-500/10 focus:border-indigo-500',
    teal: 'bg-teal-500 fill-teal-500 text-teal-400 border-teal-500/10 shadow-teal-500/10 focus:border-teal-500',
  };

  const currentAccent = settings.accentColor || 'emerald';
  const customAccentBg = accentClasses[currentAccent]?.split(' ')[0] || 'bg-emerald-500';
  const customAccentText = accentClasses[currentAccent]?.split(' ')[2] || 'text-emerald-400';
  const customAccentBorder = accentClasses[currentAccent]?.split(' ')[3] || 'border-emerald-500/10';

  // --- RECURSIVE DIRECTORY INDEXER ---
  const handleImportDirectory = async () => {
    if (!('showDirectoryPicker' in window)) {
      alert('Your browser does not support the Native Directory Access API. Please use Chromium browsers (Chrome, Edge) to recursively load full directory hierarchies. Otherwise, drop songs directly into the dashboard.');
      return;
    }

    try {
      setIsScanning(true);
      const directoryHandle = await (window as any).showDirectoryPicker();
      
      // Save directory handle references in IndexedDB
      await musicDb.saveFolder(directoryHandle.name, directoryHandle, directoryHandle.name);
      setFolders((prev) => [...prev, { id: directoryHandle.name, name: directoryHandle.name, handle: directoryHandle }]);

      const fileHandles: any[] = [];
      
      async function scan(currentDir: any) {
        for await (const entry of (currentDir as any).values()) {
          if (entry.kind === 'file') {
            const ext = entry.name.split('.').pop()?.toLowerCase();
            if (['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a'].includes(ext || '')) {
              fileHandles.push(entry);
            }
          } else if (entry.kind === 'directory') {
            await scan(entry);
          }
        }
      }

      await scan(directoryHandle);

      // Parse metadata block by block to avoid CPU choke
      const freshlyParsedTracks: Track[] = [];
      for (const fileHandle of fileHandles) {
        try {
          const file = await fileHandle.getFile();
          // Fast tag reader
          const metadata = await parseAudioMetadata(file, fileHandle);

          const trackId = `track_${file.name}_${file.size}_${file.lastModified}`;
          const finalTrack: Track = {
            id: trackId,
            ...metadata,
            playCount: 0,
            addedAt: Date.now(),
            fileHandle,
          };
          freshlyParsedTracks.push(finalTrack);
        } catch (e) {
          console.warn(`Could not read metadata for file ${fileHandle.name}:`, e);
        }
      }

      // Save tracks to state and db
      const mergedTracks = [...tracks];
      freshlyParsedTracks.forEach((newTrack) => {
        if (!mergedTracks.some((t) => t.id === newTrack.id)) {
          mergedTracks.push(newTrack);
        }
      });

      await musicDb.saveTracks(mergedTracks);
      setTracks(mergedTracks);

    } catch (err) {
      console.error('Directory picker was aborted or failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleManualFilesFallback = async (files: FileList) => {
    setIsScanning(true);
    const parsedTracks: Track[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a'].includes(ext || '')) continue;

      try {
        const metadata = await parseAudioMetadata(file);
        const trackId = `track_${file.name}_${file.size}_${file.lastModified}`;
        const finalTrack: Track = {
          id: trackId,
          ...metadata,
          playCount: 0,
          addedAt: Date.now(),
          rawFile: file,
        };
        parsedTracks.push(finalTrack);
      } catch (e) {
        console.warn('Metadata parsing fail on dropped file:', e);
      }
    }

    const mergedTracks = [...tracks];
    parsedTracks.forEach((newTrack) => {
      if (!mergedTracks.some((t) => t.id === newTrack.id)) {
        mergedTracks.push(newTrack);
      }
    });

    await musicDb.saveTracks(mergedTracks);
    setTracks(mergedTracks);
    setIsScanning(false);
  };

  // --- SETTINGS DISPATCH UPDATER ---
  const handleUpdateSettings = async (newFields: Partial<AppSettings>) => {
    const updated = { ...settings, ...newFields };
    setSettings(updated);

    // Save individual values to IndexedDB settings tables
    Object.entries(newFields).forEach(([key, val]) => {
      musicDb.saveSetting(key, val);
    });
  };

  // --- PLAYLISTS OPERATION ---
  const handleAddPlaylist = async (name: string, description: string = '') => {
    const newPlaylist: Playlist = {
      id: `pl_${Date.now()}`,
      name,
      description,
      trackIds: [],
      isPinned: false,
      isSmart: false,
      createdAt: Date.now(),
    };
    await musicDb.savePlaylist(newPlaylist);
    setPlaylists((prev) => [...prev, newPlaylist]);
  };

  const handleDeletePlaylist = async (id: string) => {
    await musicDb.deletePlaylist(id);
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (currentTab === `playlist_${id}`) {
      setCurrentTab('songs');
    }
  };

  const handlePinPlaylist = async (id: string) => {
    setPlaylists((prev) => {
      return prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, isPinned: !p.isPinned };
          musicDb.savePlaylist(updated);
          return updated;
        }
        return p;
      });
    });
  };

  const handleAddTrackToPlaylist = async (playlistId: string, trackId: string) => {
    setPlaylists((prev) => {
      return prev.map((p) => {
        if (p.id === playlistId) {
          if (p.trackIds.includes(trackId)) return p;
          const updated = { ...p, trackIds: [...p.trackIds, trackId] };
          musicDb.savePlaylist(updated);
          return updated;
        }
        return p;
      });
    });
  };

  // --- DIRECTORY SECURITY RE-AUTHORIZATION TRIGGER ---
  const handleAuthorizeFolders = async () => {
    let success = 0;
    let failed = 0;
    for (const folder of folders) {
      if (folder.handle) {
        try {
          const opts = { mode: 'read' as const };
          const permission = await folder.handle.queryPermission(opts);
          if (permission === 'granted') {
            success++;
          } else {
            const requested = await folder.handle.requestPermission(opts);
            if (requested === 'granted') {
              success++;
            } else {
              failed++;
            }
          }
        } catch (err) {
          console.error('Failed to grant permission for folder:', folder.name, err);
          failed++;
        }
      }
    }

    if (success > 0) {
      alert(`Permission successfully restored for ${success} local directories! Files are now unlocked.`);
      const loadedTracks = await musicDb.getAllTracks();
      setTracks(loadedTracks);
    } else if (failed > 0) {
      alert('Local folder authorization was cancelled or denied.');
    }
  };

  // --- OPEN FILE DIRECTORY OVERVIEW ---
  const handleOpenFileDirectory = async (track: Track) => {
    setLocatingTrack(track);
    setLocatingFolderFiles([]);
    setIsLocatingScanActive(true);

    try {
      if (folders.length > 0) {
        let foundFolder: any = null;
        for (const f of folders) {
          try {
            const permission = await f.handle.queryPermission({ mode: 'read' });
            if (permission === 'granted') {
              const entries = [];
              for await (const entry of (f.handle as any).values()) {
                entries.push(entry.name);
              }
              if (entries.includes(track.fileName)) {
                foundFolder = f;
                setLocatingFolderFiles(entries);
                break;
              }
            }
          } catch (err) {
            console.warn('Folder check fail:', err);
          }
        }

        if (!foundFolder) {
          const first = folders[0];
          const permission = await first.handle.queryPermission({ mode: 'read' });
          if (permission === 'granted') {
            const entries = [];
            for await (const entry of (first.handle as any).values()) {
              entries.push(entry.name);
            }
            setLocatingFolderFiles(entries);
          }
        }
      }
    } catch (e) {
      console.warn('Directory scanner error:', e);
    } finally {
      setIsLocatingScanActive(false);
    }
  };

  // --- GENERALIZED ZIP MODULE COMPILER & EXPORTER ---
  const handleExportTracksToZip = async (name: string, listTracks: Track[]) => {
    if (listTracks.length === 0) {
      alert('Selection has 0 tracks! Configure files in library first.');
      return;
    }

    try {
      // Check if we need permission on folder handles first to prevent empty ZIPs!
      const unauthorizedFolders = [];
      for (const f of folders) {
        if (f.handle) {
          const status = await f.handle.queryPermission({ mode: 'read' });
          if (status !== 'granted') {
            unauthorizedFolders.push(f);
          }
        }
      }

      if (unauthorizedFolders.length > 0) {
        const approved = confirm(`Security requirement: Your connected directory "${unauthorizedFolders[0].name}" needs browser authorization before the local files can be packed. Grant directory access?`);
        if (approved) {
          let success = false;
          for (const f of unauthorizedFolders) {
            try {
              const res = await f.handle.requestPermission({ mode: 'read' });
              if (res === 'granted') {
                success = true;
              }
            } catch (err) {
              console.error('Directory authorized fail:', err);
            }
          }
          if (!success) {
            alert('Authorization denied. ZIP compilation cancelled.');
            return;
          }
        } else {
          alert('ZIP export cancelled (permission denied).');
          return;
        }
      }

      setZipProgress(1);
      setZipActiveName(name);
      const zip = new JSZip();

      // Loop over and load the actual physical tracks binary data
      for (let i = 0; i < listTracks.length; i++) {
        const track = listTracks[i];
        let file: File;

        if (track.rawFile) {
          file = track.rawFile;
        } else if (track.fileHandle) {
          try {
            // Restore permission on fileHandle if prompt is required
            file = await track.fileHandle.getFile();
          } catch (e) {
            console.error('Permission not restored for file:', track.fileName);
            continue;
          }
        } else {
          continue;
        }

        // Deduplicate filename if multiple files are named "01. Song.mp3"
        let uniqueName = file.name;
        let dupCounter = 1;
        const bExt = uniqueName.split('.').pop() || 'mp3';
        const bName = uniqueName.replace(/\.[^/.]+$/, "");

        while (zip.file(uniqueName)) {
          uniqueName = `${bName} (${dupCounter}).${bExt}`;
          dupCounter++;
        }

        // Add file binary blob into JSZip
        zip.file(uniqueName, file);
        setZipProgress(Math.round(((i + 1) / listTracks.length) * 90));
      }

      // Generate complete zip package
      const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        const val = 90 + Math.round(metadata.percent * 0.1);
        setZipProgress(val > 100 ? 100 : val);
      });

      // Browser trigger standard download link
      const url = URL.createObjectURL(content);
      const tempLink = document.createElement('a');
      tempLink.href = url;
      tempLink.download = `${name.trim().toLowerCase().replace(/\s+/g, '_')}_songs.zip`;
      tempLink.click();
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error('JSZip package packing error:', e);
      alert('Failed to pack tracks into a .zip file. Ensure local directory permission is granted.');
    } finally {
      setZipProgress(null);
      setZipActiveName('');
    }
  };

  const handleExportPlaylistZip = async (playlist: Playlist) => {
    const listTracks = tracks.filter((t) => playlist.trackIds.includes(t.id));
    await handleExportTracksToZip(playlist.name, listTracks);
  };

  const handleExportSingleSongZip = async (track: Track) => {
    await handleExportTracksToZip(track.title, [track]);
  };

  // --- CORE PLAYBACK DISPATCH HANDLERS ---
  const handlePlaySongDirect = (track: Track, tracksScope: Track[]) => {
    // 1. Compile Queue based on currently visible/active tab items
    let targetQueue = [...tracksScope];
    
    // Auto queue should contain a maximum of 50 upcoming songs at once
    if (isShuffle) {
      // Shuffled elements preserving first playing
      const items = targetQueue.filter((t) => t.id !== track.id);
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      targetQueue = [track, ...items].slice(0, 50);
    } else {
      const idx = targetQueue.findIndex((t) => t.id === track.id);
      if (idx !== -1) {
        // Start from clicked track, slice up to 50 entries to keep queue instant
        targetQueue = targetQueue.slice(idx, idx + 50);
      }
    }

    setQueue(targetQueue);
    setActiveQueueIndex(0);
    setCurrentTrack(track);

    audioEngine.playTrack(track).catch((err) => {
      alert(err.message || 'Error occurred starting audio execution.');
    });
  };

  const handleAddToQueue = (track: Track) => {
    setQueue((prev) => {
      if (prev.some((t) => t.id === track.id)) return prev;
      return [...prev, track];
    });
    // Notification hint
    alert(`Queued "${track.title}" successfully.`);
  };

  const handleGlobalPlayPause = () => {
    if (playbackState.isPlaying) {
      audioEngine.pause();
    } else {
      if (currentTrack) {
        audioEngine.play();
      } else if (tracks.length > 0) {
        // Fallback: Start first track in library
        handlePlaySongDirect(tracks[0], tracks);
      }
    }
  };

  const handleNextTrack = () => {
    let nextIdx = activeQueueIndex + 1;
    
    if (isRepeat && currentTrack) {
      // Seamlessly restart active song
      audioEngine.playTrack(currentTrack).catch(console.error);
      return;
    }

    if (nextIdx >= queue.length) {
      if (queue.length > 0) {
        // wrap around OR handle final pause
        nextIdx = 0;
      } else {
        return;
      }
    }

    const nextTrack = queue[nextIdx];
    if (nextTrack) {
      setActiveQueueIndex(nextIdx);
      setCurrentTrack(nextTrack);
      audioEngine.nextTrackByCrossfade(nextTrack).catch((e) => {
        console.error('Track transfer failed:, sliding to next element', e);
        handleNextTrack();
      });
    }
  };

  const handlePrevTrack = () => {
    let prevIdx = activeQueueIndex - 1;

    if (playbackState.currentTime > 5 && currentTrack) {
      audioEngine.seek(0);
      return;
    }

    if (prevIdx < 0) {
      if (queue.length > 0) {
        prevIdx = queue.length - 1;
      } else {
        return;
      }
    }

    const prevTrack = queue[prevIdx];
    if (prevTrack) {
      setActiveQueueIndex(prevIdx);
      setCurrentTrack(prevTrack);
      audioEngine.playTrack(prevTrack).catch((e) => {
        console.error('Previous track load error', e);
        handlePrevTrack();
      });
    }
  };

  const handleToggleLike = async (track: Track) => {
    const updatedTracks = tracks.map((t) => {
      if (t.id === track.id) {
        const u = { ...t, isLiked: !t.isLiked };
        musicDb.saveTrack(u);
        return u;
      }
      return t;
    });

    setTracks(updatedTracks);
    if (currentTrack?.id === track.id) {
      setCurrentTrack({ ...currentTrack, isLiked: !currentTrack.isLiked });
    }

    // Hot-update automated Liked Songs smart playlist representation
    setPlaylists((prev) => {
      return prev.map((pl) => {
        if (pl.id === 'smart_liked') {
          const wasLiked = pl.trackIds.includes(track.id);
          const trackIds = wasLiked
            ? pl.trackIds.filter((id) => id !== track.id)
            : [...pl.trackIds, track.id];
          return { ...pl, trackIds };
        }
        return pl;
      });
    });
  };

  const handleDeleteLibraryTrack = async (trackId: string) => {
    if (confirm('Are you sure you want to remove this track from your local player library? Original physical files will not be altered.')) {
      await musicDb.deleteTrack(trackId);
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
      if (currentTrack?.id === trackId) {
        audioEngine.stop();
        setCurrentTrack(null);
      }
    }
  };

  // --- CUSTOM METADATA CARD MODIFIER PANEL ---
  const handleSaveMetadataEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrack) return;

    const updatedTracks = tracks.map((t) => {
      if (t.id === editingTrack.id) {
        musicDb.saveTrack(editingTrack);
        return editingTrack;
      }
      return t;
    });

    setTracks(updatedTracks);
    if (currentTrack?.id === editingTrack.id) {
      setCurrentTrack(editingTrack);
    }
    setEditingTrack(null);
  };

  // --- FILTERED SELECTIONS FOR CENTRAL VIEWPORTS ---
  const filteredTracks = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();

    // 1. Tab limits
    let tabCollection = [...tracks];

    if (currentTab === 'smart_liked') {
      tabCollection = tracks.filter((t) => t.isLiked);
    } else if (currentTab === 'smart_added') {
      // Sort most recently modified tracks
      tabCollection = [...tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, 50);
    } else if (currentTab === 'smart_played') {
      tabCollection = tracks.filter((t) => (t.playCount || 0) > 0).sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0)).slice(0, 50);
    } else if (currentTab.startsWith('playlist_')) {
      const plId = currentTab.replace('playlist_', '');
      const activePlaylist = playlists.find((p) => p.id === plId);
      if (activePlaylist) {
        tabCollection = tracks.filter((t) => activePlaylist.trackIds.includes(t.id));
      } else {
        tabCollection = [];
      }
    }

    // 2. Extra Category scopes
    if (selectedAlbum) {
      tabCollection = tabCollection.filter((t) => t.album === selectedAlbum);
    }
    if (selectedArtist) {
      tabCollection = tabCollection.filter((t) => t.artist === selectedArtist);
    }
    if (selectedGenre) {
      tabCollection = tabCollection.filter((t) => t.genre === selectedGenre);
    }

    // 3. String Query Matcher
    let result = tabCollection;
    if (query) {
      result = tabCollection.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.artist.toLowerCase().includes(query) ||
          t.album.toLowerCase().includes(query) ||
          t.genre.toLowerCase().includes(query)
      );
    }

    // 4. Sort the result dynamically according to user specifications
    if (sortBy) {
      result.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }

        return 0;
      });
    }

    return result;
  }, [tracks, currentTab, searchTerm, playlists, selectedAlbum, selectedArtist, selectedGenre, sortBy, sortOrder]);

  // Unique listings for Albums and Artists grids
  const uniqueAlbums = useMemo(() => {
    const albumCollection = tracks.map((t) => t.album).filter((v, i, a) => a.indexOf(v) === i);
    return albumCollection.map((albumName) => {
      const firstWithAlbum = tracks.find((t) => t.album === albumName);
      return {
        name: albumName,
        artist: firstWithAlbum?.artist || 'Unknown Artist',
        artworkUrl: firstWithAlbum?.artworkUrl,
      };
    });
  }, [tracks]);

  const uniqueArtists = useMemo(() => {
    const artistCollection = tracks.map((t) => t.artist).filter((v, i, a) => a.indexOf(v) === i);
    return artistCollection.map((artistName) => {
      const firstWithArtist = tracks.find((t) => t.artist === artistName);
      return {
        name: artistName,
        genre: firstWithArtist?.genre || 'Various Genres',
        artworkUrl: firstWithArtist?.artworkUrl,
      };
    });
  }, [tracks]);

  const uniqueGenres = useMemo(() => {
    return tracks.map((t) => t.genre).filter((v, i, a) => a.indexOf(v) === i);
  }, [tracks]);

  // Clean local cache and IndexedDB state
  const handleClearLibraryData = async () => {
    if (confirm('Warning! This will clear all local metadata caching, custom playlists, and listening statistics. Connected local music folders are preservation secure.')) {
      await musicDb.clearAllTracks();
      setTracks([]);
      setHistory([]);
      setCurrentTrack(null);
      audioEngine.stop();
      alert('Local player library database wiped successfully.');
    }
  };

  const handleDropRootZone = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      handleManualFilesFallback(e.dataTransfer.files);
    }
  };

  const getBackgroundClass = () => {
    const t = settings.premiumTheme || 'classic';
    if (t === 'nebula') return 'bg-nebula text-zinc-100';
    if (t === 'sunset') return 'bg-sunset text-zinc-100';
    if (t === 'aurora') return 'bg-aurora text-zinc-100';
    if (t === 'matrix') return 'bg-matrix text-zinc-100';
    if (t === 'cyberpunk') return 'bg-cyberpunk text-zinc-100';
    if (t === 'nordic') return 'bg-nordic text-zinc-100';
    if (t === 'sakura') return 'bg-sakura text-zinc-100';
    if (t === 'crimson') return 'bg-crimson text-zinc-100';
    return 'frosted-main-bg text-zinc-100';
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDropRootZone}
      className={`relative w-full h-screen flex select-none font-sans overflow-hidden ${settings.theme} ${getBackgroundClass()}`}
      id="root-viewport-wrap"
    >
      {/* Background soft glowing blur spheres */}
      <div className="absolute inset-0 -z-50 pointer-events-none select-none overflow-hidden opacity-40">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[100px] pointer-events-none" />
        <div className={`absolute top-[35%] left-[20%] w-[380px] h-[380px] rounded-full blur-[130px] opacity-20 ambient-pulse ${customAccentBg}`} style={{ animationDuration: '10s' }} />
      </div>

      {/* Primary Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setSelectedAlbum(null);
          setSelectedArtist(null);
          setSelectedGenre(null);
          setCurrentTab(tab);
        }}
        playlists={playlists.filter((p) => !p.isSmart)}
        onAddPlaylist={handleAddPlaylist}
        onDeletePlaylist={handleDeletePlaylist}
        onPinPlaylist={handlePinPlaylist}
        onExportPlaylistZip={handleExportPlaylistZip}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        foldersCount={folders.length}
        onAddFolder={handleImportDirectory}
        isScanning={isScanning}
        onAuthorizeFolders={handleAuthorizeFolders}
      />

      {/* Main Center Dashboard Section */}
      <div className="flex-1 flex flex-col justify-between h-full relative" id="main-content-display-port">
        
        {/* Top Header Controls bar */}
        <header className="flex flex-col sm:flex-row items-center justify-between p-6 border-b border-white/[0.06] dark:border-white/[0.06] light:border-black/[0.06] bg-black/5 dark:bg-black/10 light:bg-white/10 backdrop-blur-md space-y-4 sm:space-y-0 z-10" id="header-top-panel">
          <div className="flex items-center space-x-4 w-full sm:w-auto" id="search-section-wrap">
            <div className="relative w-full sm:w-80" id="header-search-bar">
              <Search size={15} className={`absolute left-3.5 top-3.5 ${customAccentText}`} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tracks, albums, artists... (Ctrl+F)"
                className="w-full bg-white/5 text-xs py-3.5 pl-11 pr-4 rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 select-text text-neutral-200 dark:text-zinc-100 light:text-zinc-950 focus:outline-none focus:border-indigo-500/50 dark:focus:border-indigo-500/50 light:focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium placeholder-neutral-500"
                id="global-search-input-box"
              />
              <span className="absolute right-3.5 top-3.5 text-[9px] font-mono text-neutral-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 dark:border-white/10 light:border-black/10">
                Ctrl+F
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end" id="header-details-stats">
            {tracks.length > 0 && (
              <div className="bg-white/5 border border-white/10 dark:border-white/10 light:border-black/10 px-4.5 py-2 rounded-xl flex items-center space-x-2 backdrop-blur-md">
                <FolderSync size={13} className={isScanning ? 'animate-spin' : ''} />
                <span className="text-[10px] font-mono font-semibold tracking-wider text-neutral-400 dark:text-zinc-400 light:text-zinc-600">
                  {tracks.length} SONGS INDEXED
                </span>
              </div>
            )}
            
            {/* Quick manual select folder file trigger */}
            <label className="bg-white/5 border border-white/10 dark:border-white/10 light:border-black/10 rounded-xl px-4 py-2 hover:bg-white/10 light:hover:bg-black/5 transition flex items-center space-x-2 text-xs font-semibold text-neutral-300 dark:text-zinc-300 light:text-zinc-700 cursor-pointer">
              <Plus size={14} className={customAccentText} />
              <span>Import Audio Files</span>
              <input
                type="file"
                multiple
                accept="audio/*"
                onChange={(e) => e.target.files && handleManualFilesFallback(e.target.files)}
                className="hidden"
              />
            </label>
          </div>
        </header>

        {/* Central View Dashboard Page Content */}
        <main className="flex-1 overflow-y-auto no-scrollbar p-6" id="dashboard-center-viewport">
          
          {/* Breadcrumb row if deep category is open */}
          {(selectedAlbum || selectedArtist || selectedGenre) && (
            <div className="flex items-center space-x-2 mb-6" id="breadcrumb-navigation">
              <button
                onClick={() => {
                  setSelectedAlbum(null);
                  setSelectedArtist(null);
                  setSelectedGenre(null);
                }}
                className="text-xs text-neutral-400 hover:text-white transition font-medium"
              >
                {currentTab.charAt(0).toUpperCase() + currentTab.slice(1).replace('_', ' ')}
              </button>
              <ChevronRight size={12} className="text-neutral-500" />
              <span className="text-xs font-semibold text-white truncate max-w-xs">
                {selectedAlbum || selectedArtist || selectedGenre}
              </span>
            </div>
          )}

          {/* Tab Route 1: SONGS (LIST VIEW) */}
          {currentTab === 'songs' && !selectedAlbum && !selectedArtist && !selectedGenre && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h2 className="text-xl font-bold font-sans text-white">Full Library Tracks</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Physical files from indexed direct folders and files</p>
              </div>
              <TrackList
                tracks={filteredTracks}
                onPlayTrack={(track) => handlePlaySongDirect(track, filteredTracks)}
                onAddToQueue={handleAddToQueue}
                playlists={playlists.filter((p) => !p.isSmart)}
                onAddToPlaylist={handleAddTrackToPlaylist}
                onToggleLike={handleToggleLike}
                onDeleteTrack={handleDeleteLibraryTrack}
                onExportSingleZip={handleExportSingleSongZip}
                onOpenFileDirectory={handleOpenFileDirectory}
                accentColor={currentAccent}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            </div>
          )}

          {/* Deep Category tracks lists */}
          {(selectedAlbum || selectedArtist || selectedGenre) && (
            <div className="animate-fade-in space-y-6">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono font-bold block mb-1">
                  Categorized tracks
                </span>
                <h2 className="text-2xl font-black text-white leading-tight">
                  {selectedAlbum || selectedArtist || selectedGenre}
                </h2>
              </div>
              <TrackList
                tracks={filteredTracks}
                onPlayTrack={(track) => handlePlaySongDirect(track, filteredTracks)}
                onAddToQueue={handleAddToQueue}
                playlists={playlists.filter((p) => !p.isSmart)}
                onAddToPlaylist={handleAddTrackToPlaylist}
                onToggleLike={handleToggleLike}
                onExportSingleZip={handleExportSingleSongZip}
                onOpenFileDirectory={handleOpenFileDirectory}
                accentColor={currentAccent}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            </div>
          )}

          {/* Tab Route 2: ALBUMS (BENTO GRID REVIEW) */}
          {currentTab === 'albums' && !selectedAlbum && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Albums Collection</h2>
                <p className="text-xs text-neutral-400">Extracted from local song tags and artwork metadata</p>
              </div>

              {uniqueAlbums.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center h-[35vh]">
                  <Disc size={32} className="text-neutral-500 mb-2" />
                  <span className="text-xs text-neutral-400">No album groups indexed yet.</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5" id="albums-bento-grid">
                  {uniqueAlbums.map((album) => (
                    <div
                      key={album.name}
                      onClick={() => setSelectedAlbum(album.name)}
                      className="acrylic-card dark:acrylic-card light:acrylic-card-light hover:bg-white/[0.08] dark:hover:bg-white/[0.08] light:hover:bg-black/[0.04] p-4 rounded-2xl hover:scale-[1.02] transform transition-all cursor-pointer group flex flex-col justify-between"
                    >
                      <div className="aspect-square rounded-xl bg-neutral-800 border border-white/5 overflow-hidden flex items-center justify-center relative shadow-md">
                        {album.artworkUrl ? (
                          <img src={album.artworkUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Music size={40} className="text-neutral-500 group-hover:scale-110 transition-transform duration-500" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className={`p-3 rounded-full text-black shadow ${customAccentBg}`}>
                            <Play size={16} fill="currentColor" strokeWidth={0} />
                          </div>
                        </div>
                      </div>
                      <div className="mt-3.5 min-w-0">
                        <span className="block text-xs font-bold text-neutral-200 truncate group-hover:text-white transition-colors">
                          {album.name}
                        </span>
                        <span className="block text-[10.5px] text-neutral-400 truncate mt-0.5">
                          {album.artist}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Route 3: ARTISTS */}
          {currentTab === 'artists' && !selectedArtist && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Artists Portfolio</h2>
                <p className="text-xs text-neutral-400">Identified from file metadata headers</p>
              </div>

              {uniqueArtists.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center h-[35vh]">
                  <User size={32} className="text-neutral-500 mb-2" />
                  <span className="text-xs text-neutral-400">No artist profiles indexed yet.</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5" id="artists-bento-grid">
                  {uniqueArtists.map((artist) => (
                    <div
                      key={artist.name}
                      onClick={() => setSelectedArtist(artist.name)}
                      className="acrylic-card dark:acrylic-card light:acrylic-card-light hover:bg-white/[0.08] dark:hover:bg-white/[0.08] light:hover:bg-black/[0.04] p-4 rounded-2xl hover:scale-[1.02] transform transition-all cursor-pointer group flex flex-col items-center text-center"
                    >
                      <div className="w-24 h-24 rounded-full bg-neutral-850 border border-white/5 overflow-hidden flex items-center justify-center relative shadow-lg">
                        {artist.artworkUrl ? (
                          <img src={artist.artworkUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className={`text-xl font-black uppercase text-neutral-400 group-hover:scale-110 transition-transform`}>
                            {artist.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="mt-4 min-w-0 w-full">
                        <span className="block text-xs font-bold text-neutral-200 truncate group-hover:text-white">
                          {artist.name}
                        </span>
                        <span className="block text-[10px] text-neutral-400 mt-1 uppercase tracking-wider font-mono">
                          {artist.genre}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Route 4: GENRES */}
          {currentTab === 'genres' && !selectedGenre && (
            <div className="animate-fade-in space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Genres Spectrum</h2>
                <p className="text-xs text-neutral-400">Classified sound spectrum structures</p>
              </div>

              {uniqueGenres.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center h-[35vh]">
                  <Tags size={32} className="text-neutral-500 mb-2" />
                  <span className="text-xs text-neutral-400">No genres found.</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" id="genres-bento-grid">
                  {uniqueGenres.map((genre) => (
                    <div
                      key={genre}
                      onClick={() => setSelectedGenre(genre)}
                      className="acrylic-card dark:acrylic-card light:acrylic-card-light hover:bg-white/[0.08] dark:hover:bg-white/[0.08] light:hover:bg-black/[0.04] p-5 rounded-2xl hover:scale-[1.02] transform transition-all cursor-pointer group flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-xl bg-sky-500 bg-opacity-10 text-sky-400`}>
                          <Tags size={14} />
                        </div>
                        <span className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
                          {genre}
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-neutral-500 group-hover:translate-x-1 transition-transform" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab Route 5: STATS */}
          {currentTab === 'stats' && (
            <div className="animate-fade-in">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white">Listening Insights</h2>
                <p className="text-xs text-neutral-400">Chronological listening, peak hours and artist ratios</p>
              </div>
              <StatsView
                tracks={tracks}
                history={history}
                onPlayTrack={(track) => handlePlaySongDirect(track, tracks)}
                accentColor={currentAccent}
              />
            </div>
          )}

          {/* Tab Route 6: SMART PLAYLISTS */}
          {currentTab.startsWith('smart_') && !selectedAlbum && !selectedArtist && !selectedGenre && (
            <div className="animate-fade-in space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4" id="smart-playlist-header-panel">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono font-bold block mb-1">
                    Smart Automated Mix
                  </span>
                  <h2 className="text-2xl font-black text-white">
                    {currentTab === 'smart_liked' ? 'Liked Songs' : currentTab === 'smart_added' ? 'Recently Added' : 'Recently Played'}
                  </h2>
                </div>

                <button
                  onClick={() => {
                    const activeName = currentTab === 'smart_liked' ? 'Liked Songs' : currentTab === 'smart_added' ? 'Recently Added' : 'Recently Played';
                    handleExportTracksToZip(activeName, filteredTracks);
                  }}
                  className={`py-2 px-4 rounded-xl border border-white/5 text-xs font-semibold hover:bg-neutral-850 flex items-center space-x-2 text-neutral-300`}
                  title="Export all tracks in this automated collection to ZIP"
                  id="smart-playlist-export-zip-btn"
                >
                  <Download size={14} />
                  <span>Export List to ZIP</span>
                </button>
              </div>

              <TrackList
                tracks={filteredTracks}
                onPlayTrack={(track) => handlePlaySongDirect(track, filteredTracks)}
                onAddToQueue={handleAddToQueue}
                playlists={playlists.filter((p) => !p.isSmart)}
                onAddToPlaylist={handleAddTrackToPlaylist}
                onToggleLike={handleToggleLike}
                onExportSingleZip={handleExportSingleSongZip}
                onOpenFileDirectory={handleOpenFileDirectory}
                accentColor={currentAccent}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            </div>
          )}

          {/* Tab Route 7: CUSTOM PLAYLIST */}
          {currentTab.startsWith('playlist_') && !selectedAlbum && !selectedArtist && !selectedGenre && (
            <div className="animate-fade-in space-y-6">
              {(() => {
                const plId = currentTab.replace('playlist_', '');
                const activePlaylist = playlists.find((p) => p.id === plId);
                if (!activePlaylist) return null;
                return (
                  <>
                    <div className="flex items-center justify-between flex-wrap gap-4" id="custom-playlist-header-panel">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono font-bold block mb-1">
                          Custom User Playlist
                        </span>
                        <h2 className="text-2xl font-black text-white">{activePlaylist.name}</h2>
                        {activePlaylist.description && (
                          <p className="text-xs text-neutral-400 mt-1">{activePlaylist.description}</p>
                        )}
                      </div>

                      <button
                        onClick={() => handleExportPlaylistZip(activePlaylist)}
                        className={`py-2 px-4 rounded-xl border border-white/5 text-xs font-semibold hover:bg-neutral-850 flex items-center space-x-2 text-neutral-300`}
                        id="playlist-export-zip-btn"
                      >
                        <Download size={14} />
                        <span>Export Playlist to ZIP</span>
                      </button>
                    </div>

                    <TrackList
                      tracks={filteredTracks}
                      onPlayTrack={(track) => handlePlaySongDirect(track, filteredTracks)}
                      onAddToQueue={handleAddToQueue}
                      playlists={playlists.filter((p) => p.id !== plId)}
                      onAddToPlaylist={handleAddTrackToPlaylist}
                      onToggleLike={handleToggleLike}
                      onExportSingleZip={handleExportSingleSongZip}
                      onOpenFileDirectory={handleOpenFileDirectory}
                      accentColor={currentAccent}
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </>
                );
              })()}
            </div>
          )}

          {/* Tab Route 8: AUDIO EQUALIZER SETTINGS */}
          {currentTab === 'settings' && (
            <div className="animate-fade-in">
              <AudioSettingsPanel
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                foldersCount={folders.length}
                onRescan={async () => {
                  alert('Background sync initiated recursively for connected folders.');
                }}
                isScanning={isScanning}
                onClearLibrary={handleClearLibraryData}
              />
            </div>
          )}

          {/* Onboarding Empty state view */}
          {tracks.length === 0 && !isScanning && (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-6 animate-fade-in" id="empty-state-welcome-panel">
              <div className={`p-5 rounded-2xl ${customAccentBg} bg-opacity-10 ${customAccentText} shadow-md`}>
                <FolderOpen size={40} className="mx-auto animate-bounce" />
              </div>

              <div>
                <h3 className="text-xl font-bold font-sans text-white">Connect Local Music</h3>
                <p className="text-xs text-neutral-400 leading-relaxed mt-2" id="drag-drop-explanation">
                  Drag and drop local MP3, FLAC, WAV audio files anywhere onto the player, or import directories recursively.
                </p>
              </div>

              <div className="w-full space-y-3 pt-2">
                <button
                  onClick={handleImportDirectory}
                  className={`w-full py-3.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition cursor-pointer select-none bg-neutral-900 border border-white/10 text-white hover:bg-neutral-800`}
                  id="empty-state-recursive-scanner"
                >
                  <FolderOpen size={14} />
                  <span>Recursively Scan Folder</span>
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Bottom Playback bar now-playing controls */}
        {currentTrack && (
          <footer
            className={`h-24 border-t px-6 flex items-center justify-between select-none transition-all animate-slide-up-fade-in ${
              settings.theme === 'dark'
                ? 'bg-black/60 border-white/[0.06] backdrop-blur-3xl text-zinc-100'
                : 'bg-white/60 border-black/[0.06] backdrop-blur-3xl text-zinc-950 border-t'
            }`}
            id="bottom-playback-dock"
          >
            {/* Left Track Info */}
            <div className="flex items-center space-x-3 w-auto sm:w-1/4 sm:min-w-[180px] min-w-0 flex-shrink" id="bottom-dock-track-info" onClick={() => setIsFullscreenMode(true)}>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-neutral-850 border border-white/5 overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer shadow">
                {currentTrack.artworkUrl ? (
                  <img src={currentTrack.artworkUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Music size={16} className="text-neutral-500 animate-pulse" />
                )}
              </div>
              <div className="min-w-0 cursor-pointer">
                <span className="block text-xs font-semibold text-white hover:underline truncate max-w-[110px] sm:max-w-none" id="dock-title-label">
                  {currentTrack.title}
                </span>
                <span className="block text-[10.5px] text-neutral-400 truncate mt-0.5 max-w-[110px] sm:max-w-none">
                  {currentTrack.artist}
                </span>
              </div>
            </div>

            {/* Mid Play/Pause, Shuffle, Seek timeline */}
            <div className="flex-1 max-w-xl flex flex-col items-center justify-center space-y-2.5 px-2" id="bottom-dock-mid-controls">
              {/* Core quick trigger panel */}
              <div className="flex items-center space-x-4 sm:space-x-6">
                <button
                  onClick={() => setIsShuffle(!isShuffle)}
                  className={`transition hover:scale-105 ${
                    isShuffle ? `${customAccentText}` : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                  title="Shuffle visible collection"
                  id="dock-shuffle-btn"
                >
                  <Shuffle size={14} />
                </button>

                <button
                  onClick={handlePrevTrack}
                  className="text-neutral-400 hover:text-white transition hover:scale-105 active:scale-95 transform"
                  id="dock-prev-btn"
                >
                  <SkipBack size={16} />
                </button>

                <button
                  onClick={handleGlobalPlayPause}
                  className={`p-2.5 sm:p-3.5 rounded-full text-black hover:scale-105 active:scale-95 transition transform flex items-center justify-center ${customAccentBg}`}
                  id="dock-play-pause-btn"
                >
                  {playbackState.isPlaying ? (
                    <Pause size={15} fill="currentColor" strokeWidth={0} />
                  ) : (
                    <Play size={15} fill="currentColor" strokeWidth={0} className="translate-x-0.5" />
                  )}
                </button>

                <button
                  onClick={handleNextTrack}
                  className="text-neutral-400 hover:text-white transition hover:scale-105 active:scale-95 transform"
                  id="dock-next-btn"
                >
                  <SkipForward size={16} />
                </button>

                <button
                  onClick={() => setIsRepeat(!isRepeat)}
                  className={`transition hover:scale-105 ${
                    isRepeat ? `${customAccentText}` : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                  title="Repeat current"
                  id="dock-repeat-btn"
                >
                  <Repeat size={14} />
                </button>
              </div>

              {/* Slider Seek layout */}
              <div className="w-full flex items-center space-x-2.5 text-[10px] sm:text-[10.5px] font-mono text-neutral-400" id="dock-seek-row">
                <span>
                  {Math.floor(playbackState.currentTime / 60)}:
                  {Math.floor(playbackState.currentTime % 60) < 10 ? '0' : ''}
                  {Math.floor(playbackState.currentTime % 60)}
                </span>

                <div className="flex-1 relative h-1 bg-neutral-800 rounded-full group cursor-pointer">
                  <input
                    type="range"
                    min="0"
                    max={playbackState.duration || 100}
                    value={playbackState.currentTime}
                    onChange={(e) => audioEngine.seek(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    id="dock-seek-slider"
                  />
                  <div
                    style={{ width: `${playbackState.duration > 0 ? (playbackState.currentTime / playbackState.duration) * 100 : 0}%` }}
                    className={`absolute top-0 left-0 h-full rounded-full transition-all group-hover:brightness-110 ${customAccentBg}`}
                  />
                </div>

                <span>
                  {Math.floor(playbackState.duration / 60)}:
                  {Math.floor(playbackState.duration % 60) < 10 ? '0' : ''}
                  {Math.floor(playbackState.duration % 60)}
                </span>
              </div>
            </div>

            {/* Right volume controls and panel togglers */}
            <div className="w-auto sm:w-1/4 sm:min-w-[140px] flex items-center justify-end space-x-2 sm:space-x-4 flex-shrink-0" id="bottom-dock-right-controls">
              {/* Volume */}
              <div className="hidden md:flex items-center space-x-2">
                <button
                  onClick={() => audioEngine.setVolume(playbackState.volume > 0 ? 0 : 0.8)}
                  className="text-neutral-400 hover:text-white transition"
                  id="dock-mute-btn"
                >
                  {playbackState.volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={playbackState.volume}
                  onChange={(e) => audioEngine.setVolume(parseFloat(e.target.value))}
                  className="w-20 accent-emerald-500 h-1 bg-neutral-800 rounded-lg outline-none appearance-none cursor-pointer"
                  id="dock-volume-slider"
                />
              </div>

              {/* Immersive Trigger toggler */}
              <button
                onClick={() => setIsFullscreenMode(true)}
                className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition"
                title="Immersive Player"
                id="dock-immersive-widget-trigger"
              >
                <ChevronRight size={17} className="rotate-270" />
              </button>

              {/* Mini Player widget toggler */}
              <button
                onClick={() => setIsMiniMode(true)}
                className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition text-xs font-mono"
                title="Toggle Miniplayer Widget"
                id="dock-miniplayer-trigger"
              >
                Mini
              </button>
            </div>
          </footer>
        )}

      </div>

      {/* OVERLAY PANEL A: Immersive Fullscreen Player */}
      {isFullscreenMode && currentTrack && (
        <FullscreenPlayer
          track={currentTrack}
          isPlaying={playbackState.isPlaying}
          currentTime={playbackState.currentTime}
          duration={playbackState.duration}
          volume={playbackState.volume}
          onPlayPause={handleGlobalPlayPause}
          onNext={handleNextTrack}
          onPrevious={handlePrevTrack}
          onSeek={(secs) => audioEngine.seek(secs)}
          onVolumeChange={(vol) => audioEngine.setVolume(vol)}
          onToggleFullscreen={() => setIsFullscreenMode(false)}
          isShuffle={isShuffle}
          onToggleShuffle={() => setIsShuffle(!isShuffle)}
          isRepeat={isRepeat}
          onToggleRepeat={() => setIsRepeat(!isRepeat)}
          accentColor={currentAccent}
        />
      )}

      {/* OVERLAY PANEL B: Mini Floating Widget player */}
      {isMiniMode && currentTrack && (
        <MiniPlayer
          track={currentTrack}
          isPlaying={playbackState.isPlaying}
          currentTime={playbackState.currentTime}
          duration={playbackState.duration}
          onPlayPause={handleGlobalPlayPause}
          onNext={handleNextTrack}
          onPrevious={handlePrevTrack}
          onRestore={() => {
            setIsMiniMode(false);
            setIsFullscreenMode(true);
          }}
          onCloseMini={() => setIsMiniMode(false)}
          accentColor={currentAccent}
        />
      )}

      {/* ZIP Archive progress status bar visual indicator */}
      {zipProgress !== null && (
        <div className="fixed inset-0 bg-neutral-950/85 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in" id="zip-progress-modal">
          <div className="bg-neutral-900 border border-white/5 p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl">
            <div className="text-center">
              <Download className="mx-auto text-emerald-400 mb-2 animate-bounce" size={32} />
              <h4 className="font-bold text-white uppercase text-xs tracking-wider font-mono">Compiling ZIP Package</h4>
              <p className="text-[11px] text-neutral-400 mt-1 truncate">
                Packing songs from <b>{zipActiveName}</b> offline...
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
                <div style={{ width: `${zipProgress}%` }} className="h-full bg-emerald-500 transition-all rounded-full" />
              </div>
              <div className="flex justify-between items-center text-[10px] text-neutral-500 font-mono">
                <span>Progress</span>
                <span>{zipProgress}%</span>
              </div>
            </div>

            <div className="py-2.5 bg-white/5 rounded-xl px-4 flex items-center space-x-2 text-[10px] text-neutral-400 font-mono border border-white/5">
              <AlertCircle size={13} className="text-emerald-400 flex-shrink-0" />
              <span>Deduplicating filenames and consolidating. Done shortly.</span>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY PANEL C: Folder Directory Locator Modal representation */}
      {locatingTrack && (
        <div className="fixed inset-0 bg-neutral-950/80 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fade-in" id="folder-directory-locator-modal">
          <div className="bg-neutral-900 border border-white/10 p-6 rounded-2xl w-full max-w-lg space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center space-x-2">
                <FolderOpen size={18} className="text-amber-500 animate-pulse" />
                <div>
                  <h4 className="font-bold text-white text-xs font-sans uppercase tracking-wider">Container Folder Explorer</h4>
                  <p className="text-[10px] text-neutral-400 font-mono mt-0.5">Directory contents mapping offline tracks</p>
                </div>
              </div>
              <button
                onClick={() => setLocatingTrack(null)}
                className="text-neutral-550 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-neutral-950/50 p-3 rounded-xl border border-white/5 flex items-center space-x-3">
              <div className="p-2 bg-neutral-900 rounded-lg text-emerald-400">
                <Music size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-white truncate">{locatingTrack.title}</span>
                <span className="block text-[10px] text-neutral-400 truncate">File Path/Name: {locatingTrack.fileName}</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Selected Target</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 py-1 pr-1" style={{ maxHeight: '350px' }}>
              <div className="text-[9.5px] font-bold uppercase tracking-widest text-neutral-500 font-mono mb-2">Folder Files ({locatingFolderFiles.length})</div>
              {isLocatingScanActive ? (
                <div className="text-center py-8 text-xs text-neutral-500 font-mono">
                  Scanning directory contents...
                </div>
              ) : locatingFolderFiles.length === 0 ? (
                <div className="text-center py-8 text-xs text-neutral-400 bg-neutral-950 rounded-xl border border-dashed border-white/5 p-4">
                  ⚠️ No synchronized folder files detected or permission requested. Grant directory approval using the "Grant Permission" sidebar tool.
                </div>
              ) : (
                locatingFolderFiles.map((fn, idx) => {
                  const isCurrent = fn === locatingTrack.fileName;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between py-2 px-3 rounded-lg border text-xs font-mono transition ${
                        isCurrent
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-white'
                          : 'bg-neutral-950/20 border-white/5 text-neutral-400 hover:text-white hover:bg-neutral-950/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className="text-[10px] text-neutral-600 font-bold">{idx + 1}</span>
                        <div className={`p-1 rounded ${isCurrent ? 'bg-emerald-500/10 text-emerald-400' : 'bg-neutral-800 text-neutral-500'}`}>
                          <Music size={11} />
                        </div>
                        <span className="truncate pr-4">{fn}</span>
                      </div>
                      {isCurrent && (
                        <span className="text-[8.5px] font-bold bg-emerald-500/25 px-1.5 py-0.5 rounded uppercase tracking-wider text-emerald-300">Target</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <span className="text-[9px] text-neutral-500 font-mono">Preserving safe sandbox offline isolation.</span>
              <button
                onClick={() => setLocatingTrack(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition"
              >
                Close Explorer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
