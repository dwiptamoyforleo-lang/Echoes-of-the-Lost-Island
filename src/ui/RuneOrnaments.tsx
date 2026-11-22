export function RuneCorner({
  className = '',
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 28 28"
      className={`pointer-events-none h-6 w-6 text-[#c79d52] ${className}`}
      aria-hidden="true"
    >
      <path
        d="M2 20V4h16M6 16V8h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function RuneDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#c79d52]/60 to-[#c79d52]/80" />
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#2dd4bf]">
        <polygon
          points="12,2 21,12 12,22 3,12"
          fill="currentColor"
          fillOpacity="0.22"
          stroke="#c79d52"
          strokeWidth="1.5"
        />
        <polygon points="12,7 16,12 12,17 8,12" fill="currentColor" />
      </svg>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#c79d52]/60 to-[#c79d52]/80" />
    </div>
  );
}

export function FragmentEmblem({
  recovered,
  size = 'md',
  label,
}: {
  recovered: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}) {
  const dims =
    size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-10 w-10' : 'h-7 w-7';
  return (
    <span title={label} className="inline-flex items-center justify-center">
      <svg
        viewBox="0 0 28 28"
        className={`${dims} transition-transform duration-200 ${
          recovered ? 'text-teal-300' : 'text-stone-500/70'
        }`}
        aria-label={label}
      >
        <polygon
          points="14,2 24,14 14,26 4,14"
          fill={recovered ? 'currentColor' : 'none'}
          fillOpacity={recovered ? 0.25 : 0}
          stroke={recovered ? '#d9af62' : 'currentColor'}
          strokeWidth="1.8"
        />
        {recovered && (
          <polygon points="14,7 19,14 14,21 9,14" fill="currentColor" />
        )}
      </svg>
    </span>
  );
}

const DUST_SPECS = [
  { left: '12%', top: '76%', delay: '0s', size: 3 },
  { left: '26%', top: '64%', delay: '1.2s', size: 2 },
  { left: '44%', top: '82%', delay: '2.4s', size: 3 },
  { left: '63%', top: '70%', delay: '0.8s', size: 2 },
  { left: '78%', top: '78%', delay: '3.1s', size: 3 },
  { left: '89%', top: '62%', delay: '1.9s', size: 2 },
];

export function AmbientDust() {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {DUST_SPECS.map((d, i) => (
        <span
          key={i}
          className="animate-dust absolute rounded-full bg-amber-200/45"
          style={{
            left: d.left,
            top: d.top,
            width: `${d.size}px`,
            height: `${d.size}px`,
            animationDelay: d.delay,
          }}
        />
      ))}
    </div>
  );
}
