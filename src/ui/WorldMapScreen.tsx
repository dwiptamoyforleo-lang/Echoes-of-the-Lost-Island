import { useState } from 'react';
import { useGameStore } from '@/src/state/gameStore';
import {
  LEVEL_CATALOG,
  getLevelMetadata,
  type LevelId,
} from '@/src/systems/progressionSystem';
import { FragmentEmblem, RuneCorner } from './RuneOrnaments';

interface MapNodeCoord {
  id: LevelId;
  x: number;
  y: number;
  tag: string;
}

const NODE_COORDS: MapNodeCoord[] = [
  { id: 'level1', x: 165, y: 375, tag: 'I' },
  { id: 'level2', x: 310, y: 265, tag: 'II' },
  { id: 'level3', x: 475, y: 315, tag: 'III' },
  { id: 'level4', x: 605, y: 185, tag: 'IV' },
  { id: 'level5', x: 430, y: 115, tag: 'V' },
];

export function WorldMapScreen() {
  const screen = useGameStore((s) => s.screen);
  const progression = useGameStore((s) => s.progression);
  const gameCompleted = useGameStore(
    (s) => s.gameCompleted || s.progression.level5.completed,
  );
  const activeLevel = useGameStore((s) => s.activeLevel);
  const startLevel = useGameStore((s) => s.startLevel);
  const setScreen = useGameStore((s) => s.setScreen);

  const [selectedId, setSelectedId] = useState<LevelId>(
    activeLevel === 'testArena' ? 'level1' : activeLevel,
  );

  if (screen !== 'worldMap') return null;

  const selectedMeta = getLevelMetadata(selectedId);
  const selectedProg = progression[selectedId];
  const prereqMeta = selectedMeta.prerequisiteId
    ? getLevelMetadata(selectedMeta.prerequisiteId)
    : null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-20 flex items-center justify-center p-3 sm:p-6"
      style={{ backgroundColor: 'rgba(10, 16, 18, 0.72)' }}
      data-testid="world-map-screen"
    >
      <div className="stone-panel animate-panel-in relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-md p-4 sm:p-6">
        <RuneCorner className="pointer-events-none absolute top-1.5 left-1.5" />
        <RuneCorner className="pointer-events-none absolute top-1.5 right-1.5 rotate-90" />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#c79d52]/30 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-xl font-bold tracking-wide text-[#f7ebd2] sm:text-2xl">
                Chart of the Lost Archipelago
              </h2>
              {gameCompleted && (
                <span
                  data-testid="world-map-complete-badge"
                  className="rounded border border-[#e0b86b]/70 bg-[#184f4a]/90 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#f8e4b7]"
                >
                  Game Complete · Archipelago Restored
                </span>
              )}
            </div>
            <p className="text-xs text-[#bfb195]">
              Select an unlocked region to embark on an expedition
            </p>
          </div>
          <button
            type="button"
            data-testid="world-map-back"
            onClick={(e) => {
              e.currentTarget.blur();
              setScreen('mainMenu');
            }}
            className="stone-btn rounded px-4 py-2 text-xs font-semibold"
          >
            Back to Menu
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-[1.55fr_1fr]">
          {/* Illustrated Parchment SVG Map */}
          <div className="parchment-panel relative flex items-center justify-center overflow-hidden rounded p-2 sm:p-3">
            <svg
              viewBox="0 0 780 470"
              className="h-auto w-full select-none"
              role="img"
              aria-label="Illustrated Archipelago Map"
            >
              {/* Parchment Sea Contour Lines */}
              <path
                d="M40,420 Q190,390 360,415 T740,390"
                fill="none"
                stroke="#9a7d4a"
                strokeOpacity="0.35"
                strokeDasharray="5 6"
                strokeWidth="1.5"
              />
              <path
                d="M30,85 Q240,60 440,85 T750,65"
                fill="none"
                stroke="#9a7d4a"
                strokeOpacity="0.3"
                strokeDasharray="4 7"
                strokeWidth="1.5"
              />

              {/* Archipelago Landmass Silhouettes */}
              <path
                d="M95,380 C85,320 130,275 190,285 C235,292 255,345 235,395 C200,428 115,422 95,380 Z"
                fill="#c8b07b"
                stroke="#7c5d2c"
                strokeWidth="2"
              />
              <path
                d="M250,260 C245,205 305,175 365,195 C415,215 415,275 370,305 C315,320 260,302 250,260 Z"
                fill="#c1ac74"
                stroke="#7c5d2c"
                strokeWidth="2"
              />
              <path
                d="M415,325 C405,270 465,245 520,270 C555,290 545,355 495,368 C445,375 422,355 415,325 Z"
                fill="#bfaa76"
                stroke="#7c5d2c"
                strokeWidth="2"
              />
              <path
                d="M545,195 C538,135 605,112 660,142 C698,165 688,230 638,242 C582,250 552,225 545,195 Z"
                fill="#b89b66"
                stroke="#7c5d2c"
                strokeWidth="2"
              />
              <path
                d="M365,125 C358,72 418,48 475,72 C512,92 505,152 455,165 C402,172 372,155 365,125 Z"
                fill="#cbb47f"
                stroke="#7c5d2c"
                strokeWidth="2"
              />

              {/* Dotted Expedition Trail Connecting All 5 Regions */}
              <path
                d="M165,375 Q235,310 310,265 T475,315 T605,185 T430,115"
                fill="none"
                stroke="#6b4b22"
                strokeWidth="2.5"
                strokeDasharray="7 6"
                strokeOpacity="0.65"
              />

              {/* Compass Rose */}
              <g transform="translate(92, 92)" opacity="0.8">
                <circle
                  cx="0"
                  cy="0"
                  r="34"
                  fill="none"
                  stroke="#745427"
                  strokeWidth="1.4"
                />
                <polygon points="0,-32 6,-6 0,-12 -6,-6" fill="#745427" />
                <polygon points="0,32 6,6 0,12 -6,6" fill="#9c7944" />
                <polygon points="32,0 6,6 12,0 6,-6" fill="#9c7944" />
                <polygon points="-32,0 -6,6 -12,0 -6,-6" fill="#9c7944" />
                <text
                  x="0"
                  y="-38"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill="#4d3515"
                >
                  N
                </text>
              </g>

              {/* 5 Level Nodes */}
              {NODE_COORDS.map((node) => {
                const meta = getLevelMetadata(node.id);
                const prog = progression[node.id];
                const isSelected = selectedId === node.id;
                const fill = prog.completed
                  ? '#115e59'
                  : prog.unlocked
                    ? '#1f4e52'
                    : '#6b6254';
                const stroke = isSelected
                  ? '#f59e0b'
                  : prog.unlocked
                    ? '#2dd4bf'
                    : '#4b4338';

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(node.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${meta.name} (${prog.unlocked ? 'Unlocked' : 'Locked'})`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(node.id);
                      }
                    }}
                    data-testid={`map-node-${node.id}`}
                  >
                    {isSelected && (
                      <circle
                        r="31"
                        fill="none"
                        stroke="#d97706"
                        strokeWidth="2.5"
                        strokeDasharray="4 3"
                      />
                    )}
                    <circle
                      r="24"
                      fill={fill}
                      stroke={stroke}
                      strokeWidth="3"
                    />
                    <text
                      x="0"
                      y="5"
                      textAnchor="middle"
                      fontSize="14"
                      fontWeight="700"
                      fill="#f9f1df"
                    >
                      {node.tag}
                    </text>

                    {/* Label Ribbon below node */}
                    <rect
                      x="-74"
                      y="30"
                      width="148"
                      height="34"
                      rx="4"
                      fill="rgba(34, 27, 18, 0.88)"
                      stroke="#b38a46"
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="45"
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight="700"
                      fill="#f5e9ce"
                    >
                      {meta.name}
                    </text>
                    <text
                      x="0"
                      y="58"
                      textAnchor="middle"
                      fontSize="9.5"
                      fill={prog.unlocked ? '#99f6e4' : '#d6c7aa'}
                    >
                      {prog.unlocked
                        ? `Crystals ${prog.crystalsCollected}/${prog.totalCrystals} · ${
                            prog.fragmentCollected ? 'Fragment ✓' : 'Unclaimed'
                          }`
                        : 'Locked'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Selected Region Inspector */}
          <div className="flex flex-col justify-between gap-4 rounded border border-[#c79d52]/30 bg-[#141a1c]/90 p-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-[#c79d52]">
                    Region {selectedMeta.order} of 5
                  </p>
                  <h3 className="font-display text-xl font-bold text-[#f7ebd2]">
                    {selectedMeta.name}
                  </h3>
                </div>
                <FragmentEmblem
                  recovered={selectedProg.fragmentCollected}
                  size="md"
                  label={selectedMeta.fragmentName}
                />
              </div>

              <p className="text-xs leading-relaxed text-[#d3c7ad]">
                {selectedMeta.description}
              </p>

              <div className="grid grid-cols-2 gap-2 border-y border-[#c79d52]/20 py-3 font-mono text-xs tabular-nums">
                <div>
                  <span className="block text-[11px] text-[#9e9075]">
                    Status
                  </span>
                  <span
                    className={
                      selectedProg.completed
                        ? 'text-emerald-300'
                        : selectedProg.unlocked
                          ? 'text-teal-300'
                          : 'text-amber-300'
                    }
                  >
                    {selectedProg.completed
                      ? 'Completed'
                      : selectedProg.unlocked
                        ? 'Unlocked'
                        : 'Locked'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-[#9e9075]">
                    Crystals
                  </span>
                  <span className="text-sky-300">
                    {selectedProg.crystalsCollected} /{' '}
                    {selectedProg.totalCrystals}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-[#9e9075]">
                    Fragment
                  </span>
                  <span className="text-[#f3e7cf]">
                    {selectedProg.fragmentCollected
                      ? selectedMeta.fragmentName
                      : 'Not Collected'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-[#9e9075]">
                    Best Time
                  </span>
                  <span className="text-[#f3e7cf]">
                    {selectedProg.bestTimeSeconds !== null
                      ? `${selectedProg.bestTimeSeconds.toFixed(1)}s`
                      : '--'}
                  </span>
                </div>
              </div>

              {!selectedProg.unlocked && prereqMeta && (
                <div className="rounded border border-amber-400/35 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
                  Requirement: Complete{' '}
                  <span className="font-semibold">{prereqMeta.name}</span> to
                  chart this region.
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={!selectedProg.unlocked}
                data-testid="world-map-embark"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startLevel(selectedId);
                }}
                className={
                  selectedProg.unlocked
                    ? 'bronze-btn w-full rounded px-4 py-3 text-sm font-semibold'
                    : 'stone-btn w-full rounded px-4 py-3 text-xs font-semibold opacity-60'
                }
              >
                {!selectedProg.unlocked
                  ? `Locked · Complete ${prereqMeta?.name ?? 'Previous Level'}`
                  : selectedProg.completed
                    ? `Replay ${selectedMeta.name}`
                    : `Embark to ${selectedMeta.name}`}
              </button>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {LEVEL_CATALOG.map((lvl) => {
                  const shortLabels: Record<LevelId, string> = {
                    level1: 'Shore',
                    level2: 'Woods',
                    level3: 'Sunken',
                    level4: 'Peaks',
                    level5: 'Temple',
                  };
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setSelectedId(lvl.id)}
                      className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        selectedId === lvl.id
                          ? 'bg-[#256f68] text-white'
                          : 'bg-[#22292b] text-[#cfc3aa] hover:text-white'
                      }`}
                    >
                      {lvl.order}. {shortLabels[lvl.id]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
