import type { ActiveLevelId, GameScreen } from '@/src/state/gameStore';
import type { LevelId } from './progressionSystem';

export interface AudioVolumes {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
}

export type SynthSoundKind =
  | 'crystal'
  | 'switch'
  | 'chest'
  | 'door'
  | 'fragment'
  | 'plate'
  | 'mechanism'
  | 'jump'
  | 'land'
  | 'uiHover'
  | 'uiClick'
  | 'levelComplete';

export type SurfaceType = 'sand' | 'grass' | 'stone' | 'snow';
export type MusicThemeId =
  | 'menu'
  | 'level1'
  | 'level2'
  | 'level3'
  | 'level4'
  | 'level5';
export type AmbientLoopId = 'level1' | 'level2' | 'level3' | 'level4' | 'level5';

const MAX_CONCURRENT_VOICES = 14;
const CRYSTAL_COMBO_WINDOW_MS = 2600;
const CRYSTAL_PENTATONIC_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

const currentVolumes: AudioVolumes = {
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.85,
};

let audioCtx: AudioContext | null = null;
let masterGainNode: GainNode | null = null;
let musicBusGainNode: GainNode | null = null;
let ambientBusGainNode: GainNode | null = null;
let sfxBusGainNode: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

let audioUnlocked = false;
let mutedForBlur = false;
let activeVoices = 0;
let lifecycleInitialized = false;
let desiredScreen: GameScreen = 'mainMenu';
let desiredLevel: ActiveLevelId = 'level1';

// Crystal combo tracking
let crystalComboStep = 0;
let lastCrystalTimeMs = -10000;
let lastUiHoverTimeMs = 0;
let lastUiHoverEl: Element | null = null;

const chunkSoundRegistry = new Map<string, Set<() => void>>();

interface ActiveMusicHandle {
  theme: MusicThemeId;
  gain: GainNode;
  stop: () => void;
}

interface ActiveAmbientHandle {
  id: AmbientLoopId;
  gain: GainNode;
  stop: () => void;
}

let currentMusic: ActiveMusicHandle | null = null;
let currentAmbient: ActiveAmbientHandle | null = null;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function getMusicThemeForScene(
  screen: GameScreen,
  activeLevel: ActiveLevelId,
): MusicThemeId {
  if (
    screen === 'mainMenu' ||
    screen === 'worldMap' ||
    screen === 'settings' ||
    screen === 'credits' ||
    screen === 'intro' ||
    screen === 'ending'
  ) {
    return 'menu';
  }
  return activeLevel === 'testArena' ? 'level1' : activeLevel;
}

export function getAmbientForScene(
  screen: GameScreen,
  activeLevel: ActiveLevelId,
): AmbientLoopId | null {
  if (screen !== 'playing' && screen !== 'paused') {
    return null;
  }
  return activeLevel === 'testArena' ? 'level1' : activeLevel;
}

export function computeCrystalComboStep(nowMs: number): number {
  if (nowMs - lastCrystalTimeMs <= CRYSTAL_COMBO_WINDOW_MS) {
    crystalComboStep = Math.min(
      CRYSTAL_PENTATONIC_SEMITONES.length - 1,
      crystalComboStep + 1,
    );
  } else {
    crystalComboStep = 0;
  }
  lastCrystalTimeMs = nowMs;
  return crystalComboStep;
}

export function resetCrystalCombo(): void {
  crystalComboStep = 0;
  lastCrystalTimeMs = -10000;
}

export function resolveSurfaceType(
  levelId: ActiveLevelId,
  pos: { x: number; y: number; z: number },
  onIce = false,
): SurfaceType {
  if (onIce) return 'stone';
  switch (levelId) {
    case 'testArena':
      return Math.abs(pos.x) < 10 && pos.z > -3 && pos.z < 11 ? 'stone' : 'grass';
    case 'level1': {
      // Stone ruins & courtyard vs grassy upper terrace vs coastal sand
      if (Math.abs(pos.x) < 10.5 && pos.z < -8) return 'stone';
      if (pos.y > 2.35) return 'grass';
      return 'sand';
    }
    case 'level2': {
      if (Math.abs(pos.x) < 10 && pos.z < -10) return 'stone';
      if (Math.abs(pos.z + 1) < 2.2) return 'stone';
      return 'grass';
    }
    case 'level3':
      return 'stone';
    case 'level4':
      return 'snow';
    case 'level5':
      return 'stone';
  }
}

