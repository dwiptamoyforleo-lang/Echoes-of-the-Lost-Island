import { useEffect } from 'react';
import { GAME_TITLE } from '@/src/config/gameInfo';
import { AppErrorBoundary } from '@/src/components/AppErrorBoundary';
import { GameCanvas } from '@/src/components/GameCanvas';
import { useGameStore } from '@/src/state/gameStore';
import { initAudioLifecycle, syncAudioScene } from '@/src/systems/audioSystem';
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
  const activeLevel = useGameStore((state) => state.activeLevel);

  useEffect(() => {
    return initAudioLifecycle();
  }, []);

  useEffect(() => {
    syncAudioScene(screen, activeLevel);
  }, [screen, activeLevel]);

  useEffect(() => {
    document.body.dataset.state = screen;
    document.documentElement.dataset.state = screen;
  }, [screen]);

  useEffect(() => {
    const preventContext = (e: Event) => {
      const st = useGameStore.getState();
      if (st.screen === 'playing' && st.activeOverlay === 'none' && !st.activeInscription) {
        e.preventDefault();
      }
    };
    const preventGesture = (e: Event) => {
      if (useGameStore.getState().screen === 'playing') {
        e.preventDefault();
      }
    };
    const preventTouchScrollOrPinch = (e: TouchEvent) => {
      const st = useGameStore.getState();
      if (st.screen !== 'playing') return;
      if (e.touches.length > 1) {
        e.preventDefault();
        return;
      }
      if (st.activeOverlay === 'none' && !st.activeInscription) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', preventContext);
    window.addEventListener('gesturestart', preventGesture);
    window.addEventListener('gesturechange', preventGesture);
    window.addEventListener('gestureend', preventGesture);
    document.addEventListener('touchmove', preventTouchScrollOrPinch, {
      passive: false,
    });

    if (screen !== 'playing') {
      return () => {
        window.removeEventListener('contextmenu', preventContext);
        window.removeEventListener('gesturestart', preventGesture);
        window.removeEventListener('gesturechange', preventGesture);
        window.removeEventListener('gestureend', preventGesture);
        document.removeEventListener('touchmove', preventTouchScrollOrPinch);
      };
    }

    const timer = window.setInterval(() => {
      useGameStore.getState().tickPlaytime(1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('contextmenu', preventContext);
      window.removeEventListener('gesturestart', preventGesture);
      window.removeEventListener('gesturechange', preventGesture);
      window.removeEventListener('gestureend', preventGesture);
      document.removeEventListener('touchmove', preventTouchScrollOrPinch);
    };
  }, [screen]);

  return (
    <main
      className="relative h-dvh w-screen overflow-hidden"
      data-testid="game-viewport"
      aria-label={`${GAME_TITLE} 3D Viewport`}
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
