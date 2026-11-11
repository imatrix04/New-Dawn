import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { seasonOf } from '../game/engine';
import { buildGlow, buildSkyMask, loadImage } from './scene/assets';
import { createSceneRenderer, readLook, type SceneRenderer } from './scene/gl';
import { applyLight, DAY_SECONDS, hourOf, lightAt, lightGap, mixLight, START_HOUR, type Light } from './scene/light';
import { createParticles, type Particles } from './scene/particles';
import { useScenePrefs, type SceneLevel } from './scene/settings';
import { createSky, type Sky } from './scene/sky';

/** Densité des particules et amplitude de la parallaxe selon le réglage d'intensité. */
const LEVEL: Record<SceneLevel, number> = { low: .5, normal: 1, high: 1.6 };
/** Parallaxe simple : déplacement maximal de la photo, en % de sa taille. Doit rester sous la marge du zoom (2 % par bord pour 1.04). */
const SHIFT_PCT = 1.1;
/** Parallaxe par profondeur : déplacement maximal du premier plan, en fraction de la largeur. */
const DEPTH_SHIFT = .014;
/** Vitesse de rattrapage de la souris (plus grand = plus nerveux). */
const FOLLOW = 3.5;
/** Vitesse des fondus de lumière du rendu WebGL (plus grand = plus rapide ; 3 ≈ une seconde). */
const LIGHT_FADE = 3;
/** Intervalle de mise à jour de la lumière en cycle automatique, en secondes. */
const LIGHT_EVERY = 4;
/** Intervalle de dessin du ciel, en secondes : les nuages sont lents, dix images par seconde suffisent. */
const SKY_EVERY = .1;
/** Cadence maximale de la boucle (30 à 40 images/s selon l'écran) : au-delà, le coût augmente pour un gain invisible. */
const MAX_FPS = 40;
/** Heure fixe quand les effets sont coupés : plein jour. */
const NOON = 13;

const REDUCED = '(prefers-reduced-motion: reduce)';
const subscribeReduced = (notify: () => void) => {
  const query = window.matchMedia(REDUCED);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const useReducedMotion = () => useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches);

/** Taille du tampon WebGL : celle du décor, en pixels réels plafonnés (la photo n'a pas plus de détail à offrir). */
const bufferSize = (root: HTMLElement): [number, number] => {
  const scale = Math.min(window.devicePixelRatio || 1, 1.5);
  return [root.clientWidth * scale, root.clientHeight * scale];
};

interface Assets {
  photo: string;
  image: HTMLImageElement;
  depth: HTMLImageElement | null;
  /** Masque du ciel, `null` si la photo n'en montre pas ou si la carte de profondeur manque : pas de nuages. */
  mask: HTMLCanvasElement | null;
}

interface Props {
  /** URL de la photo du logement. */
  photo: string;
  /** URL de sa carte de profondeur, si elle existe. */
  depth?: string;
  /** Mois de la partie : donne la saison et relance la journée à l'aube. */
  month: number;
  /** Jeu en pause : les animations se figent. */
  paused: boolean;
}

/**
 * Décor du logement : photo étalonnée, lumière selon l'heure, ciel et nuages, particules de saison et parallaxe.
 * Purement décoratif : sous le tableau, sans clics. Si la photo ne charge pas, rien n'est rendu et le fond par défaut reste visible.
 *
 * Deux rendus du même décor : WebGL (un seul passage, voir scene/gl.ts) et, sans WebGL, des calques CSS avec une parallaxe simple.
 */
