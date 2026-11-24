import type { LevelId } from './progressionSystem';

export type ItemCategory = 'fragment' | 'key' | 'relic' | 'crystal';

export type ItemIconId = 'fragment' | 'key' | 'compass' | 'crystal' | 'relic';

export interface InventoryItemDefinition {
  id: string;
  name: string;
  description: string;
  iconId: ItemIconId;
  category: ItemCategory;
  levelOfOrigin: LevelId | 'global';
  loreText?: string;
}

export interface InventoryItem extends InventoryItemDefinition {
  quantity: number;
}

export const ANCIENT_FRAGMENTS: readonly InventoryItemDefinition[] = [
  {
    id: 'fragment-1',
    name: 'Echo of the Tides',
    description: 'First Ancient Fragment recovered from the Forgotten Shore.',
    iconId: 'fragment',
    category: 'fragment',
    levelOfOrigin: 'level1',
    loreText:
      'Carved when the islanders first charted the reefs, this fragment hums with the steady pull of moonlit tides and remembers safe harbor.',
  },
  {
    id: 'fragment-2',
    name: 'Echo of the Gale',
    description: 'Second Ancient Fragment recovered from the Whispering Woods.',
    iconId: 'fragment',
    category: 'fragment',
    levelOfOrigin: 'level2',
    loreText:
      'Kept beyond the rushing river gorge inside the ruined woodland shrine, it carried wind-currents across the valley before the Great Silence fell.',
  },
  {
    id: 'fragment-3',
    name: 'Echo of the Stars',
    description: 'Third Ancient Fragment housed inside The Sunken Kingdom.',
    iconId: 'fragment',
    category: 'fragment',
    levelOfOrigin: 'level3',
    loreText:
      'A prism-core carved by subterranean astronomers to remember the night sky from beneath the flooded temple vaults.',
  },
  {
    id: 'fragment-4',
    name: 'Echo of the Frost',
    description: 'Fourth Ancient Fragment sealed within The Frozen Peaks.',
    iconId: 'fragment',
    category: 'fragment',
    levelOfOrigin: 'level4',
    loreText:
      'Crystallized inside an aurora-lit glacier, this fragment preserved the builders’ sun-prisms and kept time suspended until the ancient seals could be mended.',
  },
  {
    id: 'fragment-5',
    name: 'Echo of Eternity',
    description: 'Fifth Ancient Fragment resting atop The Sky Temple.',
    iconId: 'fragment',
    category: 'fragment',
    levelOfOrigin: 'level5',
    loreText:
      'The keystone resonance of the Sky Temple that reunites all four elemental echoes and restores the living light across the archipelago.',
  },
];

export const ITEM_CATALOG: Record<string, InventoryItemDefinition> = {
  'crystal-shard': {
    id: 'crystal-shard',
    name: 'Resonant Crystal',
    description: 'Luminous energy shard scattered across the island.',
    iconId: 'crystal',
    category: 'crystal',
    levelOfOrigin: 'global',
  },
  'key-sanctuary': {
    id: 'key-sanctuary',
    name: 'Sunstone Vault Key',
    description: 'Ancient bronze key that unlocks the Forgotten Shore side vault.',
    iconId: 'key',
    category: 'key',
    levelOfOrigin: 'level1',
  },
  'relic-sunstone-compass': {
    id: 'relic-sunstone-compass',
    name: 'Sunstone Compass',
    description: 'A brass maritime relic hidden deep within the Sea Cave.',
    iconId: 'compass',
    category: 'relic',
    levelOfOrigin: 'level1',
  },
  'key-canopy': {
    id: 'key-canopy',
    name: 'Wind-Carved Key',
    description: 'Jade-inlaid key suspended above the Whispering Canopy.',
    iconId: 'key',
    category: 'key',
    levelOfOrigin: 'level2',
  },
  'relic-gale-chime': {
    id: 'relic-gale-chime',
    name: 'Gale Chime Relic',
    description: 'A resonant bronze wind-bell concealed inside the Whispering Woods Moss Grotto.',
    iconId: 'relic',
    category: 'relic',
    levelOfOrigin: 'level2',
  },
  'key-bronze': {
    id: 'key-bronze',
    name: 'Bronze Key',
    description: 'Heavy patinated key unlocking the Bronze Gate in The Sunken Kingdom.',
    iconId: 'key',
    category: 'key',
    levelOfOrigin: 'level3',
  },
  'relic-sunken-signet': {
    id: 'relic-sunken-signet',
    name: 'Sunken Crown Signet',
    description: 'Royal seal recovered from the floor of the drained Cistern Chamber.',
    iconId: 'relic',
    category: 'relic',
    levelOfOrigin: 'level3',
  },
  'relic-astrolabe-lens': {
    id: 'relic-astrolabe-lens',
    name: 'Abyssal Astrolabe',
    description: 'Polished quartz star-wheel salvaged from the sealed Western Vault.',
    iconId: 'compass',
    category: 'relic',
    levelOfOrigin: 'level3',
  },
  'relic-frostweave-mantle': {
    id: 'relic-frostweave-mantle',
    name: 'Frostweave Mantle',
    description: 'Woven silver-thread cloak found atop the Glacial Spire in The Frozen Peaks.',
    iconId: 'relic',
    category: 'relic',
    levelOfOrigin: 'level4',
  },
  'relic-aurora-prism': {
    id: 'relic-aurora-prism',
    name: 'Aurora Prism',
    description: 'Refractive ice-crystal lens sealed behind the cracked cavern wall.',
    iconId: 'compass',
    category: 'relic',
    levelOfOrigin: 'level4',
  },
  'key-sky': {
    id: 'key-sky',
    name: 'Sky Temple Key',
    description: 'Sun-forged key unlocking the Eastern Vault inside The Sky Temple.',
    iconId: 'key',
    category: 'key',
    levelOfOrigin: 'level5',
  },
  'relic-celestial-astrolabe': {
    id: 'relic-celestial-astrolabe',
    name: 'Celestial Astrolabe',
    description: 'Gilded star-chart recovered from the Western Floating Isle.',
    iconId: 'compass',
    category: 'relic',
    levelOfOrigin: 'level5',
  },
  'relic-dawnfire-diadem': {
    id: 'relic-dawnfire-diadem',
    name: 'Dawnfire Diadem',
    description: 'Golden-hour crown sealed inside the Eastern Sky Vault.',
    iconId: 'relic',
    category: 'relic',
    levelOfOrigin: 'level5',
  },
  // Legacy aliases kept for older saves
  'key-caldera': {
    id: 'key-caldera',
    name: 'Obsidian Seal Key',
    description: 'Ancient seal key from earlier expedition records.',
    iconId: 'key',
    category: 'key',
    levelOfOrigin: 'level4',
  },
  'relic-ember-core': {
    id: 'relic-ember-core',
    name: 'Ember Core',
    description: 'Contained geothermal crystal from earlier expedition records.',
    iconId: 'relic',
    category: 'relic',
    levelOfOrigin: 'level4',
  },
  'key-spire': {
    id: 'key-spire',
    name: 'Spire Keystone',
    description: 'Gilded keystone from earlier expedition records.',
    iconId: 'key',
    category: 'key',
    levelOfOrigin: 'level5',
  },
  'relic-eternity-diadem': {
    id: 'relic-eternity-diadem',
    name: 'Eternity Diadem',
    description: 'Ceremonial crown from earlier expedition records.',
    iconId: 'relic',
    category: 'relic',
    levelOfOrigin: 'level5',
  },
  'relic-test-waystone': {
    id: 'relic-test-waystone',
    name: 'Explorer Waystone',
    description: 'A ceremonial surveyor stone inscribed with island coordinates.',
    iconId: 'relic',
    category: 'relic',
    levelOfOrigin: 'global',
  },
  ...Object.fromEntries(ANCIENT_FRAGMENTS.map((frag) => [frag.id, frag])),
};

