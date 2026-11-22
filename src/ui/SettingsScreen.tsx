import { useGameStore } from '@/src/state/gameStore';
import { DEFAULT_SETTINGS, type GraphicsQuality } from '@/src/systems/saveSystem';
import { AmbientDust, RuneCorner, RuneDivider } from './RuneOrnaments';

const QUALITY_OPTIONS: { value: GraphicsQuality; label: string; hint: string }[] = [
  { value: 'low', label: 'Low', hint: '0.75x DPR · Shadows Off' },
  { value: 'medium', label: 'Medium', hint: '1.0x DPR · Standard Shadows' },
  { value: 'high', label: 'High', hint: 'Full DPR · Soft Shadows' },
];

const CONTROLS_LIST: { keys: string; action: string }[] = [
  { keys: 'W A S D / Arrows', action: 'Move Explorer' },
  { keys: 'Shift', action: 'Sprint (uses Stamina)' },
  { keys: 'Space', action: 'Jump' },
  { keys: 'E', action: 'Interact / Advance Dialogue' },
  { keys: 'Click Viewport', action: 'Lock Camera Look' },
  { keys: 'I / Tab', action: 'Open Inventory Satchel' },
  { keys: 'J', action: 'Open Quest Log' },
  { keys: 'Escape', action: 'Pause / Close Panel' },
  { keys: 'F3 / F4', action: 'Telemetry / Systems Debug' },
];