function getEffectiveMasterGain(): number {
  if (mutedForBlur) return 0;
  return currentVolumes.masterVolume;
}

function getEffectiveDuckFactor(): number {
  if (desiredScreen === 'paused' || desiredScreen === 'levelComplete') {
    return 0.48;
  }
  return 1.0;
}

function syncBusGains(immediate = false): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const tau = immediate ? 0.015 : 0.06;

  if (masterGainNode) {
    masterGainNode.gain.setTargetAtTime(getEffectiveMasterGain(), now, tau);
  }
  if (musicBusGainNode) {
    musicBusGainNode.gain.setTargetAtTime(
      currentVolumes.musicVolume * 0.42 * getEffectiveDuckFactor(),
      now,
      0.12,
    );
  }
  if (ambientBusGainNode) {
    const ambientLevel =
      (currentVolumes.musicVolume * 0.55 + currentVolumes.sfxVolume * 0.45) * 0.34;
    ambientBusGainNode.gain.setTargetAtTime(ambientLevel, now, 0.12);
  }
  if (sfxBusGainNode) {
    sfxBusGainNode.gain.setTargetAtTime(currentVolumes.sfxVolume * 0.9, now, tau);
  }
}

function ensureNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }
  const length = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Pink-ish noise for warm wind, waves, and footsteps
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.1848) * 0.22));
  }
  noiseBuffer = buffer;
  return buffer;
}

