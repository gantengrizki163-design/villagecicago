import { useEffect, useState } from 'react';

export interface ViewportMode {
  width: number;
  height: number;
  /** Layar HP portrait (< 640px) atau layar pendek landscape (<= 520px tinggi) */
  isCompactHud: boolean;
  /** Mode landscape pada HP / layar pendek (lebar > tinggi dan tinggi <= 520px) */
  isMobileLandscape: boolean;
  /** Perangkat sentuh / layar kecil yang menampilkan joystick & kontrol sentuh */
  showTouchControls: boolean;
}

function readViewportMode(): ViewportMode {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      height: 720,
      isCompactHud: false,
      isMobileLandscape: false,
      showTouchControls: false,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobileLandscape = width > height && height <= 520;
  const isCompactHud = width < 640 || isMobileLandscape;
  const isCoarsePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const showTouchControls = width < 768 || isMobileLandscape || isCoarsePointer;

  return {
    width,
    height,
    isCompactHud,
    isMobileLandscape,
    showTouchControls,
  };
}

export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(readViewportMode);

  useEffect(() => {
    const update = () => setMode(readViewportMode());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return mode;
}
