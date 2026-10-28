import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eb,
  ed,
  eh,
  ep,
  computeCameraFraming,
  computeReferenceIntroStep,
  computeInnerScreenZoomDistance,
} from './animationMath';

test('Phase 1 (l < 0): loading state keeps phone folded (foldActionNormalized = 1) and angled on back side', () => {
  const step = computeReferenceIntroStep(-0.5, 0.4, Math.PI, false, false);
  assert.equal(step.phase, 'loading');
  assert.equal(step.spinProgress, 0);
  assert.equal(step.unfoldProgress, 0);
  assert.equal(step.foldActionNormalized, 1);
  assert.equal(step.innerScreenProgress, 0);
  assert.equal(step.zoomProgress, 0);
  assert.equal(step.isFullScreenZoomed, false);
  assert.ok(Math.abs(step.rotationX - -0.1) < 1e-6);
  assert.ok(Math.abs(step.rotationZ - -0.05) < 1e-6);
});

test('Phase 2 Desktop (0 <= l <= 2.2): spins to front outer screen, unfolds hinge flat horizontally (rotationZ = 0)', () => {
  const frontMoment = computeReferenceIntroStep(0.85, 1.85, Math.PI, false, false);
  assert.equal(frontMoment.phase, 'intro');
  assert.ok(frontMoment.spinProgress > 0.85);
  assert.equal(frontMoment.unfoldProgress, 0);

  const unfoldedDesktop = computeReferenceIntroStep(2.2, 3.2, Math.PI, false, false);
  assert.equal(unfoldedDesktop.unfoldProgress, 1);
  assert.equal(unfoldedDesktop.foldActionNormalized, 0);
  assert.equal(unfoldedDesktop.rotationZ, 0);
  assert.equal(unfoldedDesktop.innerScreenProgress, 1);
});

test('Phase 2 Mobile Portrait (0 <= l <= 2.2): starts folded upright, then rotates 90 deg (Math.PI / 2) into portrait mode as it unfolds', () => {
  const foldedMobile = computeReferenceIntroStep(0.85, 1.85, Math.PI, false, true);
  assert.equal(foldedMobile.unfoldProgress, 0);
  assert.ok(Math.abs(foldedMobile.rotationZ) < 0.01, 'Before unfolding (l = 0.85s), mobile phone is upright (rotationZ ~ 0)');

  const unfoldedMobile = computeReferenceIntroStep(2.2, 3.2, Math.PI, false, true);
  assert.equal(unfoldedMobile.unfoldProgress, 1);
  assert.ok(
    Math.abs(unfoldedMobile.rotationZ - Math.PI / 2) < 1e-6,
    'When unfolded on mobile portrait, phone rotates 90 degrees (Math.PI / 2) into vertical portrait alignment',
  );
});

test('Phase 3 (2.75 <= l <= 3.45): zooms camera into inner screen center and transitions to ready state at l >= 3.45s', () => {
  const midZoom = computeReferenceIntroStep(3.1, 4.1, Math.PI, false, true);
  assert.equal(midZoom.phase, 'intro');
  assert.ok(Math.abs(midZoom.zoomProgress - 0.125) < 1e-6);
  assert.equal(midZoom.isFullScreenZoomed, false);

  const fullZoom = computeReferenceIntroStep(3.45, 4.45, Math.PI, false, true);
  assert.equal(fullZoom.phase, 'ready');
  assert.equal(fullZoom.zoomProgress, 1);
  assert.equal(fullZoom.isFullScreenZoomed, true);
});

test('Camera framing and inner screen zoom distance adapt to both desktop landscape and mobile portrait viewports', () => {
  const desktop = computeCameraFraming(1440, 900, 28);
  const mobile = computeCameraFraming(390, 844, 28);
  assert.equal(desktop.isMobilePortrait, false);
  assert.equal(mobile.isMobilePortrait, true);
  assert.ok(desktop.worldW > mobile.worldW);

  const zoomDistDesktop = computeInnerScreenZoomDistance(10, desktop.aspect, desktop.halfFovTan, false);
  const zoomDistMobile = computeInnerScreenZoomDistance(10, mobile.aspect, mobile.halfFovTan, true);
  assert.ok(zoomDistDesktop > 0 && zoomDistMobile > 0);
});

test('Easing helpers eb, ed, eh, ep behave accurately', () => {
  assert.equal(eb(1.5, 0, 1), 1);
  assert.ok(Math.abs(ed(1.3, 0.85, 1.75) - 0.5) < 1e-12);
  assert.equal(eh(0), 0);
  assert.equal(eh(1), 1);
  assert.equal(ep(0), 0);
  assert.equal(ep(0.5), 0.5);
  assert.equal(ep(1), 1);
});
