import { useEffect, useState } from 'react';
import { useGameStore } from '@/src/state/gameStore';
import { AmbientDust, RuneCorner, RuneDivider } from './RuneOrnaments';

interface StorySlide {
  chapter: string;
  title: string;
  body: string;
  art: 'pulse' | 'chart' | 'shore' | 'reunion' | 'spire' | 'horizon';
}

const INTRO_SLIDES: StorySlide[] = [
  {
    chapter: 'Prologue · I',
    title: 'The Vanished Pulse',
    body: 'For centuries, the resonant heart beneath the Outer Archipelago hummed through every tide. One autumn dusk, the beacon fell silent—and five coastal sanctuaries drifted into mist.',
    art: 'pulse',
  },
  {
    chapter: 'Prologue · II',
    title: 'Charting the Reefs',
    body: 'Armed only with a brass astrolabe and your survey journal, you sail beyond the breakwater. Each island still holds one shattered Fragment of the ancient circuit.',
    art: 'chart',
  },
  {
    chapter: 'Prologue · III',
    title: 'The Forgotten Shore',
    body: 'Your skiff grounds against warm cove sand. Above the surf, twin rune pillars flank a sealed stone gate waiting for a living spark.',
    art: 'shore',
  },
];

const ENDING_SLIDES: StorySlide[] = [
  {
    chapter: 'Epilogue · I',
    title: 'Five Echoes Reunited',
    body: 'Tide, Gale, Stars, Frost, and Eternity settle into the Sky Temple cradle. Their golden frequencies lock into harmony high above the cloud sea.',
    art: 'reunion',
  },
  {
    chapter: 'Epilogue · II',
    title: 'The Sky Temple Awakens',
    body: 'A radiant column of teal and amber light pierces the horizon above the floating sanctum, rekindling the ancient conduit across all five islands.',
    art: 'spire',
  },
  {
    chapter: 'Epilogue · III',
    title: 'A New Horizon',
    body: 'From the Forgotten Shore to the Frozen Peaks, the Lost Archipelago breathes again. Your expedition is inscribed among its legends.',
    art: 'horizon',
  },
];

function SlideIllustration({ art }: { art: StorySlide['art'] }) {
  return (
    <svg
      viewBox="0 0 360 120"
      className="h-28 w-full rounded border border-[#8a6a34]/45 bg-[#152023]"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="storyGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.48" />
          <stop offset="100%" stopColor="#152023" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="360" height="120" fill="#131c1f" />
      <circle cx="180" cy="60" r="64" fill="url(#storyGlow)" />

      {art === 'pulse' && (
        <g stroke="#d9af62" fill="none" strokeWidth="1.5">
          <circle cx="180" cy="60" r="18" stroke="#2dd4bf" strokeWidth="2" />
          <circle cx="180" cy="60" r="32" strokeDasharray="5 4" />
          <circle cx="180" cy="60" r="46" strokeOpacity="0.55" />
          <polygon points="180,45 191,60 180,75 169,60" fill="#2dd4bf" fillOpacity="0.35" />
        </g>
      )}
      {art === 'chart' && (
        <g stroke="#d9af62" fill="none" strokeWidth="1.5">
          <path d="M35,88 Q115,35 180,62 T325,38" strokeDasharray="4 4" />
          <circle cx="65" cy="76" r="5" fill="#2dd4bf" />
          <circle cx="180" cy="62" r="5" fill="#c79d52" />
          <circle cx="295" cy="45" r="5" fill="#c79d52" />
          <polygon points="180,18 184,28 194,28 186,34 189,44 180,38 171,44 174,34 166,28 176,28" fill="#d9af62" fillOpacity="0.4" />
        </g>
      )}
      {art === 'shore' && (
        <g fill="none" strokeWidth="1.6">
          <path d="M0,92 Q90,82 180,92 T360,90" stroke="#2dd4bf" />
          <path d="M0,104 Q110,95 210,103 T360,100" stroke="#38bdf8" strokeOpacity="0.6" />
          <polygon points="120,90 155,34 195,90" fill="#293538" stroke="#c79d52" />
          <polygon points="175,90 215,44 252,90" fill="#1e272a" stroke="#c79d52" />
          <polygon points="180,40 188,52 180,64 172,52" fill="#2dd4bf" />
        </g>
      )}
      {art === 'reunion' && (
        <g stroke="#d9af62" strokeWidth="1.5">
          {[90, 135, 180, 225, 270].map((x, idx) => (
            <polygon
              key={x}
              points={`${x},${44 + (idx % 2) * 8} ${x + 10},${60 + (idx % 2) * 8} ${x},${76 + (idx % 2) * 8} ${x - 10},${60 + (idx % 2) * 8}`}
              fill="#2dd4bf"
              fillOpacity="0.45"
            />
          ))}
          <line x1="90" y1="60" x2="270" y2="60" stroke="#2dd4bf" strokeOpacity="0.6" />
        </g>
      )}
      {art === 'spire' && (
        <g>
          <rect x="174" y="6" width="12" height="90" fill="#2dd4bf" fillOpacity="0.38" />
          <polygon points="155,104 180,26 205,104" fill="#263134" stroke="#d9af62" strokeWidth="1.6" />
          <circle cx="180" cy="30" r="9" fill="#2dd4bf" />
        </g>
      )}
      {art === 'horizon' && (
        <g>
          <circle cx="180" cy="72" r="24" fill="#d9af62" fillOpacity="0.35" stroke="#f0c975" strokeWidth="1.5" />
          <path d="M0,84 Q90,74 180,84 T360,82" fill="none" stroke="#2dd4bf" strokeWidth="2" />
          <path d="M0,98 Q120,90 240,98 T360,96" fill="none" stroke="#c79d52" strokeOpacity="0.55" />
        </g>
      )}
    </svg>
  );
}

