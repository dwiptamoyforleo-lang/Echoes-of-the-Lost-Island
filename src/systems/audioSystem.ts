import { Howler } from 'howler';

export interface AudioVolumes {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
}

export type SynthSoundKind = 'crystal' | 'switch' | 'chest' | 'door' | 'fragment';

const MAX_CONCURRENT_VOICES = 6;
const currentVolumes: AudioVolumes = {
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.85,
};

let audioCtx: AudioContext | null = null;
let activeVoices = 0;
const chunkSoundRegistry = new Map<string, Set<() => void>>();

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctor();
    } catch (err) {
      console.warn('[Echoes] AudioContext unavailable, continuing silently:', err);
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function applyAudioSettings(volumes: Partial<AudioVolumes>): void {
  if (typeof volumes.masterVolume === 'number') {
    currentVolumes.masterVolume = Math.max(0, Math.min(1, volumes.masterVolume));
  }
  if (typeof volumes.musicVolume === 'number') {
    currentVolumes.musicVolume = Math.max(0, Math.min(1, volumes.musicVolume));
  }
  if (typeof volumes.sfxVolume === 'number') {
    currentVolumes.sfxVolume = Math.max(0, Math.min(1, volumes.sfxVolume));
  }

  if (typeof window !== 'undefined') {
    try {
      Howler.volume(currentVolumes.masterVolume);
    } catch (err) {
      console.warn('[Echoes] Howler volume adjustment skipped:', err);
    }
  }
}

export function getAudioVolumes(): AudioVolumes {
  return { ...currentVolumes };
}

export function playPooledSynth(kind: SynthSoundKind): void {
  if (activeVoices >= MAX_CONCURRENT_VOICES) return;
  const gainScale = currentVolumes.masterVolume * currentVolumes.sfxVolume;
  if (gainScale <= 0.01) return;

  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    activeVoices += 1;
    let dur = 0.18;
    if (kind === 'crystal') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(990, now + 0.14);
      dur = 0.16;
    } else if (kind === 'switch') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.12);
      dur = 0.15;
    } else if (kind === 'chest') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.24);
      dur = 0.28;
    } else if (kind === 'door') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(220, now + 0.3);
      dur = 0.34;
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.45);
      dur = 0.5;
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12 * gainScale, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.onended = () => {
      activeVoices = Math.max(0, activeVoices - 1);
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + dur + 0.02);
  } catch {
    activeVoices = Math.max(0, activeVoices - 1);
  }
}

export function registerChunkAudioCleanup(
  chunkId: string,
  cleanup: () => void,
): void {
  let set = chunkSoundRegistry.get(chunkId);
  if (!set) {
    set = new Set();
    chunkSoundRegistry.set(chunkId, set);
  }
  set.add(cleanup);
}

export function unloadChunkAudio(chunkId: string): void {
  const set = chunkSoundRegistry.get(chunkId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn();
    } catch {
      // Ignore cleanup errors
    }
  }
  set.clear();
  chunkSoundRegistry.delete(chunkId);
}

export function unloadAllChunkAudio(): void {
  for (const key of Array.from(chunkSoundRegistry.keys())) {
    unloadChunkAudio(key);
  }
}

export function getActiveAudioVoicesCount(): number {
  return activeVoices;
}
