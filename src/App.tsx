/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  eb,
  ed,
  eh,
  ep,
  computeInnerScreenZoomDistance,
  IntroPhase,
} from './utils/animationMath';

const BG_DARK = '#0b0b0c';

function createAreaLightMaterial(intensity: number) {
  return new THREE.MeshLambertMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveIntensity: intensity,
  });
}

/**
 * Studio Lighting Environment for the 3D Foldable iPhone Duo
 */
class StudioEnvironment extends THREE.Scene {
  constructor() {
    super();
    const geometry = new THREE.BoxGeometry();
    geometry.deleteAttribute('uv');
    const roomMaterial = new THREE.MeshStandardMaterial({ side: THREE.BackSide });
    const boxMaterial = new THREE.MeshStandardMaterial();
    const mainLight = new THREE.PointLight(0xffffff, 900, 28, 2);
    mainLight.position.set(0.418, 16.199, 0.3);
    this.add(mainLight);

    const room = new THREE.Mesh(geometry, roomMaterial);
    room.position.set(-0.757, 13.219, 0.717);
    room.scale.set(31.713, 28.305, 28.591);
    this.add(room);

    const boxes = new THREE.InstancedMesh(geometry, boxMaterial, 6);
    const transform = new THREE.Object3D();

    transform.position.set(-10.906, 2.009, 1.846);
    transform.rotation.set(0, -0.195, 0);
    transform.scale.set(2.328, 7.905, 4.651);
    transform.updateMatrix();
    boxes.setMatrixAt(0, transform.matrix);

    transform.position.set(-5.607, -0.754, -0.758);
    transform.rotation.set(0, 0.994, 0);
    transform.scale.set(1.97, 1.534, 3.955);
    transform.updateMatrix();
    boxes.setMatrixAt(1, transform.matrix);

    transform.position.set(6.167, 0.857, 7.803);
    transform.rotation.set(0, 0.561, 0);
    transform.scale.set(3.927, 6.285, 3.687);
    transform.updateMatrix();
    boxes.setMatrixAt(2, transform.matrix);

    transform.position.set(-2.017, 0.018, 6.124);
    transform.rotation.set(0, 0.333, 0);
    transform.scale.set(2.002, 4.566, 2.064);
    transform.updateMatrix();
    boxes.setMatrixAt(3, transform.matrix);

    transform.position.set(2.291, -0.756, -2.621);
    transform.rotation.set(0, -0.286, 0);
    transform.scale.set(1.546, 1.552, 1.496);
    transform.updateMatrix();
    boxes.setMatrixAt(4, transform.matrix);

    transform.position.set(-2.193, -0.369, -5.547);
    transform.rotation.set(0, 0.516, 0);
    transform.scale.set(3.875, 3.487, 2.986);
    transform.updateMatrix();
    boxes.setMatrixAt(5, transform.matrix);

    this.add(boxes);

    const light1 = new THREE.Mesh(geometry, createAreaLightMaterial(50));
    light1.position.set(-16.116, 14.37, 8.208);
    light1.scale.set(0.1, 2.428, 2.739);
    this.add(light1);

    const light2 = new THREE.Mesh(geometry, createAreaLightMaterial(50));
    light2.position.set(-16.109, 18.021, -8.207);
    light2.scale.set(0.1, 2.425, 2.751);
    this.add(light2);

    const light3 = new THREE.Mesh(geometry, createAreaLightMaterial(17));
    light3.position.set(14.904, 12.198, -1.832);
    light3.scale.set(0.15, 4.265, 6.331);
    this.add(light3);

    const light4 = new THREE.Mesh(geometry, createAreaLightMaterial(43));
    light4.position.set(-0.462, 8.89, 14.52);
    light4.scale.set(4.38, 5.441, 0.088);
    this.add(light4);

    const light5 = new THREE.Mesh(geometry, createAreaLightMaterial(20));
    light5.position.set(3.235, 11.486, -12.541);
    light5.scale.set(2.5, 2, 0.1);
    this.add(light5);

    const light6 = new THREE.Mesh(geometry, createAreaLightMaterial(100));
    light6.position.set(0, 20, 0);
    light6.scale.set(1, 0.1, 1);
    this.add(light6);
  }

  dispose() {
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    this.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        resources.add(mesh.geometry);
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => resources.add(m));
        } else {
          resources.add(mesh.material);
        }
      }
    });
    for (const res of resources) {
      res.dispose();
    }
  }
}