function ensureAudioGraph(): AudioContext | null {
  if (typeof window === 'undefined' || !audioUnlocked) return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;

  if (!audioCtx) {
    try {
      audioCtx = new Ctor();
      masterGainNode = audioCtx.createGain();
      musicBusGainNode = audioCtx.createGain();
      ambientBusGainNode = audioCtx.createGain();
      sfxBusGainNode = audioCtx.createGain();

      musicBusGainNode.connect(masterGainNode);
      ambientBusGainNode.connect(masterGainNode);
      sfxBusGainNode.connect(masterGainNode);
      masterGainNode.connect(audioCtx.destination);
      syncBusGains(true);
    } catch {
      return null;
    }
  }

  if (audioCtx.state === 'suspended' && !mutedForBlur) {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

export function isAudioMutedForBlur(): boolean {
  return mutedForBlur;
}

export function setAudioMutedForBlur(muted: boolean): void {
  mutedForBlur = muted;
  if (!audioCtx) return;
  syncBusGains(true);
  if (muted && audioCtx.state === 'running') {
    audioCtx.suspend().catch(() => {});
  } else if (!muted && audioUnlocked && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

export function unlockAudio(): void {
  if (audioUnlocked) {
    if (audioCtx && audioCtx.state === 'suspended' && !mutedForBlur) {
      audioCtx.resume().catch(() => {});
    }
    return;
  }
  audioUnlocked = true;
  const ctx = ensureAudioGraph();
  if (ctx) {
    applyDesiredSceneAudio();
  }
}

export function applyAudioSettings(volumes: Partial<AudioVolumes>): void {
  if (typeof volumes.masterVolume === 'number') {
    currentVolumes.masterVolume = clamp01(volumes.masterVolume);
  }
  if (typeof volumes.musicVolume === 'number') {
    currentVolumes.musicVolume = clamp01(volumes.musicVolume);
  }
  if (typeof volumes.sfxVolume === 'number') {
    currentVolumes.sfxVolume = clamp01(volumes.sfxVolume);
  }
  syncBusGains(false);
}

export function getAudioVolumes(): AudioVolumes {
  return { ...currentVolumes };
}

interface MusicThemeSpec {
  rootFreq: number;
  fifthFreq: number;
  scale: readonly number[];
  padType: OscillatorType;
  bellType: OscillatorType;
  noteIntervalMs: number;
  filterHz: number;
}

const MUSIC_THEME_SPECS: Record<MusicThemeId, MusicThemeSpec> = {
  menu: {
    rootFreq: 146.83, // D3
    fifthFreq: 220.0, // A3
    scale: [293.66, 329.63, 349.23, 440.0, 523.25, 587.33], // D Dorian
    padType: 'triangle',
    bellType: 'sine',
    noteIntervalMs: 1450,
    filterHz: 520,
  },
  level1: {
    rootFreq: 130.81, // C3
    fifthFreq: 196.0, // G3
    scale: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 659.25], // Sunlit C Maj Pentatonic
    padType: 'sine',
    bellType: 'triangle',
    noteIntervalMs: 1200,
    filterHz: 680,
  },
  level2: {
    rootFreq: 164.81, // E3
    fifthFreq: 246.94, // B3
    scale: [246.94, 293.66, 329.63, 369.99, 440.0, 493.88, 587.33], // Whispering E Dorian
    padType: 'triangle',
    bellType: 'sine',
    noteIntervalMs: 1320,
    filterHz: 600,
  },
  level3: {
    rootFreq: 98.0, // G2
    fifthFreq: 146.83, // D3
    scale: [196.0, 207.65, 261.63, 293.66, 311.13, 392.0, 466.16], // Sunken C/G Phrygian
    padType: 'sine',
    bellType: 'sine',
    noteIntervalMs: 1750,
    filterHz: 380,
  },
  level4: {
    rootFreq: 110.0, // A2
    fifthFreq: 164.81, // E3
    scale: [220.0, 261.63, 329.63, 392.0, 440.0, 493.88, 659.25], // Crystalline A Minor
    padType: 'sine',
    bellType: 'sine',
    noteIntervalMs: 1500,
    filterHz: 760,
  },
  level5: {
    rootFreq: 174.61, // F3
    fifthFreq: 261.63, // C4
    scale: [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25], // Radiant F Lydian
    padType: 'triangle',
    bellType: 'triangle',
    noteIntervalMs: 1180,
    filterHz: 840,
  },
};

function startMusicTrack(
  ctx: AudioContext,
  bus: GainNode,
  theme: MusicThemeId,
): ActiveMusicHandle {
  const spec = MUSIC_THEME_SPECS[theme];
  const trackGain = ctx.createGain();
  trackGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  trackGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 1.3);
  trackGain.connect(bus);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = spec.filterHz;
  filter.Q.value = 0.7;
  filter.connect(trackGain);

  const padGain = ctx.createGain();
  padGain.gain.value = 0.16;
  padGain.connect(filter);

  const oscRoot = ctx.createOscillator();
  oscRoot.type = spec.padType;
  oscRoot.frequency.value = spec.rootFreq;

  const oscFifth = ctx.createOscillator();
  oscFifth.type = 'sine';
  oscFifth.frequency.value = spec.fifthFreq;

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.12;
  lfoGain.gain.value = 85;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  oscRoot.connect(padGain);
  oscFifth.connect(padGain);

  oscRoot.start();
  oscFifth.start();
  lfo.start();

  let stepIdx = 0;
  let disposed = false;

  const scheduleMelodyNote = () => {
    if (disposed || mutedForBlur || ctx.state !== 'running') return;
    if (Math.random() < 0.22) return; // Calm breathing room

    const now = ctx.currentTime;
    const noteOsc = ctx.createOscillator();
    const noteGain = ctx.createGain();
    const noteIndex =
      (stepIdx + Math.floor(Math.random() * 2)) % spec.scale.length;
    stepIdx = (stepIdx + 2) % spec.scale.length;

    noteOsc.type = spec.bellType;
    noteOsc.frequency.setValueAtTime(spec.scale[noteIndex], now);

    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(0.11, now + 0.06);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.85);

    noteOsc.connect(noteGain);
    noteGain.connect(trackGain);
    noteOsc.start(now);
    noteOsc.stop(now + 1.9);
    noteOsc.onended = () => {
      noteOsc.disconnect();
      noteGain.disconnect();
    };
  };

  const timer = window.setInterval(scheduleMelodyNote, spec.noteIntervalMs);

  return {
    theme,
    gain: trackGain,
    stop: () => {
      if (disposed) return;
      disposed = true;
      window.clearInterval(timer);
      const stopAt = ctx.currentTime + 1.35;
      try {
        trackGain.gain.cancelScheduledValues(ctx.currentTime);
        trackGain.gain.setValueAtTime(trackGain.gain.value, ctx.currentTime);
        trackGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.25);
        oscRoot.stop(stopAt);
        oscFifth.stop(stopAt);
        lfo.stop(stopAt);
      } catch {
        // Ignore already stopped oscillators
      }
      window.setTimeout(() => {
        oscRoot.disconnect();
        oscFifth.disconnect();
        lfo.disconnect();
        lfoGain.disconnect();
        padGain.disconnect();
        filter.disconnect();
        trackGain.disconnect();
      }, 1450);
    },
  };
}

