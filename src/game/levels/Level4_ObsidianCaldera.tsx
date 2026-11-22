import {
  ExpeditionLevelTemplate,
  type ExpeditionLevelConfig,
} from './ExpeditionLevelTemplate';
import { getCalderaHeight } from './levelTerrainFactory';

const CONFIG: ExpeditionLevelConfig = {
  levelId: 'level4',
  welcomeToast: 'Entered Obsidian Caldera · Unseal the geothermal conduits',
  sanctumY: 5.0,
  stairBaseY: 3.2,
  stoneColor: '#5c504d',
  wallColor: '#443a38',
  accentColor: '#fb923c',
  entryChunkId: 'l4-trail',
  westChunkId: 'l4-west-ridge',
  eastChunkId: 'l4-ember-chamber',
  northChunkId: 'l4-hearth',
  westSwitch: {
    id: 'l4-switch-west',
    label: 'Thermal Vent Seal',
    pos: [-22, getCalderaHeight(-22, 0), 0],
  },
  eastSwitch: {
    id: 'l4-switch-east',
    label: 'Obsidian Forge Seal',
    pos: [22, getCalderaHeight(22, -4), -4],
  },
  plate: { id: 'l4-plate-hearth', label: 'Basalt Pressure Seal' },
  ferry: {
    id: 'l4-ferry-basalt',
    from: [10.0, 3.4, -2.0],
    to: [18.5, 3.6, -3.5],
    speed: 0.45,
  },
  chest: {
    id: 'chest-caldera',
    pos: [-22, getCalderaHeight(-22, -12), -12],
    rewardItem: 'Ember Core',
  },
  keyItem: {
    id: 'key-caldera',
    label: 'Obsidian Seal Key',
    pos: [19, getCalderaHeight(19, 7) + 0.85, 7],
  },
  inscription: {
    id: 'inscription-caldera',
    title: 'Treatise of the Caldera Hearth',
    body: 'Vent the western ridge, cross the basalt chasm to spark the Obsidian Forge Seal, and rest a rune block upon the Basalt Pressure Seal.',
  },
  fragment: { id: 'fragment-4', name: 'Echo of the Ember' },
  checkpointEastLabel: 'Obsidian Forge Ledge',
  checkpointNorthLabel: 'Caldera Hearth Courtyard',
  seedOffset: 4000,
};

export function Level4_ObsidianCaldera() {
  return <ExpeditionLevelTemplate config={CONFIG} />;
}

export default Level4_ObsidianCaldera;