export function StorySequenceScreen() {
  const screen = useGameStore((state) => state.screen);
  const finishIntro = useGameStore((state) => state.finishIntro);
  const setScreen = useGameStore((state) => state.setScreen);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    setSlideIndex(0);
  }, [screen]);

  if (screen !== 'intro' && screen !== 'ending') return null;

  const isIntro = screen === 'intro';
  const slides = isIntro ? INTRO_SLIDES : ENDING_SLIDES;
  const slide = slides[Math.min(slideIndex, slides.length - 1)];
  const isLast = slideIndex >= slides.length - 1;

  const completeSequence = () => {
    if (isIntro) {
      finishIntro();
    } else {
      setScreen('credits');
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(9, 14, 17, 0.84)' }}
      data-testid={isIntro ? 'story-intro-screen' : 'story-ending-screen'}
      role="dialog"
      aria-label={isIntro ? 'Expedition Prologue' : 'Expedition Epilogue'}
    >
      <AmbientDust />

      <div className="stone-panel animate-panel-in relative flex max-h-[92vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-md p-6 sm:p-8">
        <RuneCorner className="pointer-events-none absolute top-2 left-2" />
        <RuneCorner className="pointer-events-none absolute top-2 right-2 rotate-90" />
        <RuneCorner className="pointer-events-none absolute bottom-2 right-2 rotate-180" />
        <RuneCorner className="pointer-events-none absolute bottom-2 left-2 -rotate-90" />

        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-widest text-[#c79d52] uppercase">
            {slide.chapter}
          </span>
          <span className="font-mono text-[11px] text-[#a5977c] tabular-nums">
            {slideIndex + 1} / {slides.length}
          </span>
        </div>

        <SlideIllustration art={slide.art} />

        <div className="parchment-panel flex flex-col gap-2 rounded p-4 sm:p-5">
          <h2 className="font-display text-lg font-bold text-[#3b2914] sm:text-xl">
            {slide.title}
          </h2>
          <p className="text-xs leading-relaxed text-[#2b2013] sm:text-sm">
            {slide.body}
          </p>
        </div>

        <RuneDivider />

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            data-testid="story-skip-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              completeSequence();
            }}
            className="stone-btn rounded px-4 py-2 text-xs font-medium"
          >
            {isIntro ? 'Skip Prologue' : 'Skip to Credits'}
          </button>

          <button
            type="button"
            data-testid="story-next-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              if (isLast) {
                completeSequence();
              } else {
                setSlideIndex((i) => i + 1);
              }
            }}
            className="bronze-btn rounded px-5 py-2 text-xs font-semibold"
          >
            {isLast
              ? isIntro
                ? 'Set Ashore'
                : 'View Credits'
              : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
