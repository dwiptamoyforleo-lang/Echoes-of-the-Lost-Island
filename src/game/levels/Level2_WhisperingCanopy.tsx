import {
  ExpeditionLevelTemplate,
  type ExpeditionLevelConfig,
} from './ExpeditionLevelTemplate';
import { getCanopyHeight } from './levelTerrainFactory';

const CONFIG: ExpeditionLevelConfig = {
  levelId: 'level2',
  welcomeToast: 'Entered Whispering Canopy · Awaken the wind seals',
  sanctumY: 5.2,
  stairBaseY: 3.4,
  stoneColor: '#6f8572',
  wallColor: '#566b5b',
  accentColor: '#34d399',
  entryChunkId: 'l2-entry',
  westChunkId: 'l2-west-boughs',
  eastChunkId: 'l2-east-bridge',
  northChunkId: 'l2-wind-shrine',
  westSwitch: {
    id: 'l2-switch-west',
    label: 'West Bough Chime',
    pos: [-22, getCanopyHeight(-22, 2), 2],
  },
  eastSwitch: {
    id: 'l2-switch-east',
    label: 'East Gale Seal',
    pos: [22, getCanopyHeight(22, 0), 0],
  },
  plate: { id: 'l2-plate-shrine', label: 'Canopy Stone Seal' },
  ferry: {
    id: 'l2-ferry-bridge',
    from: [10.5, 3.6, 1.5],
    to: [18.5, 4.9, 0.5],
    speed: 0.44,
  },
  chest: {
    id: 'chest-canopy',
    pos: [-22, getCanopyHeight(-22, -12), -12],
    rewardItem: 'Gale Chime Relic',
  },
  keyItem: {
    id: 'key-canopy',
    label: 'Wind-Carved Key',
    pos: [21, getCanopyHeight(21, 9) + 0.85, 9],
  },
  inscription: {
    id: 'inscription-canopy',
    title: 'Hymn of the Whispering Canopy',
    body: 'Ring the West Bough Chime, cross the suspended bridge to ignite the East Gale Seal, and weight the Canopy Stone Seal before the sanctum gate.',
  },
  fragment: { id: 'fragment-2', name: 'Echo of the Gale' },
  checkpointEastLabel: 'Suspended Wind Bridge',
  checkpointNorthLabel: 'Canopy Shrine Plaza',
  seedOffset: 2000,
};

export function Level2_WhisperingCanopy() {
  return <ExpeditionLevelTemplate config={CONFIG} />;
}

export default Level2_WhisperingCanopy;
