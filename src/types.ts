export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number; // in seconds
  fileName: string;
  fileSize: number;
  addedAt: number;
  playCount: number;
  lastPlayedAt?: number;
  isLiked?: boolean;
  artworkUrl?: string; // Cache URL
  artworkBlob?: Blob; // Dynamic blob cache
  fileHandle?: FileSystemFileHandle; // Optional for active FS Access APIs
  rawFile?: File | Blob; // For drag and dropped files
  filePath?: string; // For native Electron desktop mode
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  isPinned: boolean;
  isSmart: boolean;
  smartRules?: {
    type: 'most-played' | 'liked' | 'recently-added' | 'recently-played' | 'genre' | 'artist';
    value?: string;
  };
  createdAt: number;
}

export interface PlayHistoryEntry {
  id: string;
  trackId: string;
  playedAt: number;
  listenDuration: number;
  completed: boolean;
}

export interface EqualizerPreset {
  name: string;
  gains: number[]; // 10 values, range [-12, 12] dB
}

export interface AppSettings {
  theme: 'dark' | 'light';
  accentColor: string; // Tailwind class color: e.g., 'emerald', 'sky', 'rose', 'violet', 'amber'
  crossfadeDuration: number; // 0 to 10 seconds
  equalizerEnabled: boolean;
  equalizerGains: number[]; // 10 values for 10 bands
  volume: number; // 0 to 1
  playbackSpeed: number; // 0.5 to 2.0
  replayGainNormalized: boolean;
  premiumTheme?: string; // 'classic' | 'nebula' | 'sunset' | 'matrix' | 'aurora'
  directPlaybackMode: boolean; // true to bypass Web Audio for extreme reliability, false to use Web Audio
}

export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]; // 10 frequencies

export const PRESETS: EqualizerPreset[] = [
  { name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Bass Booster', gains: [5, 4, 3, 2, 0, 0, 0, 0, 0, 0] },
  { name: 'Vocal Booster', gains: [-2, -1, 0, 1, 3, 4, 4, 3, 1, 0] },
  { name: 'Electronic', gains: [4, 3, 1, 0, -1, 2, 1, 0, 3, 4] },
  { name: 'Rock', gains: [3, 2, -1, -2, -1, 1, 2, 3, 3, 3] },
  { name: 'Jazz', gains: [2, 1, 1, 2, -1, -1, 0, 1, 2, 3] },
  { name: 'Classical', gains: [3, 2, 1, 1, -1, -1, 0, 2, 2, 3] },
  { name: 'Pop', gains: [-1, -1, 0, 2, 4, 4, 1, -1, -1, -1] }
];

declare global {
  interface Window {
    electron?: {
      isElectron: boolean;
      chooseDirectory: () => Promise<string | null>;
      scanDirectory: (dirPath: string) => Promise<{ name: string; path: string; size: number; mtime: number }[]>;
      getFileMetadataChunk: (filePath: string) => Promise<{ name: string; size: number; mtime: number; buffer: Uint8Array }>;
      readFileAsArrayBuffer: (filePath: string) => Promise<Uint8Array>;
      showItemInFolder: (filePath: string) => Promise<boolean>;
      openPath: (dirPath: string) => Promise<boolean>;
      saveZipDialog: (defaultName: string) => Promise<string | null>;
      writeFile: (filePath: string, arrayBuffer: ArrayBuffer) => Promise<boolean>;
    };
  }
}

