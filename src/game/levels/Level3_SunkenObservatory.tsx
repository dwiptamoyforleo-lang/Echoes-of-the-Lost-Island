import {
  ExpeditionLevelTemplate,
  type ExpeditionLevelConfig,
} from './ExpeditionLevelTemplate';
import { getObservatoryHeight } from './levelTerrainFactory';

const CONFIG: ExpeditionLevelConfig = {
  levelId: 'level3',
  welcomeToast: 'Entered Sunken Observatory · Align the tidal seals',
  sanctumY: 4.6,
  stairBaseY: 2.8,
  stoneColor: '#6b8291',
  wallColor: '#526878',
  accentColor: '#60a5fa',
  entryChunkId: 'l3-causeway',
  westChunkId: 'l3-lens-west',
  eastChunkId: 'l3-vault-east',
  northChunkId: 'l3-star-sanctum',
  westSwitch: {
    id: 'l3-switch-west',
    label: 'Western Lens Seal',
    pos: [-22, getObservatoryHeight(-22, 2), 2],
  },
  eastSwitch: {
    id: 'l3-switch-east',
    label: 'Astrolabe Seal',
    pos: [22, getObservatoryHeight(22, -4), -4],
  },
  plate: { id: 'l3-plate-star', label: 'Starlight Counterweight' },
  ferry: {
    id: 'l3-ferry-tidal',
    from: [10.0, 2.9, -2.0],
    to: [18.5, 3.3, -3.5],
    speed: 0.4,
  },
  chest: {
    id: 'chest-observatory',
    pos: [-22, getObservatoryHeight(-22, -12), -12],
    rewardItem: 'Astrolabe Lens',
  },
  keyItem: {
    id: 'key-observatory',
    label: 'Tidal Vault Key',
    pos: [20, getObservatoryHeight(20, 8) + 0.85, 8],
  },
  inscription: {
    id: 'inscription-observatory',
    title: 'Ledger of the Sunken Lenses',
    body: 'Awaken the Western Lens Seal and the Astrolabe Seal across the flooded eastern deck, then balance a rune block upon the Starlight Counterweight.',
  },
  fragment: { id: 'fragment-3', name: 'Echo of the Stars' },
  checkpointEastLabel: 'Flooded Astrolabe Deck',
  checkpointNorthLabel: 'Observatory Forecourt',
  seedOffset: 3000,
};

export function Level3_SunkenObservatory() {
  return <ExpeditionLevelTemplate config={CONFIG} />;
}

export default Level3_SunkenObservatory;
