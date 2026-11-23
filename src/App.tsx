import { useEffect } from 'react';
import { AppErrorBoundary } from '@/src/components/AppErrorBoundary';
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

    const preventContext = (e: Event) => {
      const st = useGameStore.getState();
      if (st.activeOverlay === 'none' && !st.activeInscription) {
        e.preventDefault();
      }
    };
    const preventMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', preventContext);
    window.addEventListener('gesturestart', preventContext);
    window.addEventListener('touchmove', preventMultiTouch, { passive: false });

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('contextmenu', preventContext);
      window.removeEventListener('gesturestart', preventContext);
      window.removeEventListener('touchmove', preventMultiTouch);
    };
  }, [screen]);

  return (
    <main
      className="relative h-screen w-screen overflow-hidden"
      data-testid="game-viewport"
      aria-label="Echoes of the Lost Island 3D Viewport"
    >
      <AppErrorBoundary scope="canvas">
        <GameCanvas />
      </AppErrorBoundary>
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
