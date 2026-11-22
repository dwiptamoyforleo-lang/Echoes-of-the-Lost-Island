import { useEffect } from 'react';
import { GameCanvas } from '@/src/components/GameCanvas';
import { useGameStore } from '@/src/state/gameStore';
import {
  CreditsScreen,
  DebugOverlay,
  GameHud,
  InventoryScreen,
  LoadingOverlay,
  QaAcceptanceOverlay,
  QuestLogScreen,
  SettingsScreen,
  StartScreen,
  StatusOverlay,
  StorySequenceScreen,
  SystemsDebugPanel,
  WorldMapScreen,
} from '@/src/ui';

export default function App() {
  const screen = useGameStore((state) => state.screen);

  useEffect(() => {
    document.body.dataset.state = screen;
  }, [screen]);

  useEffect(() => {
    if (screen !== 'playing') return;
    const timer = window.setInterval(() => {
      useGameStore.getState().tickPlaytime(1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  return (
    <main
      className="relative h-screen w-screen overflow-hidden"
      data-testid="game-viewport"
      aria-label="Echoes of the Lost Island 3D Viewport"
    >
      <GameCanvas />
      <StartScreen />
      <WorldMapScreen />
      <SettingsScreen />
      <CreditsScreen />
      <StorySequenceScreen />
      <GameHud />
      <InventoryScreen />
      <QuestLogScreen />
      <StatusOverlay />
      <DebugOverlay />
      <SystemsDebugPanel />
      <QaAcceptanceOverlay />
      <LoadingOverlay />
    </main>
  );
}
