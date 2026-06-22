import { Track, EQ_BANDS } from '../types';

export interface AudioEngineState {
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  volume: number;
  playbackSpeed: number;
  currentTrackId?: string;
  nextTrackId?: string;
}

export type PlaybackStateListener = (state: AudioEngineState) => void;
export type QualificationListener = (trackId: string, duration: number) => void;

class AudioEngine {
  // We use two audio elements for crossfading and gapless transitions
  private playerA!: HTMLAudioElement;
  private playerB!: HTMLAudioElement;
  private activePlayer: 'A' | 'B' = 'A';

  // Robust bypass toggle - if true, Web Audio Context EQ and Analyser are enabled.
  // If false (default), plays direct via HTML5 Audio, which is 100% immune to iframe/CORS constraints.
  private useWebAudio: boolean = false;

  // Web Audio Nodes
  private ctx: AudioContext | null = null;
  private sourceA: MediaElementAudioSourceNode | null = null;
  private sourceB: MediaElementAudioSourceNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private gainA: GainNode | null = null;
  private gainB: GainNode | null = null;
  private masterGain: GainNode | null = null;
  public analyser: AnalyserNode | null = null;

  // Track pointers to objects
  private trackA: Track | null = null;
  private trackB: Track | null = null;
  private objectUrlA: string | null = null;
  private objectUrlB: string | null = null;

  // Settings
  private volume: number = 0.8;
  private speed: number = 1.0;
  private crossfadeDuration: number = 0; // 0 means gapless immediate transition
  private equalizerEnabled: boolean = false;
  private equalizerGains: number[] = Array(10).fill(0);

  // Stats / Listen Logic trackers
  private activePlayStart: number = 0;
  private activeSecondsPlayed: number = 0;
  private activeTrackId: string | null = null;
  private playCountQualified: boolean = false;
  private lastTimeUpdate: number = 0;

  // Change Notifications
  private stateListeners: Set<PlaybackStateListener> = new Set();
  private onPlayQualifiedListeners: Set<QualificationListener> = new Set();
  private onTrackEndedListeners: Set<() => void> = new Set();

  constructor() {
    this.recreatePlayers();
  }

  public getUseWebAudio(): boolean {
    return this.useWebAudio;
  }

  public setUseWebAudio(enabled: boolean) {
    if (this.useWebAudio === enabled) return;

    // Stop current playbacks completely before tearing down nodes
    this.stop();

    this.useWebAudio = enabled;

    // Tear down any existing AudioContext when switching to direct
    if (!enabled) {
      if (this.ctx) {
        this.ctx.close().catch(console.error);
        this.ctx = null;
      }
      this.sourceA = null;
      this.sourceB = null;
      this.gainA = null;
      this.gainB = null;
      this.masterGain = null;
      this.analyser = null;
      this.eqFilters = [];
    }

    // We MUST recreate HTMLAudioElement instances so they are disconnected
    // from any previous Web Audio nodes in browser's memory.
    this.recreatePlayers();
  }

  private recreatePlayers() {
    try {
      if (this.playerA) {
        this.playerA.pause();
        this.playerA.src = '';
      }
      if (this.playerB) {
        this.playerB.pause();
        this.playerB.src = '';
      }
    } catch (e) {
      console.warn('Error clearing old players:', e);
    }

    this.playerA = new Audio();
    this.playerB = new Audio();

    // Standard media settings preloading
    this.playerA.preload = 'auto';
    this.playerB.preload = 'auto';

    // REMOVED crossOrigin = 'anonymous' as same-origin blobs can get blocked by CORS queries in sandboxed iframes
    
    this.playerA.volume = this.volume;
    this.playerB.volume = this.activePlayer === 'B' ? 0 : this.volume;
    this.playerA.playbackRate = this.speed;
    this.playerB.playbackRate = this.speed;

    this.setupAudioListeners(this.playerA, 'A');
    this.setupAudioListeners(this.playerB, 'B');
  }

