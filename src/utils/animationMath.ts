export type IntroPhase = 'loading' | 'intro' | 'ready';

/**
 * Clamp value to [min, max]
 */
export function eb(val: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, val));
}

export const clamp = eb;

/**
 * Normalized progress of `val` across `[start, end]` clamped to `[0, 1]`
 */
export function ed(val: number, start: number, end: number): number {
  if (end === start) return val >= end ? 1 : 0;
  return eb((val - start) / (end - start), 0, 1);
}

/**
 * Cubic ease-out `1 - (1 - t)^3`
 */
export function eh(t: number): number {
  const x = eb(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

/**
 * Cubic ease-in-out / GSAP power3.inOut
 */
export function ep(t: number): number {
  const x = eb(t, 0, 1);
  return x < 0.5 ? 4 * Math.pow(x, 3) : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export const power3InOut = ep;

export interface CameraFraming {
  aspect: number;
  isMobilePortrait: boolean;
  halfFovTan: number;
  camZ: number;
  worldH: number;
  worldW: number;
}

/**
 * Camera framing (`fov = 28` deg) for Desktop Landscape and Mobile Portrait
 */
export function computeCameraFraming(
  width: number,
  height: number,
  fovDeg = 28,
): CameraFraming {
  const aspect = Math.max(0.1, width / Math.max(1, height));
  const isMobilePortrait = aspect < 1;
  const halfFovTan = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  const camZ = Math.max(
    2.05 / (0.9 * halfFovTan),
    1 / (1.1 * halfFovTan * aspect),
  );
  const worldH = 2 * camZ * halfFovTan;
  const worldW = worldH * aspect;
  return { aspect, isMobilePortrait, halfFovTan, camZ, worldH, worldW };
}

export interface ReferenceIntroStep {
  l: number; // elapsed seconds after loading completes (< 0 while loading)
  phase: IntroPhase;
  spinProgress: number; // t: 0 -> 1 over l in [0, 1.0]
  unfoldProgress: number; // c: 0 -> 1 over l in [0.85, 1.75]
  foldActionNormalized: number; // 1 - c (1 = closed, 0 = open)
  innerScreenProgress: number; // b: 0 -> 1 over l in [1.4, 2.2]
  zoomProgress: number; // h: 0 -> 1 over l in [2.75, 3.45] with cubic easing
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  isFullScreenZoomed: boolean;
}

/**
 * Computes the deterministic animation state at intro time `l`.
 * On Mobile Portrait (`isMobilePortrait = true`), the phone starts folded upright
 * and rotates 90 degrees (`Math.PI / 2`) around Z as it unfolds (`0.85s -> 1.75s`)
 * so the unfolded screen sits in vertical Portrait orientation.
 */
export function computeReferenceIntroStep(
  l: number,
  elapsedTotalSec = 0,
  startAngleY = Math.PI,
  reducedMotion = false,
  isMobilePortrait = false,
): ReferenceIntroStep {
  const phase: IntroPhase = l < 0 ? 'loading' : l < 3.45 ? 'intro' : 'ready';
  const t = l < 0 ? 0 : ep(ed(l, 0, 1));
  const idleAngleY =
    Math.PI + (reducedMotion ? 0 : 0.42 * Math.sin(0.8 * elapsedTotalSec));
  const rotationY =
    l < 0 ? idleAngleY : startAngleY + (2 * Math.PI - startAngleY) * t;
  const rotationX = -0.1 * (1 - t) || 0;

  const c = l < 0 ? 0 : ep(ed(l, 0.85, 1.75));
  const foldActionNormalized = 1 - c;
  const portraitZ = isMobilePortrait ? c * (Math.PI / 2) : 0;
  const rotationZ = -0.05 * (1 - t) + portraitZ || 0;

  const b = l < 0 ? 0 : ed(l, 1.4, 2.2);
  const h = l < 0 ? 0 : Math.pow(ed(l, 2.75, 3.45), 3);

  return {
    l,
    phase,
    spinProgress: t,
    unfoldProgress: c,
    foldActionNormalized,
    innerScreenProgress: b,
    zoomProgress: h,
    rotationX,
    rotationY,
    rotationZ,
    isFullScreenZoomed: h >= 1,
  };
}

/**
 * Computes the exact full-screen zoom distance `f` from the inner screen center
 * `(0, 0.05885, 0.0026)` so the unfolded screen covers 100vw x 100vh on both
 * Desktop Landscape (unfolded width 0.1586, height 0.1109) and
 * Mobile Portrait 90° rotated (unfolded width 0.1109, height 0.1586).
 */
export function computeInnerScreenZoomDistance(
  phoneScale: number,
  aspect: number,
  halfFovTan: number,
  isMobilePortrait = false,
): number {
  const screenWorldH = (isMobilePortrait ? 0.1586 : 0.1109) * phoneScale;
  const screenWorldW = (isMobilePortrait ? 0.1109 : 0.1586) * phoneScale;
  return Math.min(screenWorldH, screenWorldW / aspect) / (2 * halfFovTan);
}
