import type { ItemIconId } from '@/src/systems/inventorySystem';

export function ItemIcon({
  iconId,
  className = 'h-5 w-5',
}: {
  iconId: ItemIconId;
  className?: string;
}) {
  switch (iconId) {
    case 'fragment':
      return (
        <svg viewBox="0 0 24 24" className={`${className} text-teal-300`} aria-hidden="true">
          <polygon
            points="12,2 20,12 12,22 4,12"
            fill="currentColor"
            fillOpacity="0.28"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <polygon points="12,6 16,12 12,18 8,12" fill="currentColor" />
        </svg>
      );
    case 'key':
      return (
        <svg viewBox="0 0 24 24" className={`${className} text-amber-300`} aria-hidden="true">
          <circle
            cx="7.5"
            cy="12"
            r="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M11.5 12H21M17 12v4M20 12v3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'compass':
      return (
        <svg viewBox="0 0 24 24" className={`${className} text-amber-200`} aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="currentColor"
            fillOpacity="0.15"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <polygon points="12,6 15,12 12,18 9,12" fill="currentColor" />
        </svg>
      );
    case 'crystal':
      return (
        <svg viewBox="0 0 24 24" className={`${className} text-sky-300`} aria-hidden="true">
          <polygon
            points="12,2 19,10 12,22 5,10"
            fill="currentColor"
            fillOpacity="0.35"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      );
    case 'relic':
    default:
      return (
        <svg viewBox="0 0 24 24" className={`${className} text-emerald-300`} aria-hidden="true">
          <rect
            x="5"
            y="5"
            width="14"
            height="14"
            rx="3"
            fill="currentColor"
            fillOpacity="0.2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      );
  }
}