  private initCtx() {
    if (!this.useWebAudio || this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

      this.gainA = this.ctx.createGain();
      this.gainB = this.ctx.createGain();
      this.gainA.gain.setValueAtTime(1, this.ctx.currentTime);
      this.gainB.gain.setValueAtTime(0, this.ctx.currentTime);

      // Create Equalizer Filters (10-band)
      this.eqFilters = EQ_BANDS.map((frequency) => {
        const filter = this.ctx!.createBiquadFilter();
        // Lowest is lowshelf, highest is highshelf, middle are peaking
        if (frequency === EQ_BANDS[0]) {
          filter.type = 'lowshelf';
        } else if (frequency === EQ_BANDS[EQ_BANDS.length - 1]) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
        }
        filter.frequency.value = frequency;
        filter.Q.value = 1.0;
        filter.gain.value = this.equalizerEnabled ? this.equalizerGains[EQ_BANDS.indexOf(frequency)] : 0;
        return filter;
      });

      // Assemble Chain Player A
      this.sourceA = this.ctx.createMediaElementSource(this.playerA);
      this.sourceA.connect(this.gainA);

      // Assemble Chain Player B
      this.sourceB = this.ctx.createMediaElementSource(this.playerB);
      this.sourceB.connect(this.gainB);

      // EQ chain assembling
      let lastNode: AudioNode = this.masterGain;
      if (this.eqFilters.length > 0) {
        this.gainA.connect(this.eqFilters[0]);
        this.gainB.connect(this.eqFilters[0]);

        for (let i = 0; i < this.eqFilters.length - 1; i++) {
          this.eqFilters[i].connect(this.eqFilters[i + 1]);
        }
        this.eqFilters[this.eqFilters.length - 1].connect(this.masterGain);
      } else {
        this.gainA.connect(this.masterGain);
        this.gainB.connect(this.masterGain);
      }

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    } catch (e) {
      console.error('Failed to initialize AudioContext, falling back to simple media rendering:', e);
      this.useWebAudio = false; // Fallback to direct HTML5 instantly
    }
  }

  private setupAudioListeners(player: HTMLAudioElement, tag: 'A' | 'B') {
    player.addEventListener('play', () => {
      if (this.activePlayer === tag) {
        this.initPlaySecondsTracking();
        this.notifyState();
      }
    });

    player.addEventListener('pause', () => {
      if (this.activePlayer === tag) {
        this.pauseTracking();
        this.notifyState();
      }
    });

    player.addEventListener('timeupdate', () => {
      if (this.activePlayer === tag) {
        this.updateSecondsProgress(player.currentTime);
        this.notifyState();
        this.checkCrossfadeTrigger(player);
      }
    });

    player.addEventListener('ended', () => {
      if (this.activePlayer === tag) {
        this.handlePlayerEnded(tag);
      }
    });

    player.addEventListener('volumechange', () => {
      this.notifyState();
    });

    player.addEventListener('error', (e) => {
      console.error(`Audio element ${tag} reported error:`, player.error);
      if (this.activePlayer === tag) {
        this.pauseTracking();
        // Skip track automatically on decode/CORS/file reading failures
        setTimeout(() => {
          this.handlePlayerEnded(tag);
        }, 1500);
      }
    });
  }

  // --- STATS LOGIC: qualifying a play only if listened for 30s ---
  private initPlaySecondsTracking() {
    this.activePlayStart = Date.now();
    this.lastTimeUpdate = Date.now();
    
    const currTrackId = this.getCurrentTrack()?.id;
    if (currTrackId !== this.activeTrackId) {
      this.activeTrackId = currTrackId || null;
      this.activeSecondsPlayed = 0;
      this.playCountQualified = false;
    }
  }

  private pauseTracking() {
    if (this.activeTrackId) {
      const now = Date.now();
      const delta = (now - this.lastTimeUpdate) / 1000;
      // Cap delta logic just in case browser suspended
      if (delta > 0 && delta < 5) {
        this.activeSecondsPlayed += delta;
      }
      this.lastTimeUpdate = now;
      this.checkPlayCountQualification();
    }
  }

  private updateSecondsProgress(currTime: number) {
    if (this.activeTrackId) {
      const now = Date.now();
      const delta = (now - this.lastTimeUpdate) / 1000;
      if (delta > 0 && delta < 5) {
        this.activeSecondsPlayed += delta;
      }
      this.lastTimeUpdate = now;
      this.checkPlayCountQualification();
    }
  }

  private checkPlayCountQualification() {
    if (this.playCountQualified || !this.activeTrackId) return;

    // Qualify play if accumulated active listen duration hits 30 seconds OR completes 90% of a short track
    const currentTrack = this.getCurrentTrack();
    const durationThreshold = currentTrack ? Math.min(30, currentTrack.duration * 0.9) : 30;

    if (this.activeSecondsPlayed >= durationThreshold) {
      this.playCountQualified = true;
      this.onPlayQualifiedListeners.forEach((listener) => {
        listener(this.activeTrackId!, currentTrack?.duration || 0);
      });
    }
  }

  // --- CROSSFADE LOGIC ---
  private checkCrossfadeTrigger(player: HTMLAudioElement) {
    if (this.crossfadeDuration <= 0) return;

    const remaining = player.duration - player.currentTime;
    
    // Only trigger crossfade once, we check if next song is already pre-loaded/active and we are in secondary time
    if (remaining > 0 && remaining <= this.crossfadeDuration && Object.is(player, this.getActivePlayerInstance())) {
      // Trigger target ended handler ahead of time to preload B and crossfade
      this.triggerCrossfadeAhead();
    }
  }

  private isCrossfadingInProgress = false;

  private triggerCrossfadeAhead() {
    if (this.isCrossfadingInProgress) return;
    this.isCrossfadingInProgress = true;

    this.onTrackEndedListeners.forEach((endedHandler) => {
      // This will pull the next track and tell audioEngine to start loading/fading it in!
      endedHandler();
    });
  }

  private async prepareNextSongCrossfade(track: Track) {
    const nextTag = this.activePlayer === 'A' ? 'B' : 'A';
    const nextPlayer = nextTag === 'A' ? this.playerA : this.playerB;
    
    // Create new Object URL
    let objectUrl = '';
    if (track.rawFile) {
      objectUrl = URL.createObjectURL(track.rawFile);
    } else if (track.filePath) {
      const cleanPath = track.filePath.replace(/\\/g, '/');
      objectUrl = `media://local-file?path=${encodeURIComponent(cleanPath)}`;
    } else if (track.fileHandle) {
      try {
        const file = await track.fileHandle.getFile();
        objectUrl = URL.createObjectURL(file);
      } catch (e) {
        console.error('Error fetching file for crossfade', e);
        this.isCrossfadingInProgress = false;
        return;
      }
    } else {
      this.isCrossfadingInProgress = false;
      return;
    }

    if (nextTag === 'A') {
      if (this.objectUrlA) URL.revokeObjectURL(this.objectUrlA);
      this.trackA = track;
      this.objectUrlA = objectUrl;
    } else {
      if (this.objectUrlB) URL.revokeObjectURL(this.objectUrlB);
      this.trackB = track;
      this.objectUrlB = objectUrl;
    }

    nextPlayer.src = objectUrl;
    nextPlayer.playbackRate = this.speed;
    
    // We are fading in the new player while fading out the old
    const oldPlayer = this.getActivePlayerInstance();

    // 1. Manual Volume-based native crossfade if Web Audio is bypassed/disabled
    if (!this.useWebAudio) {
      const durationMs = this.crossfadeDuration * 1000;
      const intervalMs = 50;
      const steps = durationMs / intervalMs;
      let step = 0;
      
      const initialOldVolume = this.volume;
      nextPlayer.volume = 0;

      try {
        await nextPlayer.play();
      } catch (e) {
        console.error('Failed to trigger native play during crossfade', e);
      }

      const fadeTimer = setInterval(() => {
        step++;
        const ratio = step / steps;
        
        // Linear native volume transition
        oldPlayer.volume = initialOldVolume * Math.max(0, 1 - ratio);
        nextPlayer.volume = this.volume * Math.min(1, ratio);
        
        if (ratio >= 1.0) {
          clearInterval(fadeTimer);
          oldPlayer.pause();
          oldPlayer.currentTime = 0;
          oldPlayer.volume = this.volume; // restore standard setting for next turn
          nextPlayer.volume = this.volume;
          
          this.activePlayer = nextTag;
          this.isCrossfadingInProgress = false;
          this.initPlaySecondsTracking();
          this.notifyState();
        }
      }, intervalMs);
      return;
    }
    
    // 2. Web Audio-based crossfade
    nextPlayer.volume = 0; // Web Audio controls actual gain instead
    this.initCtx();

    if (this.ctx && this.gainA && this.gainB) {
      const now = this.ctx.currentTime;
      const duration = this.crossfadeDuration;

      // Old player fade out, new player fade in
      if (nextTag === 'A') {
        // Fade B to 0, A to 1
        this.gainB.gain.linearRampToValueAtTime(0, now + duration);
        this.gainA.gain.linearRampToValueAtTime(1, now + duration);
      } else {
        // Fade A to 0, B to 1
        this.gainA.gain.linearRampToValueAtTime(0, now + duration);
        this.gainB.gain.linearRampToValueAtTime(1, now + duration);
      }
    }

    // Play next!
    try {
      await nextPlayer.play();
    } catch (e) {
      console.error('Failed to trigger crossfade next play', e);
    }

    // After fade duration, stop old player and clean up
    setTimeout(() => {
      oldPlayer.pause();
      oldPlayer.currentTime = 0;
      
      // Pivot active tag pointers
      this.activePlayer = nextTag;
      this.isCrossfadingInProgress = false;
      this.initPlaySecondsTracking();
      this.notifyState();
    }, this.crossfadeDuration * 1000);
  }

  private handlePlayerEnded(tag: 'A' | 'B') {
    if (this.isCrossfadingInProgress) {
      // Crossfading already handled transitions, ignore standard completion events
      return;
    }
    
    this.pauseTracking(); // complete any lingering play count metric
    this.onTrackEndedListeners.forEach((cb) => cb());
  }

  // --- STATE CONTROLLERS ---
  public getAudioContext(): AudioContext | null {
    this.initCtx();
    return this.ctx;
  }

  public getActivePlayerInstance(): HTMLAudioElement {
    return this.activePlayer === 'A' ? this.playerA : this.playerB;
  }

  public getCurrentTrack(): Track | null {
    return this.activePlayer === 'A' ? this.trackA : this.trackB;
  }

  public async playTrack(track: Track): Promise<void> {
    if (this.useWebAudio) {
      this.initCtx();
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
    }

    const player = this.getActivePlayerInstance();
    
    // Create new Object URL
    let objectUrl = '';
    if (track.rawFile) {
      objectUrl = URL.createObjectURL(track.rawFile);
    } else if (track.filePath) {
      const cleanPath = track.filePath.replace(/\\/g, '/');
      objectUrl = `media://local-file?path=${encodeURIComponent(cleanPath)}`;
    } else if (track.fileHandle) {
      try {
        const file = await track.fileHandle.getFile();
        objectUrl = URL.createObjectURL(file);
      } catch (e) {
        console.error('File handle execution failed', e);
        throw new Error('Local file could not be read. Please grant folder permissions or import it again.');
      }
    } else {
      throw new Error('Missing file handle or source file raw representation');
    }

    // Update active player specifics
    if (this.activePlayer === 'A') {
      if (this.objectUrlA) URL.revokeObjectURL(this.objectUrlA);
      this.trackA = track;
      this.objectUrlA = objectUrl;
    } else {
      if (this.objectUrlB) URL.revokeObjectURL(this.objectUrlB);
      this.trackB = track;
      this.objectUrlB = objectUrl;
    }

    player.src = objectUrl;
    player.playbackRate = this.speed;
    
    // Reset volume mapping
    if (this.useWebAudio && this.ctx && this.gainA && this.gainB) {
      const now = this.ctx.currentTime;
      this.gainA.gain.setValueAtTime(this.activePlayer === 'A' ? 1 : 0, now);
      this.gainB.gain.setValueAtTime(this.activePlayer === 'B' ? 1 : 0, now);
    } else {
      // Direct Native HTML5 Mode: set direct volumes
      this.playerA.volume = this.activePlayer === 'A' ? this.volume : 0;
      this.playerB.volume = this.activePlayer === 'B' ? this.volume : 0;
    }

    try {
      this.isCrossfadingInProgress = false;
      await player.play();
      this.initPlaySecondsTracking();
      this.notifyState();
    } catch (err) {
      console.error('Play error:', err);
      throw err;
    }
  }

  public async nextTrackByCrossfade(nextTrack: Track) {
    if (this.crossfadeDuration > 0) {
      await this.prepareNextSongCrossfade(nextTrack);
    } else {
      await this.playTrack(nextTrack);
    }
  }

  public play() {
    this.initCtx();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.getActivePlayerInstance().play().catch(console.error);
    this.initPlaySecondsTracking();
  }

  public pause() {
    this.getActivePlayerInstance().pause();
    this.pauseTracking();
  }

  public stop() {
    this.playerA.pause();
    this.playerB.pause();
    this.playerA.currentTime = 0;
    this.playerB.currentTime = 0;
    this.trackA = null;
    this.trackB = null;
    this.pauseTracking();
    this.notifyState();
  }

  public seek(seconds: number) {
    const player = this.getActivePlayerInstance();
    player.currentTime = seconds;
    this.notifyState();
  }

  public setVolume(volume: number) {
    this.volume = volume;
    this.initCtx();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(volume, this.ctx.currentTime);
    } else {
      this.playerA.volume = volume;
      this.playerB.volume = volume;
    }
    this.notifyState();
  }

  public setPlaybackSpeed(speed: number) {
    this.speed = speed;
    this.playerA.playbackRate = speed;
    this.playerB.playbackRate = speed;
    this.notifyState();
  }

  public setCrossfade(seconds: number) {
    this.crossfadeDuration = seconds;
  }

  public setEqualizerEnabled(enabled: boolean) {
    this.equalizerEnabled = enabled;
    this.initCtx();
    this.eqFilters.forEach((filter, index) => {
      filter.gain.setValueAtTime(enabled ? this.equalizerGains[index] : 0, this.ctx?.currentTime || 0);
    });
  }

  public setEqualizerGain(bandIndex: number, gainDb: number) {
    const clampedGain = Math.max(-12, Math.min(12, gainDb));
    this.equalizerGains[bandIndex] = clampedGain;
    this.initCtx();
    if (this.eqFilters[bandIndex]) {
      this.eqFilters[bandIndex].gain.setValueAtTime(this.equalizerEnabled ? clampedGain : 0, this.ctx?.currentTime || 0);
    }
  }

  public setEqualizerGains(gains: number[]) {
    this.equalizerGains = [...gains];
    this.initCtx();
    this.eqFilters.forEach((filter, index) => {
      filter.gain.setValueAtTime(this.equalizerEnabled ? gains[index] : 0, this.ctx?.currentTime || 0);
    });
  }

  // --- EVENTS & LISTENERS ---
  public subscribeState(listener: PlaybackStateListener): () => void {
    this.stateListeners.add(listener);
    // Initial emission
    listener(this.getState());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public subscribePlayQualified(listener: QualificationListener): () => void {
    this.onPlayQualifiedListeners.add(listener);
    return () => {
      this.onPlayQualifiedListeners.delete(listener);
    };
  }

  public subscribeTrackEnded(listener: () => void): () => void {
    this.onTrackEndedListeners.add(listener);
    return () => {
      this.onTrackEndedListeners.delete(listener);
    };
  }

  public getState(): AudioEngineState {
    const player = this.getActivePlayerInstance();
    const currTrack = this.getCurrentTrack();
    
    return {
      isPlaying: !player.paused,
      duration: isNaN(player.duration) ? (currTrack?.duration || 0) : player.duration,
      currentTime: player.currentTime,
      volume: this.volume,
      playbackSpeed: this.speed,
      currentTrackId: currTrack?.id,
    };
  }

  private notifyState() {
    const state = this.getState();
    this.stateListeners.forEach((listener) => listener(state));
  }
}

export const audioEngine = new AudioEngine();
export default audioEngine;
