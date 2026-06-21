import { Track, Playlist, PlayHistoryEntry, AppSettings } from '../types';

class MusicDB {
  private dbName = 'local_music_player_db';
  private dbVersion = 3;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // Upgrade/creation of object stores
        if (!db.objectStoreNames.contains('tracks')) {
          db.createObjectStore('tracks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('history')) {
          db.createObjectStore('history', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('folders')) {
          db.createObjectStore('folders', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
        this.dbPromise = null;
      };
    });

    return this.dbPromise;
  }

  // --- TRACKS API ---
  async getAllTracks(): Promise<Track[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('tracks', 'readonly');
      const store = transaction.objectStore('tracks');
      const request = store.getAll();
      request.onsuccess = () => {
        const tracks = request.result || [];
        tracks.forEach((track: Track) => {
          if (track.artworkBlob) {
            try {
              track.artworkUrl = URL.createObjectURL(track.artworkBlob);
            } catch (e) {
              console.warn('Failed to regenerate artwork URL from blob:', e);
            }
          }
        });
        resolve(tracks);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveTracks(tracks: Track[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('tracks', 'readwrite');
      const store = transaction.objectStore('tracks');
      
      // Clear or overwrite
      tracks.forEach(track => {
        // Strip temporary fields before saving
        const savedTrack = { ...track };
        delete savedTrack.artworkUrl;
        delete savedTrack.rawFile;
        store.put(savedTrack);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async saveTrack(track: Track): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('tracks', 'readwrite');
      const store = transaction.objectStore('tracks');
      const savedTrack = { ...track };
      delete savedTrack.artworkUrl;
      delete savedTrack.rawFile;
      const request = store.put(savedTrack);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTrack(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('tracks', 'readwrite');
      const store = transaction.objectStore('tracks');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllTracks(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('tracks', 'readwrite');
      const store = transaction.objectStore('tracks');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- PLAYLISTS API ---
  async getAllPlaylists(): Promise<Playlist[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('playlists', 'readonly');
      const store = transaction.objectStore('playlists');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async savePlaylist(playlist: Playlist): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('playlists', 'readwrite');
      const store = transaction.objectStore('playlists');
      const request = store.put(playlist);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deletePlaylist(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('playlists', 'readwrite');
      const store = transaction.objectStore('playlists');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- HISTORY API ---
  async getHistory(): Promise<PlayHistoryEntry[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('history', 'readonly');
      const store = transaction.objectStore('history');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async addHistoryEntry(entry: PlayHistoryEntry): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('history', 'readwrite');
      const store = transaction.objectStore('history');
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- FOLDERS API ---
  async getFolders(): Promise<{ id: string; handle: FileSystemDirectoryHandle; name: string }[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('folders', 'readonly');
      const store = transaction.objectStore('folders');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveFolder(id: string, handle: FileSystemDirectoryHandle, name: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('folders', 'readwrite');
      const store = transaction.objectStore('folders');
      const request = store.put({ id, handle, name });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async removeFolder(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('folders', 'readwrite');
      const store = transaction.objectStore('folders');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- SETTINGS API ---
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const db = await this.getDB();
    return new Promise((resolve) => {
      const transaction = db.transaction('settings', 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(request.result !== undefined ? request.result as T : defaultValue);
      };
      request.onerror = () => resolve(defaultValue);
    });
  }

  async saveSetting(key: string, value: any): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const musicDb = new MusicDB();