function startAmbientLoop(
  ctx: AudioContext,
  bus: GainNode,
  id: AmbientLoopId,
): ActiveAmbientHandle {
  const loopGain = ctx.createGain();
  loopGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  loopGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 1.15);
  loopGain.connect(bus);

  const noise = ctx.createBufferSource();
  noise.buffer = ensureNoiseBuffer(ctx);
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const cleanups: Array<() => void> = [];
  let intervalId: number | null = null;
  let disposed = false;

  if (id === 'level1') {
    // Ocean waves rolling along shore
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    filter.Q.value = 0.8;
    lfo.frequency.value = 0.14;
    lfoGain.gain.value = 190;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
  } else if (id === 'level2') {
    // Forest wind + gentle procedural birds
    filter.type = 'bandpass';
    filter.frequency.value = 520;
    filter.Q.value = 1.1;
    lfo.frequency.value = 0.2;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    intervalId = window.setInterval(() => {
      if (disposed || mutedForBlur || ctx.state !== 'running') return;
      if (Math.random() > 0.68) return;
      const now = ctx.currentTime;
      const chirps = Math.random() > 0.45 ? 2 : 1;
      for (let c = 0; c < chirps; c++) {
        const startT = now + c * 0.14;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const base = 1850 + Math.random() * 850;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base, startT);
        osc.frequency.exponentialRampToValueAtTime(base * 1.32, startT + 0.06);
        osc.frequency.exponentialRampToValueAtTime(base * 0.92, startT + 0.11);
        g.gain.setValueAtTime(0.0001, startT);
        g.gain.linearRampToValueAtTime(0.045, startT + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, startT + 0.12);
        osc.connect(g);
        g.connect(loopGain);
        osc.start(startT);
        osc.stop(startT + 0.13);
        osc.onended = () => {
          osc.disconnect();
          g.disconnect();
        };
      }
    }, 3100);
  } else if (id === 'level3') {
    // Underground cavern rumble + echoing water drips
    filter.type = 'lowpass';
    filter.frequency.value = 155;
    filter.Q.value = 1.4;
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    intervalId = window.setInterval(() => {
      if (disposed || mutedForBlur || ctx.state !== 'running') return;
      if (Math.random() > 0.72) return;
      const now = ctx.currentTime;
      const baseFreq = 780 + Math.random() * 550;
      const echoes = [0, 0.21, 0.44];
      echoes.forEach((delay, idx) => {
        const t = now + delay;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.65, t + 0.07);
        const amp = 0.06 / (idx + 1);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
        osc.connect(g);
        g.connect(loopGain);
        osc.start(t);
        osc.stop(t + 0.12);
        osc.onended = () => {
          osc.disconnect();
          g.disconnect();
        };
      });
    }, 2400);
  } else if (id === 'level4') {
    // Howling mountain wind
    filter.type = 'bandpass';
    filter.frequency.value = 480;
    filter.Q.value = 4.2;
    lfo.frequency.value = 0.17;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
  } else {
    // Level 5: Airy high-altitude breeze + crystalline shimmer
    filter.type = 'bandpass';
    filter.frequency.value = 1150;
    filter.Q.value = 0.9;
    lfo.frequency.value = 0.13;
    lfoGain.gain.value = 340;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const shimmerOsc = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.value = 523.25;
    shimmerGain.gain.value = 0.025;
    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(loopGain);
    shimmerOsc.start();
    cleanups.push(() => {
      try {
        shimmerOsc.stop();
      } catch {
        // ignore
      }
      shimmerOsc.disconnect();
      shimmerGain.disconnect();
    });
  }

  const baseNoiseGain = ctx.createGain();
  baseNoiseGain.gain.value = id === 'level4' ? 0.42 : id === 'level3' ? 0.25 : 0.3;

  noise.connect(filter);
  filter.connect(baseNoiseGain);
  baseNoiseGain.connect(loopGain);
  noise.start();
  lfo.start();

  return {
    id,
    gain: loopGain,
    stop: () => {
      if (disposed) return;
      disposed = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      const stopAt = ctx.currentTime + 1.25;
      try {
        loopGain.gain.cancelScheduledValues(ctx.currentTime);
        loopGain.gain.setValueAtTime(loopGain.gain.value, ctx.currentTime);
        loopGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.15);
        noise.stop(stopAt);
        lfo.stop(stopAt);
      } catch {
        // ignore
      }
      window.setTimeout(() => {
        cleanups.forEach((fn) => fn());
        noise.disconnect();
        lfo.disconnect();
        lfoGain.disconnect();
        filter.disconnect();
        baseNoiseGain.disconnect();
        loopGain.disconnect();
      }, 1350);
    },
  };
}

