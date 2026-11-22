export interface WebGLSupportInfo {
  supported: boolean;
  version: 'webgl2' | 'webgl1' | 'none';
  renderer: string;
  reason?: string;
}

export function detectWebGLSupport(): WebGLSupportInfo {
  if (typeof document === 'undefined') {
    return { supported: true, version: 'webgl2', renderer: 'SSR' };
  }

  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (gl2) {
      const ext = gl2.getExtension('WEBGL_debug_renderer_info');
      const renderer = String(
        gl2.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl2.RENDERER) ??
          'WebGL2',
      );
      gl2.getExtension('WEBGL_lose_context')?.loseContext();
      return { supported: true, version: 'webgl2', renderer };
    }

    const gl1 = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (gl1) {
      const ext = gl1.getExtension('WEBGL_debug_renderer_info');
      const renderer = String(
        gl1.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl1.RENDERER) ??
          'WebGL1',
      );
      gl1.getExtension('WEBGL_lose_context')?.loseContext();
      return { supported: true, version: 'webgl1', renderer };
    }

    return {
      supported: false,
      version: 'none',
      renderer: 'Unavailable',
      reason: 'Browser returned null for both WebGL2 and WebGL1 contexts.',
    };
  } catch (err) {
    return {
      supported: false,
      version: 'none',
      renderer: 'Unavailable',
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