export function SettingsScreen() {
  const screen = useGameStore((state) => state.screen);
  const settings = useGameStore((state) => state.settings);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const closeSettings = useGameStore((state) => state.closeSettings);

  if (screen !== 'settings') return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6"
      style={{ backgroundColor: 'rgba(10, 15, 18, 0.78)' }}
      data-testid="settings-screen"
      role="dialog"
      aria-label="Expedition Settings"
    >
      <AmbientDust />

      <div className="stone-panel animate-panel-in relative flex max-h-[92vh] w-full max-w-4xl flex-col gap-4 overflow-y-auto rounded-md p-5 sm:p-7">
        <RuneCorner className="pointer-events-none absolute top-2 left-2" />
        <RuneCorner className="pointer-events-none absolute top-2 right-2 rotate-90" />
        <RuneCorner className="pointer-events-none absolute bottom-2 right-2 rotate-180" />
        <RuneCorner className="pointer-events-none absolute bottom-2 left-2 -rotate-90" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold tracking-wide text-[#f7ebd2] sm:text-2xl">
              Expedition Settings
            </h2>
            <p className="text-xs text-[#b8aa8e]">
              Changes apply immediately and are saved to your chronicle
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="settings-reset-btn"
              onClick={() => updateSettings({ ...DEFAULT_SETTINGS })}
              className="stone-btn rounded px-3 py-1.5 text-xs font-medium"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              data-testid="settings-back-btn"
              onClick={() => closeSettings()}
              className="bronze-btn rounded px-4 py-1.5 text-xs font-semibold"
            >
              Back
            </button>
          </div>
        </div>

        <RuneDivider />

        <div className="grid gap-6 md:grid-cols-[1.25fr_1fr]">
          {/* Left column: Graphics, Audio, Camera */}
          <div className="flex flex-col gap-5">
            {/* Graphics Quality */}
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-xs font-semibold tracking-wider text-[#d9af62] uppercase">
                  Graphics Quality
                </span>
                <span className="font-mono text-[11px] text-[#a5977c]">
                  {QUALITY_OPTIONS.find((q) => q.value === settings.graphicsQuality)?.hint}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {QUALITY_OPTIONS.map((opt) => {
                  const active = settings.graphicsQuality === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      data-testid={`setting-quality-${opt.value}`}
                      onClick={() => updateSettings({ graphicsQuality: opt.value })}
                      className={
                        active
                          ? 'bronze-btn rounded px-3 py-2 text-xs font-semibold'
                          : 'stone-btn rounded px-3 py-2 text-xs font-medium'
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Audio Volumes */}
            <section className="flex flex-col gap-3 border-t border-[#c79d52]/20 pt-4">
              <span className="font-display text-xs font-semibold tracking-wider text-[#d9af62] uppercase">
                Audio Resonance
              </span>

              <label className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#e6dac0]">Master Volume</span>
                  <span className="font-mono text-[#c79d52] tabular-nums">
                    {Math.round(settings.masterVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.masterVolume}
                  data-testid="setting-master-volume"
                  onChange={(e) =>
                    updateSettings({ masterVolume: parseFloat(e.target.value) })
                  }
                  className="h-2 w-full cursor-pointer accent-[#2dd4bf]"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#e6dac0]">Music Volume</span>
                  <span className="font-mono text-[#c79d52] tabular-nums">
                    {Math.round(settings.musicVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.musicVolume}
                  data-testid="setting-music-volume"
                  onChange={(e) =>
                    updateSettings({ musicVolume: parseFloat(e.target.value) })
                  }
                  className="h-2 w-full cursor-pointer accent-[#2dd4bf]"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#e6dac0]">Effects (SFX) Volume</span>
                  <span className="font-mono text-[#c79d52] tabular-nums">
                    {Math.round(settings.sfxVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.sfxVolume}
                  data-testid="setting-sfx-volume"
                  onChange={(e) =>
                    updateSettings({ sfxVolume: parseFloat(e.target.value) })
                  }
                  className="h-2 w-full cursor-pointer accent-[#2dd4bf]"
                />
              </label>
            </section>

            {/* Camera & Mouse */}
            <section className="flex flex-col gap-3 border-t border-[#c79d52]/20 pt-4">
              <span className="font-display text-xs font-semibold tracking-wider text-[#d9af62] uppercase">
                Camera &amp; Controls
              </span>

              <label className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#e6dac0]">Mouse Sensitivity</span>
                  <span className="font-mono text-[#c79d52] tabular-nums">
                    {settings.mouseSensitivity.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={2.5}
                  step={0.1}
                  value={settings.mouseSensitivity}
                  data-testid="setting-mouse-sens"
                  onChange={(e) =>
                    updateSettings({ mouseSensitivity: parseFloat(e.target.value) })
                  }
                  className="h-2 w-full cursor-pointer accent-[#2dd4bf]"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#e6dac0]">Camera Response</span>
                  <span className="font-mono text-[#c79d52] tabular-nums">
                    {settings.cameraSensitivity.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={2.5}
                  step={0.1}
                  value={settings.cameraSensitivity}
                  data-testid="setting-camera-sens"
                  onChange={(e) =>
                    updateSettings({ cameraSensitivity: parseFloat(e.target.value) })
                  }
                  className="h-2 w-full cursor-pointer accent-[#2dd4bf]"
                />
              </label>

              <div className="flex items-center justify-between rounded border border-[#c79d52]/25 bg-[#121719]/75 px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-[#f3e7cf]">
                    Invert Y-Axis
                  </p>
                  <p className="text-[11px] text-[#a5977c]">
                    Flip vertical camera pitch direction
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.invertY}
                  data-testid="setting-invert-y"
                  onClick={() => updateSettings({ invertY: !settings.invertY })}
                  className={
                    settings.invertY
                      ? 'bronze-btn rounded px-3.5 py-1.5 font-mono text-xs font-semibold'
                      : 'stone-btn rounded px-3.5 py-1.5 font-mono text-xs font-medium'
                  }
                >
                  {settings.invertY ? 'ON' : 'OFF'}
                </button>
              </div>
            </section>
          </div>

          {/* Right column: Controls Reference */}
          <aside className="parchment-panel flex flex-col gap-3 rounded p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-[#8a6a34]/40 pb-2">
              <h3 className="font-display text-sm font-bold tracking-wide text-[#3b2914]">
                Explorer Field Controls
              </h3>
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#7c5c28]" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <polygon points="12,5 14.5,12 12,19 9.5,12" fill="currentColor" />
              </svg>
            </div>
            <dl className="flex flex-col gap-2 text-xs">
              {CONTROLS_LIST.map((item) => (
                <div
                  key={item.keys}
                  className="flex items-center justify-between gap-2 border-b border-[#8a6a34]/20 pb-1.5 last:border-b-0 last:pb-0"
                >
                  <dt className="font-mono text-[11px] font-semibold text-[#5b3d18]">
                    {item.keys}
                  </dt>
                  <dd className="text-right text-[#2b2013]">{item.action}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </div>
  );
}