export function resolveItemDefinition(
  idOrName: string,
  overrides?: Partial<InventoryItemDefinition>,
): InventoryItemDefinition {
  const byId = ITEM_CATALOG[idOrName];
  if (byId) {
    return overrides ? { ...byId, ...overrides } : byId;
  }

  const byName = Object.values(ITEM_CATALOG).find(
    (entry) => entry.name.toLowerCase() === idOrName.toLowerCase(),
  );
  if (byName) {
    return overrides ? { ...byName, ...overrides } : byName;
  }

  return {
    id: idOrName,
    name: overrides?.name ?? idOrName,
    description:
      overrides?.description ?? 'Recovered artifact from the lost island.',
    iconId: overrides?.iconId ?? 'relic',
    category: overrides?.category ?? 'relic',
    levelOfOrigin: overrides?.levelOfOrigin ?? 'level1',
    loreText: overrides?.loreText,
  };
}

export function addItemToInventory(
  inventory: InventoryItem[],
  idOrName: string,
  amount = 1,
  overrides?: Partial<InventoryItemDefinition>,
): InventoryItem[] {
  const def = resolveItemDefinition(idOrName, overrides);
  const existingIndex = inventory.findIndex((item) => item.id === def.id);
  if (existingIndex === -1) {
    return [...inventory, { ...def, quantity: Math.max(1, amount) }];
  }

  // Fragments and unique keys/relics stay singular unless stackable crystals
  const existing = inventory[existingIndex];
  const nextQuantity =
    def.category === 'crystal'
      ? existing.quantity + Math.max(1, amount)
      : def.category === 'key'
        ? existing.quantity + Math.max(1, amount)
        : existing.quantity;

  if (nextQuantity === existing.quantity) {
    return inventory;
  }

  return inventory.map((item, idx) =>
    idx === existingIndex ? { ...item, quantity: nextQuantity } : item,
  );
}

export function consumeItemFromInventory(
  inventory: InventoryItem[],
  itemId: string,
  amount = 1,
): { nextInventory: InventoryItem[]; consumed: boolean } {
  const idx = inventory.findIndex((item) => item.id === itemId);
  if (idx === -1) {
    return { nextInventory: inventory, consumed: false };
  }

  const current = inventory[idx];
  const remaining = current.quantity - amount;
  if (remaining <= 0) {
    return {
      nextInventory: inventory.filter((item) => item.id !== itemId),
      consumed: true,
    };
  }

  return {
    nextInventory: inventory.map((item, i) =>
      i === idx ? { ...item, quantity: remaining } : item,
    ),
    consumed: true,
  };
}

export function hasInventoryItem(
  inventory: InventoryItem[],
  itemId: string,
): boolean {
  return inventory.some((item) => item.id === itemId && item.quantity > 0);
}