function applyDesiredSceneAudio(): void {
  if (!audioUnlocked) return;
  const ctx = ensureAudioGraph();
  if (!ctx || !musicBusGainNode || !ambientBusGainNode) return;

  syncBusGains(false);

  const nextTheme = getMusicThemeForScene(desiredScreen, desiredLevel);
  if (!currentMusic || currentMusic.theme !== nextTheme) {
    currentMusic?.stop();
    currentMusic = startMusicTrack(ctx, musicBusGainNode, nextTheme);
  }

  const nextAmbient = getAmbientForScene(desiredScreen, desiredLevel);
  if (nextAmbient === null) {
    if (currentAmbient) {
      currentAmbient.stop();
      currentAmbient = null;
    }
  } else if (!currentAmbient || currentAmbient.id !== nextAmbient) {
    currentAmbient?.stop();
    currentAmbient = startAmbientLoop(ctx, ambientBusGainNode, nextAmbient);
  }
}

export function syncAudioScene(
  screen: GameScreen,
  activeLevel: ActiveLevelId,
): void {
  desiredScreen = screen;
  desiredLevel = activeLevel;
  if (!audioUnlocked) return;
  applyDesiredSceneAudio();
}

function spawnTone(
  ctx: AudioContext,
  bus: GainNode,
  opts: {
    type?: OscillatorType;
    startFreq: number;
    endFreq?: number;
    startOffset?: number;
    duration: number;
    peakGain: number;
  },
): void {
  if (activeVoices >= MAX_CONCURRENT_VOICES) return;
  activeVoices += 1;
  try {
    const startT = ctx.currentTime + (opts.startOffset ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(20, opts.startFreq), startT);
    if (typeof opts.endFreq === 'number') {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, opts.endFreq),
        startT + Math.max(0.02, opts.duration * 0.9),
      );
    }

    gain.gain.setValueAtTime(0.0001, startT);
    gain.gain.linearRampToValueAtTime(opts.peakGain, startT + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startT + opts.duration);

    osc.connect(gain);
    gain.connect(bus);
    osc.onended = () => {
      activeVoices = Math.max(0, activeVoices - 1);
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(startT);
    osc.stop(startT + opts.duration + 0.02);
  } catch {
    activeVoices = Math.max(0, activeVoices - 1);
  }
}