declare global {
  interface Window {
    __setIntroTime?: (l: number | null) => void;
    __replayIntro?: () => void;
  }
}

export default function App() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const veilRef = useRef<HTMLDivElement | null>(null);
  const skipIntroRef = useRef<() => void>(() => {});
  const replayIntroRef = useRef<() => void>(() => {});

  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [phase, setPhase] = useState<IntroPhase>('loading');

  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  useEffect(() => {
    const stageEl = stageRef.current;
    const veilEl = veilRef.current;
    if (!stageEl || !veilEl) return;

    const params = new URLSearchParams(window.location.search);
    const queryT = params.get('t');
    let pinnedTimeL: number | null =
      queryT !== null && !Number.isNaN(Number(queryT))
        ? Number(queryT)
        : params.get('autostart') === '1'
          ? 3.5
          : null;

    // Software-WebGL detection for smooth headless Chromium verification
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(1.5, window.devicePixelRatio || 1),
    );
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    stageEl.innerHTML = '';
    stageEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const studioEnv = new StudioEnvironment();
    const envTexture = pmremGenerator.fromScene(studioEnv, 0.04).texture;
    studioEnv.dispose();
    scene.environment = envTexture;

    const dirLight = new THREE.DirectionalLight('#fff4ea', 1.6);
    dirLight.position.set(-4, 6, 8);
    scene.add(dirLight);

    const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 100);

    const computedStyle = getComputedStyle(stageEl);
    const fonts = {
      serif:
        computedStyle.getPropertyValue('--font-serif').trim() ||
        '"Instrument Serif", Georgia, serif',
      mono:
        computedStyle.getPropertyValue('--font-mono').trim() ||
        '"Geist Mono", monospace',
    };

    const assetStatus = { duo: 0, title: 0 };
    let disposed = false;

    // Outer screen canvas (690 x 1000) & Inner screen canvas (2002 x 1400)
    // Both textures are rendered & uploaded to the GPU ONCE at load time (zero per-frame texture uploads during animation!)
    const O = document.createElement('canvas');
    O.width = 690;
    O.height = 1000;
    const L = document.createElement('canvas');
    L.width = 2002;
    L.height = 1400;

    // Upright portrait canvas (1400 x 2002) for mobile full-screen veil
    const veilPortraitCanvas = document.createElement('canvas');
    veilPortraitCanvas.width = 1400;
    veilPortraitCanvas.height = 2002;

    const G = new THREE.CanvasTexture(O);
    const N = new THREE.CanvasTexture(L);
    for (const tex of [G, N]) {
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
    }

    // Inner screen material uses a GPU uniform color multiplier (`#000000` -> `#ffffff`)
    // so the inner screen illuminates smoothly during unfold with ZERO CPU/GPU texture uploads!
    const outerScreenMaterial = new THREE.MeshBasicMaterial({
      map: G,
      toneMapped: false,
    });
    const innerScreenMaterial = new THREE.MeshBasicMaterial({
      map: N,
      color: 0xffffff,
      toneMapped: false,
    });

    const titleImg = new Image();
    let titleReady = false;
    let isMobilePortrait =
      (stageEl.clientWidth || window.innerWidth) <
      (stageEl.clientHeight || window.innerHeight);

    const drawCoverImage = (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      scale = 1,
      alignX = 0.5,
      alignY = 0.5,
    ) => {
      if (!titleReady) {
        ctx.fillStyle = BG_DARK;
        ctx.fillRect(0, 0, w, h);
        return;
      }
      const s = Math.max(w / titleImg.width, h / titleImg.height) * scale;
      const dw = titleImg.width * s;
      const dh = titleImg.height * s;
      ctx.drawImage(titleImg, (w - dw) * alignX, (h - dh) * alignY, dw, dh);
    };

    const drawScrim = (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      stops: [number, number][],
    ) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      stops.forEach(([offset, alpha]) =>
        grad.addColorStop(offset, `rgba(8,6,8,${alpha})`),
      );
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    };

    // Outer cover lock screen (690 x 1000) — drawn ONCE at load
    const drawOuterScreen = () => {
      const ctx = O.getContext('2d');
      if (!ctx) return;
      const w = O.width;
      const h = O.height;
      const now = new Date();
      drawCoverImage(ctx, w, h, 1, 0.62, 0.5);
      drawScrim(ctx, w, h, [
        [0, 0.45],
        [0.45, 0.1],
        [1, 0.55],
      ]);
      ctx.fillStyle = '#f6f1ea';
      ctx.textAlign = 'center';
      ctx.font = `400 24px ${fonts.mono}`;
      ctx.globalAlpha = 0.8;
      ctx.fillText(
        now
          .toLocaleDateString('en', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })
          .toUpperCase(),
        w / 2,
        145,
      );
      ctx.font = `400 17px ${fonts.mono}`;
      ctx.globalAlpha = 0.62;
      ctx.fillText('M R I D U L   S T U D I O S', w / 2, 184);

      ctx.globalAlpha = 1;
      ctx.font = `400 230px ${fonts.serif}`;
      ctx.fillText(
        now.toLocaleTimeString('en', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: false,
        }),
        w / 2,
        378,
      );
      ctx.font = `italic 400 40px ${fonts.serif}`;
      ctx.globalAlpha = 0.85;
      ctx.fillText('Floating Phones', w / 2, h - 120);
      ctx.globalAlpha = 1;
      G.needsUpdate = true;
    };

    /**
     * Renders the complete, full-resolution Mridul Studios "Floating Phones" screen
     * for either Desktop Landscape (`2002 x 1400`) or Mobile Portrait (`1400 x 2002`).
     */
    const renderScreenContent = (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      isPortrait: boolean,
    ) => {
      ctx.fillStyle = BG_DARK;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      drawCoverImage(ctx, w, h, 1.0, isPortrait ? 0.58 : 0.5, 0.5);
      drawScrim(ctx, w, h, [
        [0, 0.38],
        [0.5, 0.14],
        [0.78, 0.24],
        [1, 0.74],
      ]);

      ctx.fillStyle = '#f6f1ea';
      ctx.textAlign = 'center';

      if (!isPortrait) {
        const r = w / 1430;
        ctx.shadowColor = 'rgba(0,0,0,.35)';
        ctx.shadowBlur = 40 * r;

        ctx.globalAlpha = 0.88;
        ctx.font = `400 ${22 * r}px ${fonts.mono}`;
        ctx.fillText(
          'M R I D U L   S T U D I O S   P R E S E N T S',
          w / 2,
          285 * r,
        );

        ctx.globalAlpha = 1;
        const o = 455 * r;
        ctx.font = `400 ${168 * r}px ${fonts.serif}`;
        const c = 'Floating ';
        const lWidth = ctx.measureText(c).width;
        ctx.font = `italic 400 ${168 * r}px ${fonts.serif}`;
        const bText = 'Phones';
        const dWidth = ctx.measureText(bText).width;
        ctx.textAlign = 'left';
        ctx.font = `400 ${168 * r}px ${fonts.serif}`;
        ctx.fillText(c, w / 2 - (lWidth + dWidth) / 2, o);
        ctx.font = `italic 400 ${168 * r}px ${fonts.serif}`;
        ctx.fillText(bText, w / 2 - (lWidth + dWidth) / 2 + lWidth, o);

        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.9;
        ctx.font = `italic 400 ${40 * r}px ${fonts.serif}`;
        ctx.fillText('Spatial Web Architecture, 2026', w / 2, 572 * r);

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.72;
        ctx.font = `400 ${15 * r}px ${fonts.mono}`;
        ctx.fillText(
          'CRAFTED BY MRIDUL    CREATIVE TECHNOLOGIST    3D SPATIAL ENGINEERING',
          w / 2,
          h - 110 * r,
        );

        ctx.globalAlpha = 0.52;
        ctx.font = `400 ${13 * r}px ${fonts.mono}`;
        ctx.fillText(
          'INTERACTIVE DIGITAL EDITION    ·    DESIGNED FOR WEB & MOBILE',
          w / 2,
          h - 82 * r,
        );
      } else {
        // Mobile Portrait (1400 x 2002) — sized inside the 820px safe center corridor
        ctx.shadowColor = 'rgba(0,0,0,.4)';
        ctx.shadowBlur = 44;

        ctx.globalAlpha = 0.9;
        ctx.font = `400 22px ${fonts.mono}`;
        ctx.fillText(
          'M R I D U L   S T U D I O S   P R E S E N T S',
          w / 2,
          680,
        );

        ctx.globalAlpha = 1;
        const o = 865;
        ctx.font = `400 132px ${fonts.serif}`;
        const c = 'Floating ';
        const lWidth = ctx.measureText(c).width;
        ctx.font = `italic 400 132px ${fonts.serif}`;
        const bText = 'Phones';
        const dWidth = ctx.measureText(bText).width;
        ctx.textAlign = 'left';
        ctx.font = `400 132px ${fonts.serif}`;
        ctx.fillText(c, w / 2 - (lWidth + dWidth) / 2, o);
        ctx.font = `italic 400 132px ${fonts.serif}`;
        ctx.fillText(bText, w / 2 - (lWidth + dWidth) / 2 + lWidth, o);

        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.92;
        ctx.font = `italic 400 42px ${fonts.serif}`;
        ctx.fillText('Spatial Web Architecture, 2026', w / 2, 968);

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.74;
        ctx.font = `400 17px ${fonts.mono}`;
        ctx.fillText(
          'CRAFTED BY MRIDUL   ·   CREATIVE TECHNOLOGIST',
          w / 2,
          h - 210,
        );

        ctx.globalAlpha = 0.54;
        ctx.font = `400 15px ${fonts.mono}`;
        ctx.fillText(
          'INTERACTIVE DIGITAL EDITION   ·   2026',
          w / 2,
          h - 170,
        );
      }

      ctx.globalAlpha = 1;
    };

    /**
     * Bakes both the 3D inner screen texture `N` and the full-screen `.fp-veil` image ONCE
     * during loading (or orientation change) so ZERO 2D canvas drawing or texture uploads
     * occur while the phone is rotating and unfolding!
     */
    const bakeInnerAndVeilOnce = () => {
      const ctx = L.getContext('2d');
      if (!ctx) return;

      if (!isMobilePortrait) {
        renderScreenContent(ctx, L.width, L.height, false);
        N.needsUpdate = true;
        if (titleReady) {
          veilEl.style.backgroundImage = `url(${L.toDataURL('image/jpeg', 0.92)})`;
        }
      } else {
        const vCtx = veilPortraitCanvas.getContext('2d');
        if (vCtx) {
          renderScreenContent(
            vCtx,
            veilPortraitCanvas.width,
            veilPortraitCanvas.height,
            true,
          );
          // Copy the rendered portrait canvas into L rotated +90° clockwise
          ctx.save();
          ctx.translate(L.width / 2, L.height / 2);
          ctx.rotate(Math.PI / 2);
          ctx.translate(-L.height / 2, -L.width / 2);
          ctx.drawImage(veilPortraitCanvas, 0, 0);
          ctx.restore();
          N.needsUpdate = true;
          if (titleReady) {
            veilEl.style.backgroundImage = `url(${veilPortraitCanvas.toDataURL('image/jpeg', 0.92)})`;
          }
        }
      }
    };

    titleImg.onload = () => {
      if (disposed) return;
      titleReady = true;
      assetStatus.title = 1;
      drawOuterScreen();
      bakeInnerAndVeilOnce();
    };
    titleImg.onerror = () => {
      assetStatus.title = 1;
    };
    titleImg.src = '/lab/phones/title.webp';

    document.fonts?.ready.then(() => {
      if (!disposed) {
        drawOuterScreen();
        bakeInnerAndVeilOnce();
      }
    });

    // 3D Hierarchy: U -> W -> Q -> J (duo.glb)
    // Use 'YXZ' rotation order on U so screen-space Z portrait rotation and Y spin compose cleanly!
    const U = new THREE.Group();
    U.rotation.order = 'YXZ';
    const W = new THREE.Group();
    const Q = new THREE.Group();
    U.add(W);
    W.add(Q);
    U.visible = false;
    scene.add(U);

    let V: THREE.AnimationAction | null = null;
    let X: THREE.AnimationMixer | null = null;
    let J: THREE.Group | null = null;
    const Y = {
      closed: new THREE.Vector3(),
      open: new THREE.Vector3(),
    };
    let Z = 1;
    let ee = 0; // timestamp when duo.glb finished loading
    let et = -1; // last fold state

    const setFold = (e: number) => {
      if (V && X && e !== et) {
        et = e;
        V.time = 2 * e;
        X.update(0);
      }
    };

    const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    gltfLoader.load(
      '/lab/phones/duo.glb',
      (gltf) => {
        if (disposed) return;
        J = gltf.scene;
        J.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mesh = child as THREE.Mesh;
          const mat = mesh.material as THREE.Material;
          if (mat.name === 'C_SW_Screen_Outer') {
            mesh.material = outerScreenMaterial;
          } else if (mat.name === 'C_StarWhite_Screen_Inner') {
            mesh.material = innerScreenMaterial;
          }
          mesh.frustumCulled = false;
        });

        X = new THREE.AnimationMixer(J);
        V = X.clipAction(gltf.animations[0]);
        V.play();
        V.paused = true;

        const box = new THREE.Box3();
        setFold(0);
        J.updateMatrixWorld(true);
        box.setFromObject(J, true);
        box.getCenter(Y.open);

        setFold(1);
        J.updateMatrixWorld(true);
        box.setFromObject(J, true);
        box.getCenter(Y.closed);
        Z = box.max.y - box.min.y;

        Q.add(J);
        U.visible = true;

        // Pre-compile all WebGL shaders and upload textures during the loading phase
        // so zero shader compilation or texture upload happens when the phone rotates!
        if (!isSoftwareGl) {
          renderer.compile(scene, camera);
        }

        ee = performance.now();
        assetStatus.duo = 1;
        document.body.dataset.modelLoaded = 'true';
      },
      (ev) => {
        if (ev.total) {
          assetStatus.duo = ev.loaded / ev.total;
        }
      },
    );

    let ej = 0;
    let eM = 0;
    let eE = 1;
    let ey = 1;
    let e_ = 10;

    const handleResize = () => {
      ej = stageEl.clientWidth || window.innerWidth;
      eM = stageEl.clientHeight || window.innerHeight;
      renderer.setSize(ej, eM);
      camera.aspect = ej / Math.max(1, eM);
      const nextIsPortrait = camera.aspect < 1;
      const orientationChanged = nextIsPortrait !== isMobilePortrait;
      isMobilePortrait = nextIsPortrait;
      document.body.dataset.orientation = isMobilePortrait ? 'portrait' : 'landscape';

      const halfFovTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      e_ = Math.max(
        2.05 / (0.9 * halfFovTan),
        1 / (1.1 * halfFovTan * camera.aspect),
      );
      camera.position.set(0, 0, e_);
      camera.updateProjectionMatrix();
      ey = 2 * e_ * halfFovTan;
      eE = ey * camera.aspect;

      if (orientationChanged) {
        bakeInnerAndVeilOnce();
      }
    };
    handleResize();
    drawOuterScreen();
    bakeInnerAndVeilOnce();

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(stageEl);

    let ez = 0; // timestamp when loading completes and intro begins
    let eX: IntroPhase = 'loading';
    let eY = Math.PI;
    let eZ = Math.PI;
    let lastReportedCount = -1;
    const e7 = new THREE.Vector3();

    skipIntroRef.current = () => {
      if (ez) {
        ez = Math.min(ez, performance.now() - 3500);
      } else if (ee) {
        ez = performance.now() - 3500;
      }
    };

    replayIntroRef.current = () => {
      pinnedTimeL = null;
      ee = performance.now();
      ez = 0;
      et = -1;
      lastReportedCount = -1;
      veilEl.style.opacity = '0';
      veilEl.style.transform = 'scale(1)';
      if (J) {
        U.visible = true;
        setFold(1);
      }
      drawOuterScreen();
      setLoadProgress(0);
      setPhase('loading');
    };

    window.__setIntroTime = (targetL: number | null) => {
      pinnedTimeL = targetL;
    };
    window.__replayIntro = () => replayIntroRef.current();

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        skipIntroRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(() => requestAnimationFrame(cb), 60);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(() => requestAnimationFrame(cb), 60);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = (now: number) => {
      if (disposed) return;
      const o = now / 1000;

      // Update 000 -> 100 loading counter smoothly during the 1000ms folded intro phase
      if (pinnedTimeL !== null) {
        const pinnedCount =
          pinnedTimeL < 0
            ? Math.round(eb(1 + pinnedTimeL, 0, 1) * 100)
            : 100;
        if (pinnedCount !== lastReportedCount) {
          lastReportedCount = pinnedCount;
          setLoadProgress(pinnedCount);
        }
      } else if (!ez) {
        const assetFraction = 0.7 * assetStatus.duo + 0.3 * assetStatus.title;
        const holdFraction = ee ? eb((now - ee) / 980, 0, 1) : 0;
        const combined = ee
          ? Math.round(
              eb(0.25 * assetFraction + 0.75 * holdFraction, 0, 1) * 100,
            )
          : Math.round(assetFraction * 25);
        if (combined !== lastReportedCount) {
          lastReportedCount = combined;
          setLoadProgress(combined);
        }
      } else if (lastReportedCount !== 100) {
        lastReportedCount = 100;
        setLoadProgress(100);
      }

      if (
        pinnedTimeL === null &&
        !ez &&
        assetStatus.title >= 1 &&
        J &&
        now - ee > 1000 * Number(!reducedMotion)
      ) {
        ez = reducedMotion ? now - 3500 : now;
        eZ = eY;
      }

      const l =
        pinnedTimeL !== null
          ? pinnedTimeL
          : ez
            ? (now - ez) / 1000
            : -1;

      const nextPhase: IntroPhase =
        l < 0 ? 'loading' : l < 3.45 ? 'intro' : 'ready';
      if (nextPhase !== eX) {
        eX = nextPhase;
        setPhase(nextPhase);
      }

      const h = l < 0 ? 0 : Math.pow(ed(l, 2.75, 3.45), 3);

      if (J) {
        U.visible = true;
        const a = pinnedTimeL !== null ? 1 : eh(eb((now - ee) / 900));
        const t = l < 0 ? 0 : ep(ed(l, 0, 1));
        if (!ez && pinnedTimeL === null) {
          eY = Math.PI + (reducedMotion ? 0 : 0.42 * Math.sin(0.8 * o));
        } else if (pinnedTimeL !== null && pinnedTimeL < 0) {
          eY = Math.PI + 0.22;
        }
        const s = l >= 0 ? eZ + (2 * Math.PI - eZ) * t : eY;
        const c = l < 0 ? 0 : ep(ed(l, 0.85, 1.75));
        setFold(1 - c);

        // Smoothly illuminate the inner screen via a 3-float WebGL uniform (`color.setScalar`)
        // as the hinge opens — ZERO 2D canvas redraws or texture uploads during the rotation!
        const screenBrightness = l < 0 ? 0.04 : 0.04 + 0.96 * eh(ed(l, 1.05, 1.95));
        innerScreenMaterial.color.setScalar(screenBrightness);

        const desktopD = Math.min(2.0909999999999997 / Z, (0.8 * eE) / 0.168116);
        const portraitUnfoldedD = Math.min(
          (0.78 * ey) / 0.168116,
          (0.86 * eE) / Z,
        );
        const d = isMobilePortrait
          ? desktopD + (portraitUnfoldedD - desktopD) * c
          : desktopD;

        W.scale.setScalar(d * (0.6 + 0.4 * a));
        Q.position.copy(Y.closed).lerp(Y.open, c).multiplyScalar(-1);

        const rotZ =
          -0.05 * (1 - t) + (isMobilePortrait ? c * (Math.PI / 2) : 0);
        U.rotation.set(-0.1 * (1 - t), s, rotZ);
        U.position.set(
          0,
          (reducedMotion || pinnedTimeL !== null
            ? 0
            : 0.05 * Math.sin(1.3 * o)) *
            (1 - t),
          0,
        );
        U.updateMatrixWorld(true);

        e7.set(0, 0.05885, 0.0026);
        J.localToWorld(e7);
        const p = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const u = W.scale.x;
        const f = computeInnerScreenZoomDistance(
          u,
          camera.aspect,
          p,
          isMobilePortrait,
        );
        const clampedH = eb(h, 0, 1);
        camera.position.set(
          e7.x * clampedH,
          e7.y * clampedH,
          e_ + (e7.z + f - e_) * clampedH,
        );
      }

      veilEl.style.opacity = h >= 1 ? '1' : '0';
      veilEl.style.transform = 'scale(1)';

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry.dispose();
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          mats.forEach((m) => m.dispose());
        }
      });
      outerScreenMaterial.dispose();
      innerScreenMaterial.dispose();
      G.dispose();
      N.dispose();
      envTexture.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <main className="fp-page" data-phase={phase}>
      <div ref={stageRef} className="fp-stage" aria-hidden="true" />
      <div ref={veilRef} className="fp-veil" aria-hidden="true" />

      <div className="fp-loader">
        <span className="fp-edge">Mridul</span>
        <span
          className="fp-count"
          role="progressbar"
          aria-label="Loading experience"
          aria-valuenow={loadProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          Loading <b>{String(loadProgress).padStart(3, '0')}</b>
        </span>
        <span className="fp-edge fp-edgeRight">Studio, 2026</span>
        <button
          type="button"
          className="fp-skip"
          onClick={() => skipIntroRef.current()}
          disabled={phase !== 'intro'}
        >
          Skip intro
        </button>
      </div>

      <div className="fp-ready-actions">
        <button
          type="button"
          className="fp-action-btn"
          onClick={() => replayIntroRef.current()}
        >
          <span aria-hidden="true">↻</span> Replay intro
        </button>
      </div>
    </main>
  );
}
