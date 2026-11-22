import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

let cachedIsSoftwareGl: boolean | null = null;

export function detectSoftwareGl(): boolean {
  if (cachedIsSoftwareGl !== null) {
    return cachedIsSoftwareGl;
  }
  if (typeof document === 'undefined') {
    cachedIsSoftwareGl = false;
    return false;
  }

  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) {
      cachedIsSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const rendererString = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedIsSoftwareGl =
      /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
        rendererString,
      );
  } catch {
    cachedIsSoftwareGl = false;
  }

  return cachedIsSoftwareGl;
}

export function SoftwareGlPacer({ enabled }: { enabled: boolean }) {
  const { gl, invalidate } = useThree();
  const timerRef = useRef<number>(0);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    invalidate();
    return () => {
      window.clearTimeout(timerRef.current);
      busyRef.current = false;
    };
  }, [enabled, invalidate]);

  useFrame((state) => {
    if (!enabled) return;

    state.gl.render(state.scene, state.camera);

    if (busyRef.current) return;
    busyRef.current = true;

    const context = gl.getContext() as WebGL2RenderingContext;
    const sync =
      typeof context.fenceSync === 'function'
        ? context.fenceSync(context.SYNC_GPU_COMMANDS_COMPLETE, 0)
        : null;
    context.flush();

    const poll = () => {
      const status =
        sync && typeof context.getSyncParameter === 'function'
          ? context.getSyncParameter(sync, context.SYNC_STATUS)
          : context.SIGNALED;
      if (status === context.UNSIGNALED) {
        timerRef.current = window.setTimeout(poll, 5);
      } else {
        if (sync && typeof context.deleteSync === 'function') {
          context.deleteSync(sync);
        }
        timerRef.current = window.setTimeout(() => {
          busyRef.current = false;
          invalidate();
        }, 80);
      }
    };

    timerRef.current = window.setTimeout(poll, 5);
  }, 1);

  return null;
}