function spawnFilteredNoise(
  ctx: AudioContext,
  bus: GainNode,
  opts: {
    filterType: BiquadFilterType;
    freq: number;
    q?: number;
    duration: number;
    peakGain: number;
    startOffset?: number;
  },
): void {
  if (activeVoices >= MAX_CONCURRENT_VOICES) return;
  activeVoices += 1;
  try {
    const startT = ctx.currentTime + (opts.startOffset ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = ensureNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType;
    filter.frequency.setValueAtTime(opts.freq, startT);
    filter.Q.value = opts.q ?? 1.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startT);
    gain.gain.linearRampToValueAtTime(opts.peakGain, startT + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startT + opts.duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus);

    const randomOffset = Math.random() * 1.5;
    src.onended = () => {
      activeVoices = Math.max(0, activeVoices - 1);
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    src.start(startT, randomOffset, opts.duration + 0.02);
  } catch {
    activeVoices = Math.max(0, activeVoices - 1);
  }
}

function canPlaySfx(): { ctx: AudioContext; bus: GainNode } | null {
  if (!audioUnlocked || mutedForBlur) return null;
  if (currentVolumes.masterVolume * currentVolumes.sfxVolume <= 0.01) {
    return null;
  }
  const ctx = ensureAudioGraph();
  if (!ctx || !sfxBusGainNode) return null;
  return { ctx, bus: sfxBusGainNode };
}

export function playPooledSynth(kind: SynthSoundKind): void {
  const ready = canPlaySfx();
  if (!ready) return;
  const { ctx, bus } = ready;

  switch (kind) {
    case 'crystal': {
      const step = computeCrystalComboStep(Date.now());
      const semitones = CRYSTAL_PENTATONIC_SEMITONES[step] ?? 0;
      const base = 587.33 * Math.pow(2, semitones / 12);
      spawnTone(ctx, bus, {
        type: 'sine',
        startFreq: base,
        endFreq: base * 1.5,
        duration: 0.22,
        peakGain: 0.16,
      });
      spawnTone(ctx, bus, {
        type: 'triangle',
        startFreq: base * 2,
        startOffset: 0.03,
        duration: 0.18,
        peakGain: 0.07,
      });
      break;
    }
    case 'switch': {
      spawnTone(ctx, bus, {
        type: 'triangle',
        startFreq: 210,
        endFreq: 420,
        duration: 0.12,
        peakGain: 0.14,
      });
      spawnFilteredNoise(ctx, bus, {
        filterType: 'bandpass',
        freq: 950,
        q: 2.2,
        duration: 0.07,
        peakGain: 0.1,
      });
      break;
    }
    case 'plate': {
      playPlateSfx(true);
      break;
    }
    case 'chest': {
      spawnFilteredNoise(ctx, bus, {
        filterType: 'bandpass',
        freq: 760,
        q: 1.5,
        duration: 0.1,
        peakGain: 0.12,
      });
      const chord = [523.25, 659.25, 783.99, 1046.5];
      chord.forEach((f, idx) => {
        spawnTone(ctx, bus, {
          type: 'triangle',
          startFreq: f,
          startOffset: idx * 0.065,
          duration: 0.34,
          peakGain: 0.12,
        });
      });
      break;
    }
    case 'door':
    case 'mechanism': {
      spawnFilteredNoise(ctx, bus, {
        filterType: 'lowpass',
        freq: 260,
        q: 1.2,
        duration: 0.48,
        peakGain: 0.2,
      });
      spawnTone(ctx, bus, {
        type: 'triangle',
        startFreq: 115,
        endFreq: 165,
        duration: 0.42,
        peakGain: 0.15,
      });
      break;
    }
    case 'fragment': {
      const notes = [587.33, 739.99, 880.0, 1174.66];
      notes.forEach((f, idx) => {
        spawnTone(ctx, bus, {
          type: idx % 2 === 0 ? 'sine' : 'triangle',
          startFreq: f,
          startOffset: idx * 0.09,
          duration: 0.55,
          peakGain: 0.15,
        });
      });
      break;
    }
    case 'levelComplete': {
      const notes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98];
      notes.forEach((f, idx) => {
        spawnTone(ctx, bus, {
          type: idx >= 4 ? 'triangle' : 'sine',
          startFreq: f,
          startOffset: idx * 0.085,
          duration: idx === notes.length - 1 ? 0.9 : 0.45,
          peakGain: 0.14,
        });
      });
      break;
    }
    case 'jump': {
      playJumpSfx();
      break;
    }
    case 'land': {
      playLandSfx(5, 'stone');
      break;
    }
    case 'uiHover': {
      spawnTone(ctx, bus, {
        type: 'sine',
        startFreq: 620,
        endFreq: 740,
        duration: 0.045,
        peakGain: 0.035,
      });
      break;
    }
    case 'uiClick': {
      spawnTone(ctx, bus, {
        type: 'triangle',
        startFreq: 380,
        endFreq: 240,
        duration: 0.065,
        peakGain: 0.085,
      });
      break;
    }
  }
}

