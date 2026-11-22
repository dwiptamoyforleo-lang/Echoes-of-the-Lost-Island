import { useEffect, useState } from 'react';
import { useGameStore } from '@/src/state/gameStore';
import { RuneCorner, RuneDivider } from './RuneOrnaments';

export function DialogueBox() {
  const activeInscription = useGameStore((s) => s.activeInscription);
  const closeInscription = useGameStore((s) => s.closeInscription);

  const [visibleChars, setVisibleChars] = useState(0);

  const body = activeInscription?.body ?? '';
  const finished = visibleChars >= body.length;

  useEffect(() => {
    if (!activeInscription) {
      setVisibleChars(0);
      return;
    }
    setVisibleChars(0);
    const interval = window.setInterval(() => {
      setVisibleChars((prev) => {
        if (prev >= activeInscription.body.length) {
          window.clearInterval(interval);
          return prev;
        }
        return prev + 2;
      });
    }, 24);
    return () => window.clearInterval(interval);
  }, [activeInscription]);

  if (!activeInscription) return null;

  const handleBoxAction = () => {
    if (!finished) {
      setVisibleChars(body.length);
    } else {
      closeInscription();
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-x-0 bottom-14 z-30 flex justify-center px-4"
      data-testid="dialogue-box"
    >
      <div
        className="parchment-panel animate-panel-in relative w-full max-w-2xl rounded-md px-6 py-5 shadow-2xl sm:px-8 sm:py-6"
        role="dialog"
        aria-label={activeInscription.title}
        onClick={handleBoxAction}
      >
        <RuneCorner className="absolute top-1.5 left-1.5 text-[#7c5d2c]" />
        <RuneCorner className="absolute top-1.5 right-1.5 rotate-90 text-[#7c5d2c]" />

        <div className="mb-2 flex items-center justify-between gap-4">
          <h2 className="font-display text-base font-bold tracking-wide text-[#422f15] sm:text-lg">
            {activeInscription.title}
          </h2>
          <span className="font-mono text-[11px] font-semibold text-[#75582e]">
            Ancient Stone Lore
          </span>
        </div>

        <RuneDivider className="mb-3" />

        <p className="min-h-[4.2rem] text-sm leading-relaxed text-[#2d2112]">
          {body.slice(0, visibleChars)}
          {!finished && (
            <span className="ml-0.5 inline-block h-4 w-1.5 bg-[#174c47] align-middle" />
          )}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#6d532c]">
            {finished
              ? 'Press E or Esc to close'
              : 'Click text to reveal all'}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.currentTarget.blur();
              handleBoxAction();
            }}
            className="bronze-btn rounded px-4 py-1.5 text-xs font-semibold"
          >
            {finished ? 'Close' : 'Reveal'}
          </button>
        </div>
      </div>
    </div>
  );
}
