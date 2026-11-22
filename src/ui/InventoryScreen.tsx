import { useState } from 'react';
import { useGameStore } from '@/src/state/gameStore';
import type { ItemCategory } from '@/src/systems/inventorySystem';
import { ItemIcon } from './ItemIcon';
import { RuneCorner, RuneDivider } from './RuneOrnaments';

type CategoryFilter = 'all' | ItemCategory;

const CATEGORIES: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fragment', label: 'Fragments' },
  { id: 'relic', label: 'Relics' },
  { id: 'key', label: 'Keys' },
  { id: 'crystal', label: 'Crystals' },
];

export function InventoryScreen() {
  const activeOverlay = useGameStore((s) => s.activeOverlay);
  const setActiveOverlay = useGameStore((s) => s.setActiveOverlay);
  const inventoryItems = useGameStore((s) => s.inventoryItems);

  const [category, setCategory] = useState<CategoryFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (activeOverlay !== 'inventory') return null;

  const filtered =
    category === 'all'
      ? inventoryItems
      : inventoryItems.filter((item) => item.category === category);

  const selectedItem =
    filtered.find((i) => i.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-6"
      style={{ backgroundColor: 'rgba(10, 16, 18, 0.78)' }}
      data-testid="inventory-screen"
    >
      <div
        className="stone-panel animate-panel-in relative flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-md p-5 sm:p-6"
        role="dialog"
        aria-label="Explorer Inventory"
      >
        <RuneCorner className="pointer-events-none absolute top-1.5 left-1.5" />
        <RuneCorner className="pointer-events-none absolute top-1.5 right-1.5 rotate-90" />

        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-[#f7ebd2]">
              Explorer Satchel
            </h2>
            <p className="text-xs text-[#b8aa8e]">
              Recovered fragments, keys, relics, and resonant crystals · Press I, Tab, or Esc to close
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              setActiveOverlay('none');
            }}
            className="stone-btn rounded px-3.5 py-1.5 text-xs font-semibold"
          >
            Close
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="mb-4 flex flex-wrap gap-1.5 border-b border-[#c79d52]/25 pb-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                category === cat.id
                  ? 'bronze-btn'
                  : 'stone-btn'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grid + Detail Inspector */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto md:grid-cols-[1.2fr_1fr]">
          <div className="grid content-start grid-cols-2 gap-2.5 sm:grid-cols-3">
            {filtered.length === 0 ? (
              <p className="col-span-full py-10 text-center text-xs text-[#a99b80]">
                No items recorded in this category yet.
              </p>
            ) : (
              filtered.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    data-testid={`inv-item-${item.id}`}
                    className={`flex flex-col items-center gap-2 rounded border p-3 text-center transition-colors ${
                      isSelected
                        ? 'border-[#e0b86b] bg-[#213335]'
                        : 'border-[#c79d52]/25 bg-[#151b1d]/85 hover:border-[#c79d52]/55'
                    }`}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded border border-[#c79d52]/30 bg-[#0e1314]">
                      <ItemIcon iconId={item.iconId} className="h-6 w-6" />
                    </div>
                    <div className="w-full truncate text-xs font-semibold text-[#f3e7cf]">
                      {item.name}
                    </div>
                    <div className="font-mono text-[10px] text-[#b4a68b] tabular-nums">
                      {item.quantity > 1 ? `Qty ${item.quantity}` : item.category}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex flex-col gap-3 rounded border border-[#c79d52]/30 bg-[#121819]/90 p-4">
            {selectedItem ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-[#c79d52]/40 bg-[#0d1213]">
                    <ItemIcon
                      iconId={selectedItem.iconId}
                      className="h-7 w-7"
                    />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-[#f7ebd2]">
                      {selectedItem.name}
                    </h3>
                    <p className="text-[11px] text-[#c79d52]">
                      {selectedItem.category} · Origin: {selectedItem.levelOfOrigin}
                      {selectedItem.quantity > 1
                        ? ` · Qty ${selectedItem.quantity}`
                        : ''}
                    </p>
                  </div>
                </div>

                <RuneDivider />

                <p className="text-xs leading-relaxed text-[#dfd3b8]">
                  {selectedItem.description}
                </p>

                {selectedItem.loreText && (
                  <div className="parchment-panel mt-1 rounded p-3 text-xs italic leading-relaxed">
                    “{selectedItem.loreText}”
                  </div>
                )}
              </>
            ) : (
              <p className="py-8 text-center text-xs text-[#a99b80]">
                Select an artifact from your satchel to inspect its inscription and lore.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