export function playPlateSfx(engaged: boolean): void {
  const ready = canPlaySfx();
  if (!ready) return;
  const { ctx, bus } = ready;
  spawnTone(ctx, bus, {
    type: 'triangle',
    startFreq: engaged ? 150 : 120,
    endFreq: engaged ? 290 : 85,
    duration: 0.16,
    peakGain: 0.13,
  });
  spawnFilteredNoise(ctx, bus, {
    filterType: 'lowpass',
    freq: 420,
    duration: 0.1,
    peakGain: 0.1,
  });
}

export function playFootstepSfx(surface: SurfaceType): void {
  const ready = canPlaySfx();
  if (!ready) return;
  const { ctx, bus } = ready;

  if (surface === 'sand') {
    spawnFilteredNoise(ctx, bus, {
      filterType: 'bandpass',
      freq: 1350 + Math.random() * 250,
      q: 0.7,
      duration: 0.085,
      peakGain: 0.075,
    });
    spawnTone(ctx, bus, {
      type: 'sine',
      startFreq: 105,
      endFreq: 68,
      duration: 0.06,
      peakGain: 0.045,
    });
  } else if (surface === 'grass') {
    spawnFilteredNoise(ctx, bus, {
      filterType: 'highpass',
      freq: 1900 + Math.random() * 350,
      q: 0.8,
      duration: 0.075,
      peakGain: 0.065,
    });
    spawnTone(ctx, bus, {
      type: 'sine',
      startFreq: 120,
      endFreq: 75,
      duration: 0.055,
      peakGain: 0.045,
    });
  } else if (surface === 'snow') {
    spawnFilteredNoise(ctx, bus, {
      filterType: 'bandpass',
      freq: 2600 + Math.random() * 400,
      q: 1.4,
      duration: 0.11,
      peakGain: 0.09,
    });
    spawnFilteredNoise(ctx, bus, {
      filterType: 'bandpass',
      freq: 1900,
      q: 1.2,
      duration: 0.08,
      peakGain: 0.06,
      startOffset: 0.025,
    });
  } else {
    // Stone
    spawnTone(ctx, bus, {
      type: 'triangle',
      startFreq: 165 + Math.random() * 25,
      endFreq: 85,
      duration: 0.055,
      peakGain: 0.085,
    });
    spawnFilteredNoise(ctx, bus, {
      filterType: 'bandpass',
      freq: 1100,
      q: 1.8,
      duration: 0.04,
      peakGain: 0.05,
    });
  }
}

export function playJumpSfx(): void {
  const ready = canPlaySfx();
  if (!ready) return;
  const { ctx, bus } = ready;
  spawnTone(ctx, bus, {
    type: 'sine',
    startFreq: 210,
    endFreq: 420,
    duration: 0.14,
    peakGain: 0.09,
  });
  spawnFilteredNoise(ctx, bus, {
    filterType: 'bandpass',
    freq: 900,
    q: 0.9,
    duration: 0.12,
    peakGain: 0.05,
  });
}

