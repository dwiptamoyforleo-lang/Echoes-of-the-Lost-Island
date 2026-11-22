export interface GameEventMap {
  'player:interact': undefined;
  'player:respawn': { position: [number, number, number] };
  'switch:toggled': { id: string; active: boolean };
  'plate:changed': { id: string; active: boolean };
  'chest:opened': { id: string; reward: string };
  'key:collected': { id: string; label: string };
  'door:unlocked': { id: string; keyId?: string };
  'crystal:collected': { id: string; total: number };
  'fragment:collected': { id: string; name: string };
  'checkpoint:reached': { id: string; position: [number, number, number] };
  'trigger:entered': { id: string };
  'objective:completed': { id: string; description: string };
  'game:saved': { manual: boolean };
}

type EventKey = keyof GameEventMap;
type Listener<K extends EventKey> = (payload: GameEventMap[K]) => void;

const listeners = new Map<EventKey, Set<Listener<never>>>();

export const eventBus = {
  on<K extends EventKey>(event: K, listener: Listener<K>): () => void {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => {
      set?.delete(listener as Listener<never>);
    };
  },

  emit<K extends EventKey>(
    event: K,
    ...args: GameEventMap[K] extends undefined ? [] : [payload: GameEventMap[K]]
  ): void {
    const set = listeners.get(event);
    if (!set) return;
    const payload = args[0] as GameEventMap[K];
    for (const fn of set) {
      (fn as Listener<K>)(payload);
    }
  },

  clear(): void {
    listeners.clear();
  },
};
