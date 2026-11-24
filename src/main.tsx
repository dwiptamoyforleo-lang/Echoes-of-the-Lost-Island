import { createRoot } from 'react-dom/client';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { detectWebGLSupport } from './game/rendering/webglSupport';
import App from './App.tsx';
import './index.css';

const webgl = detectWebGLSupport();
console.info(
  `[Journey Home] v1.0.0 | base=${import.meta.env.BASE_URL} | webgl=${webgl.version} (${webgl.renderer}) | rapier=pending`,
);

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary attachGlobalListeners>
    <App />
  </AppErrorBoundary>,
);