export function playLandSfx(impactSpeed: number, surface: SurfaceType): void {
  const ready = canPlaySfx();
  if (!ready) return;
  const { ctx, bus } = ready;
  const intensity = Math.max(0.35, Math.min(1.1, impactSpeed / 11));
  spawnTone(ctx, bus, {
    type: 'triangle',
    startFreq: surface === 'stone' ? 140 : 105,
    endFreq: 52,
    duration: 0.11,
    peakGain: 0.11 * intensity,
  });
  spawnFilteredNoise(ctx, bus, {
    filterType: surface === 'snow' ? 'bandpass' : 'lowpass',
    freq: surface === 'snow' ? 2400 : 650,
    duration: 0.1,
    peakGain: 0.085 * intensity,
  });
}

function handleFirstInteraction(): void {
  unlockAudio();
}

function handleWindowBlur(): void {
  setAudioMutedForBlur(true);
}

function handleWindowFocus(): void {
  if (typeof document !== 'undefined' && document.hidden) return;
  setAudioMutedForBlur(false);
}

function handleVisibilityChange(): void {
  if (typeof document === 'undefined') return;
  setAudioMutedForBlur(document.hidden);
}

function isInteractiveUiTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const interactive = target.closest(
    'button, [role="button"], a[href], input[type="range"]',
  );
  if (!(interactive instanceof HTMLElement)) return null;
  if (interactive.dataset.noUiSfx === 'true') return null;
  if (interactive.closest('[data-no-ui-sfx="true"]')) return null;
  if ((interactive as HTMLButtonElement).disabled) return null;
  if (interactive.getAttribute('aria-disabled') === 'true') return null;
  return interactive;
}

function handleDocumentPointerOver(e: PointerEvent): void {
  if (e.pointerType !== 'mouse') return;
  const el = isInteractiveUiTarget(e.target);
  if (!el || el === lastUiHoverEl) return;
  lastUiHoverEl = el;
  const now = performance.now();
  if (now - lastUiHoverTimeMs < 75) return;
  lastUiHoverTimeMs = now;
  playPooledSynth('uiHover');
}

function handleDocumentClick(e: MouseEvent): void {
  unlockAudio();
  const el = isInteractiveUiTarget(e.target);
  if (!el) return;
  playPooledSynth('uiClick');
}

export function initAudioLifecycle(): () => void {
  if (typeof window === 'undefined' || lifecycleInitialized) {
    return () => {};
  }
  lifecycleInitialized = true;

  window.addEventListener('pointerdown', handleFirstInteraction, {
    capture: true,
    passive: true,
  });
  window.addEventListener('keydown', handleFirstInteraction, {
    capture: true,
    passive: true,
  });
  window.addEventListener('touchstart', handleFirstInteraction, {
    capture: true,
    passive: true,
  });
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('focus', handleWindowFocus);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('pointerover', handleDocumentPointerOver, true);
  document.addEventListener('click', handleDocumentClick, true);

  return () => {
    lifecycleInitialized = false;
    window.removeEventListener('pointerdown', handleFirstInteraction, {
      capture: true,
    });
    window.removeEventListener('keydown', handleFirstInteraction, {
      capture: true,
    });
    window.removeEventListener('touchstart', handleFirstInteraction, {
      capture: true,
    });
    window.removeEventListener('blur', handleWindowBlur);
    window.removeEventListener('focus', handleWindowFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('pointerover', handleDocumentPointerOver, true);
    document.removeEventListener('click', handleDocumentClick, true);
  };
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

export function resetAudioSystemForTests(): void {
  currentMusic?.stop();
  currentMusic = null;
  currentAmbient?.stop();
  currentAmbient = null;
  audioUnlocked = false;
  mutedForBlur = false;
  activeVoices = 0;
  resetCrystalCombo();
  desiredScreen = 'mainMenu';
  desiredLevel = 'level1';
  currentVolumes.masterVolume = 0.8;
  currentVolumes.musicVolume = 0.7;
  currentVolumes.sfxVolume = 0.85;
}

export type { LevelId };
