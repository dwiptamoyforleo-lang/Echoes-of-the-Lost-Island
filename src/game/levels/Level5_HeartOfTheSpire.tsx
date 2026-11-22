import {
  ExpeditionLevelTemplate,
  type ExpeditionLevelConfig,
} from './ExpeditionLevelTemplate';
import { getSpireHeight } from './levelTerrainFactory';

const CONFIG: ExpeditionLevelConfig = {
  levelId: 'level5',
  welcomeToast: 'Ascended to Heart of the Spire · Reunite the final Echo',
  sanctumY: 5.6,
  stairBaseY: 3.4,
  stoneColor: '#929aa4',
  wallColor: '#767f8c',
  accentColor: '#e879f9',
  entryChunkId: 'l5-steps',
  westChunkId: 'l5-echo-west',
  eastChunkId: 'l5-echo-east',
  northChunkId: 'l5-summit',
  westSwitch: {
    id: 'l5-switch-west',
    label: 'Western Resonance',
    pos: [-22, getSpireHeight(-22, 1), 1],
  },
  eastSwitch: {
    id: 'l5-switch-east',
    label: 'Eastern Resonance',
    pos: [22, getSpireHeight(22, 1), 1],
  },
  plate: { id: 'l5-plate-summit', label: 'Keystone Seal' },
  ferry: {
    id: 'l5-ferry-sky',
    from: [10.0, 3.8, 1.5],
    to: [18.5, 4.7, 1.0],
    speed: 0.42,
  },
  chest: {
    id: 'chest-spire',
    pos: [-22, getSpireHeight(-22, -12), -12],
    rewardItem: 'Eternity Diadem',
  },
  keyItem: {
    id: 'key-spire',
    label: 'Spire Keystone',
    pos: [20, getSpireHeight(20, 9) + 0.85, 9],
  },
  inscription: {
    id: 'inscription-spire',
    title: 'Vow of the Five Echoes',
    body: 'Harmonize the Western and Eastern Resonances flanking the summit, and weight the Keystone Seal to awaken the Echo of Eternity.',
  },
  fragment: { id: 'fragment-5', name: 'Echo of Eternity' },
  checkpointEastLabel: 'Eastern Resonance Terrace',
  checkpointNorthLabel: 'Spire Summit Forecourt',
  seedOffset: 5000,
};

export function Level5_HeartOfTheSpire() {
  return <ExpeditionLevelTemplate config={CONFIG} />;
}

export default Level5_HeartOfTheSpire;