export function SceneBackground({ photo, depth, month, paused }: Props) {
  const { enabled, level, time } = useScenePrefs();
  const reduced = useReducedMotion();
  const animated = enabled && !reduced;

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const skyRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);

  const [loaded, setLoaded] = useState<Assets | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [glPhoto, setGlPhoto] = useState<string | null>(null);
  const assets = loaded?.photo === photo ? loaded : null;
  const useGl = glPhoto === photo;
  const hasSky = enabled && !!assets?.mask;

  const renderer = useRef<SceneRenderer | null>(null);
  const particles = useRef<Particles | null>(null);
  const sky = useRef<Sky | null>(null);
  const clock = useRef({ hour: START_HOUR, month, drift: 0 });
  /** Lumière visée, et lumière affichée par le rendu WebGL, qui la rejoint en fondu. */
  const light = useRef<Light>(lightAt(NOON));
  const shown = useRef<Light | null>(null);
  const pointer = useRef({ x: 0, y: 0, cx: 0, cy: 0 });
  /** Le rendu WebGL est à refaire. */
  const dirty = useRef(true);
  // Lu par la boucle sans la relancer.
  const live = useRef({ season: seasonOf(month), amount: LEVEL[level], time, depth: false });
  if (live.current.amount !== LEVEL[level]) dirty.current = true;
  live.current = { season: seasonOf(month), amount: LEVEL[level], time, depth: !!assets?.depth };

  /** Affiche la parallaxe : par la profondeur en WebGL si la carte existe, sinon en déplaçant toute la photo. */
  const present = (force = false) => {
    if (!force && !dirty.current) return;
    dirty.current = false;
    const p = pointer.current;
    const { amount, depth: deep } = live.current;
    const gl = renderer.current;
    if (gl) gl.render(deep ? p.cx * DEPTH_SHIFT * amount : 0, deep ? -p.cy * DEPTH_SHIFT * amount : 0, shown.current ?? light.current);
    if (stageRef.current) stageRef.current.style.transform = gl && deep ? '' : `translate3d(${(-p.cx * SHIFT_PCT * amount).toFixed(3)}%, ${(-p.cy * SHIFT_PCT * amount).toFixed(3)}%, 0) scale(1.04)`;
  };
  const drawSky = () => {
    if (!sky.current || !skyRef.current) return;
    sky.current.draw(clock.current.drift, shown.current ?? light.current);
    renderer.current?.setSky(skyRef.current);
    dirty.current = true;
  };
  const makeSky = () => {
    const root = rootRef.current;
    sky.current = skyRef.current && root && assets?.mask ? createSky(skyRef.current, assets.mask, root.clientWidth / Math.max(1, root.clientHeight)) : null;
    if (!sky.current) { renderer.current?.setSky(null); dirty.current = true; }
    drawSky();
  };

  // Photo, carte de profondeur et masque du ciel.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const image = await loadImage(photo);
        const depthImage = depth ? await loadImage(depth).catch(() => null) : null;
        let mask: HTMLCanvasElement | null = null;
        try { mask = depthImage && buildSkyMask(image, depthImage); } catch { /* lecture des pixels refusée : pas de masque */ }
        if (alive) setLoaded({ photo, image, depth: depthImage, mask });
      } catch {
        if (alive) setFailed(photo);
      }
    })();
    return () => { alive = false; };
  }, [photo, depth]);

  // Rendu WebGL ; s'il est indisponible ou si le contexte est perdu, les calques CSS restent en place.
  useEffect(() => {
    const canvas = glRef.current;
    const root = rootRef.current;
    if (!canvas || !root || !assets) return;
    const made = createSceneRenderer(canvas, { image: assets.image, depth: assets.depth, glow: buildGlow(assets.image) }, readLook(root), () => { renderer.current = null; setGlPhoto(null); });
    if (!made) return;
    made.resize(...bufferSize(root));
    renderer.current = made;
    present(true);
    setGlPhoto(assets.photo);
    return () => { made.dispose(); renderer.current = null; setGlPhoto(null); dirty.current = true; };
  }, [assets]);

  // Ciel : recréé avec la photo, redessiné ensuite par la boucle (ou une seule fois si rien n'est animé).
  useEffect(() => {
    makeSky();
    present();
    return () => { sky.current = null; };
  }, [assets, hasSky, useGl]);

  // Particules.
  useEffect(() => {
    if (!animated) return;
    particles.current = fxRef.current ? createParticles(fxRef.current) : null;
    return () => { particles.current = null; };
  }, [animated]);

  // Suivi de la taille, et retour au centre quand la parallaxe s'arrête.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!animated) { pointer.current = { x: 0, y: 0, cx: 0, cy: 0 }; present(true); }
    const observer = new ResizeObserver(() => {
      particles.current?.resize();
      renderer.current?.resize(...bufferSize(root));
      makeSky();
      present(true);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [animated, assets]);

  // Lumière : recalculée à chaque changement de réglage ou de mois ; la boucle prend le relais en cycle automatique.
  useEffect(() => {
    if (clock.current.month !== month) { clock.current.hour = START_HOUR; clock.current.month = month; }
    if (!rootRef.current) return;
    light.current = lightAt(!enabled || (reduced && time === 'auto') ? NOON : hourOf(time, clock.current.hour));
    applyLight(rootRef.current, light.current);
    // Au montage et sans boucle (pause, effets coupés, mouvement réduit), pas de fondu : la lumière s'affiche tout de suite.
    if (!shown.current || !animated || paused) { shown.current = light.current; drawSky(); present(true); }
  }, [enabled, reduced, time, month, animated, paused]);

  // La boucle unique : horloge, lumière, parallaxe, ciel et particules. À l'arrêt en pause, fenêtre cachée ou mouvement réduit.
  useEffect(() => {
    if (!animated || paused) return;
    let raf = 0;
    let last = 0;
    let sinceLight = 0;
    let sinceSky = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const elapsed = now - last;
      if (elapsed < 1000 / MAX_FPS - 2) return;
      last = now;
      const dt = Math.min(elapsed, 100) / 1000;

      const c = clock.current;
      c.hour = (c.hour + (dt * 24) / DAY_SECONDS) % 24;
      c.drift += dt;
      sinceLight += dt;
      if (sinceLight >= LIGHT_EVERY && live.current.time === 'auto' && rootRef.current) {
        sinceLight = 0;
        light.current = lightAt(c.hour);
        applyLight(rootRef.current, light.current);
      }
      // Fondu vers la lumière visée. En cycle automatique les pas sont infimes : le dessin du ciel suffit à les afficher.
      let fading = false;
      const from = shown.current ?? light.current;
      if (from !== light.current) {
        fading = lightGap(from, light.current) > .02;
        shown.current = fading ? mixLight(from, light.current, 1 - Math.exp(-dt * LIGHT_FADE)) : light.current;
        dirty.current = true;
      }

      const p = pointer.current;
      const k = 1 - Math.exp(-dt * FOLLOW);
      const dx = (p.x - p.cx) * k;
      const dy = (p.y - p.cy) * k;
      if (Math.abs(dx) + Math.abs(dy) > .0004) { p.cx += dx; p.cy += dy; dirty.current = true; }

      sinceSky += dt;
      if (sinceSky >= SKY_EVERY || fading) { sinceSky = 0; drawSky(); }
      present();
      particles.current?.step(dt, { season: live.current.season, night: (shown.current ?? light.current).night, density: live.current.amount });
    };

    const start = () => {
      if (raf || document.visibilityState !== 'visible') return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointermove', onMove, { passive: true });
    start();
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onMove);
    };
  }, [animated, paused]);

  if (failed === photo) return null;

  return (
    <div ref={rootRef} className="scene" style={{ '--scene': `url("${photo}")` } as CSSProperties} aria-hidden>
      <div ref={stageRef} className="scene-stage" key={photo}>
        {!useGl && <div className="scene-photo" />}
        <canvas ref={glRef} className="scene-gl" hidden={!useGl} />
        {/* En WebGL le ciel n'est qu'une texture : son canvas reste caché. */}
        {hasSky && <canvas ref={skyRef} className="scene-sky" hidden={useGl} />}
        {enabled && !useGl && <div className="scene-glow" />}
      </div>
      {!useGl && <div className="scene-light" />}
      {!useGl && <div className="scene-tone" />}
      {animated && <canvas ref={fxRef} className="scene-fx" />}
      <div className="scene-vignette" />
      {!useGl && <div className="scene-grain" />}
    </div>
  );
}
