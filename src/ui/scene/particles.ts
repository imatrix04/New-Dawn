import type { Season } from '../../game/engine';

type Kind = 'petal' | 'pollen' | 'dust' | 'leaf' | 'snow' | 'firefly';
const KINDS: Kind[] = ['petal', 'leaf', 'snow', 'pollen', 'dust', 'firefly'];
/** Les particules qui tombent traversent l'écran ; les autres flottent sur place et s'éteignent. */
const FALLING: Record<Kind, boolean> = { petal: true, leaf: true, snow: true, pollen: false, dust: false, firefly: false };

type Counts = Partial<Record<Kind, number>>;
/** Nombre de particules pour un écran 1920 × 1080 à intensité normale, de jour puis de nuit. */
const BY_DAY: Record<Season, Counts> = {
  spring: { petal: 18, pollen: 16 },
  summer: { dust: 32 },
  autumn: { leaf: 18, dust: 8 },
  winter: { snow: 60 },
};
const BY_NIGHT: Record<Season, Counts> = {
  spring: { petal: 7, firefly: 12 },
  summer: { dust: 8, firefly: 18 },
  autumn: { leaf: 8, firefly: 6 },
  winter: { snow: 60 },
};

export interface ParticleEnv {
  season: Season;
  /** 0 = jour, 1 = nuit. */
  night: number;
  /** Multiplicateur de densité (réglage d'intensité). */
  density: number;
}

interface Particle {
  kind: Kind;
  x: number; y: number;
  /** Profondeur : 0 = loin (petit, lent), 1 = près. */
  z: number;
  vx: number; vy: number;
  size: number;
  rot: number; vr: number;
  phase: number;
  age: number; ttl: number;
  variant: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

function sprite(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx, size);
  return c;
}

/** Point lumineux : cœur net, halo doux. */
const glow = (core: string, halo: string) => sprite(64, (ctx, s) => {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, core);
  g.addColorStop(.18, halo);
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});

const petal = (light: string, dark: string) => sprite(32, (ctx, s) => {
  const g = ctx.createLinearGradient(4, 0, s - 4, s);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(s / 2, 2);
  ctx.bezierCurveTo(s - 2, 8, s - 5, s - 6, s / 2, s - 2);
  ctx.bezierCurveTo(5, s - 6, 2, 8, s / 2, 2);
  ctx.fill();
});

const leaf = (fill: string, rib: string) => sprite(40, (ctx, s) => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(3, s / 2);
  ctx.quadraticCurveTo(s / 2, 3, s - 3, s / 2);
  ctx.quadraticCurveTo(s / 2, s - 3, 3, s / 2);
  ctx.fill();
  ctx.strokeStyle = rib;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(5, s / 2);
  ctx.lineTo(s - 5, s / 2);
  ctx.stroke();
});

export interface Particles {
  resize: () => void;
  step: (dt: number, env: ParticleEnv) => void;
  clear: () => void;
}

/** Particules saisonnières sur un canvas 2D. Rien n'est animé ici : `step` est appelé par la boucle du décor. */
export function createParticles(canvas: HTMLCanvasElement): Particles | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const sprites: Record<Kind, HTMLCanvasElement[]> = {
    petal: [petal('#fff0f3', '#f6b3c2'), petal('#ffffff', '#fbd3dc')],
    leaf: [leaf('#e8873f', '#b85c24'), leaf('#c9582f', '#8f3a1c'), leaf('#e6b24a', '#b98428')],
    snow: [glow('rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, .75)')],
    pollen: [glow('rgba(255, 246, 200, 1)', 'rgba(255, 226, 140, .45)')],
    dust: [glow('rgba(255, 244, 214, 1)', 'rgba(255, 214, 150, .4)')],
    firefly: [glow('rgba(250, 255, 190, 1)', 'rgba(206, 240, 96, .5)')],
  };

  let w = 0;
  let h = 0;
  let dpr = 1;
  let list: Particle[] = [];
  let primed = false;
  const counts: Record<Kind, number> = { petal: 0, pollen: 0, dust: 0, leaf: 0, snow: 0, firefly: 0 };

  function spawn(kind: Kind, anywhere: boolean): Particle {
    const z = Math.random();
    const p: Particle = { kind, z, x: rand(-.15, 1.05) * w, y: anywhere ? rand(0, h) : -30, vx: 0, vy: 0, size: 4, rot: rand(0, TAU), vr: 0, phase: rand(0, TAU), age: 0, ttl: 0, variant: 0 };
    switch (kind) {
      case 'snow':
        p.size = 5 + z * z * 13; p.vy = 26 + z * 50; p.vx = -6 - z * 8;
        break;
      case 'petal':
        p.size = 9 + z * 9; p.vy = 26 + z * 34; p.vx = 16 + z * 24; p.vr = rand(-1.4, 1.4); p.variant = Math.random() < .5 ? 0 : 1;
        break;
      case 'leaf':
        p.size = 14 + z * 14; p.vy = 36 + z * 40; p.vx = 22 + z * 34; p.vr = rand(-1.8, 1.8); p.variant = Math.floor(Math.random() * 3);
        break;
      case 'pollen':
        p.size = 9 + z * 9; p.vx = rand(4, 14); p.vy = rand(-6, 3); p.ttl = rand(7, 13); p.y = rand(0, h);
        break;
      case 'dust':
        p.size = 7 + z * 13; p.vx = rand(-5, 5); p.vy = rand(-5, 2); p.ttl = rand(8, 15); p.y = rand(0, h);
        break;
      case 'firefly':
        p.size = 16 + z * 12; p.vx = 12 + z * 14; p.ttl = rand(9, 16); p.y = rand(.25, .95) * h;
        break;
    }
    if (p.ttl && anywhere) p.age = rand(0, p.ttl * .8);
    return p;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
  }

  function clear() {
    ctx!.setTransform(1, 0, 0, 1, 0, 0);
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
  }

  function step(dt: number, env: ParticleEnv) {
    if (!w || !h) return;
    const area = Math.min(1.4, Math.max(.4, (w * h) / (1920 * 1080)));
    const day = BY_DAY[env.season];
    const night = BY_NIGHT[env.season];

    // Naissances : au premier passage l'écran est déjà peuplé, ensuite les particules arrivent peu à peu.
    for (const kind of KINDS) {
      const target = Math.round(((day[kind] ?? 0) * (1 - env.night) + (night[kind] ?? 0) * env.night) * env.density * area);
      if (!primed) {
        while (counts[kind] < target) { list.push(spawn(kind, true)); counts[kind]++; }
      } else if (counts[kind] < target && Math.random() < dt * 5) {
        list.push(spawn(kind, false));
        counts[kind]++;
      }
      // Trop nombreuses (changement de saison, tombée du jour) : celles qui flottent s'éteignent plus vite.
      if (counts[kind] > target && !FALLING[kind]) for (const p of list) if (p.kind === kind) p.age += dt * 2;
    }
    primed = true;

    clear();
    const c = ctx!;
    let kept = 0;
    for (const p of list) {
      p.age += dt;
      let alpha = 1;
      if (FALLING[p.kind]) {
        const sway = p.kind === 'snow' ? 12 : 22;
        p.x += (p.vx + Math.sin(p.phase + p.age * 1.1) * sway) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.y > h + 40 || p.x > w + 60 || p.x < -w * .2) { counts[p.kind]--; continue; }
        alpha = p.kind === 'snow' ? .5 + p.z * .45 : .7 + p.z * .3;
      } else {
        if (p.age >= p.ttl) { counts[p.kind]--; continue; }
        const fade = Math.sin(Math.PI * Math.min(1, p.age / p.ttl));
        if (p.kind === 'firefly') {
          p.rot += Math.sin(p.age * 1.3 + p.phase) * 1.4 * dt;
          p.x += Math.cos(p.rot) * p.vx * dt;
          p.y += Math.sin(p.rot) * p.vx * .6 * dt;
          const pulse = Math.max(0, Math.sin(p.age * 2.2 + p.phase));
          alpha = fade * (.2 + .8 * pulse * pulse);
        } else {
          p.x += (p.vx + Math.sin(p.phase + p.age * .7) * 6) * dt;
          p.y += (p.vy + Math.cos(p.phase + p.age * .9) * 5) * dt;
          alpha = fade * (.45 + .3 * Math.sin(p.age * 2.6 + p.phase)) * (1 - env.night * .35);
        }
      }
      list[kept++] = p;

      c.globalAlpha = Math.max(0, Math.min(1, alpha));
      const img = sprites[p.kind][p.variant];
      if (p.kind === 'petal' || p.kind === 'leaf') {
        // Rotation dans le plan, plus un retournement qui écrase la forme : la feuille semble tournoyer.
        const cos = Math.cos(p.rot) * dpr;
        const sin = Math.sin(p.rot) * dpr;
        const flip = Math.cos(p.phase + p.age * 1.7);
        c.globalCompositeOperation = 'source-over';
        c.setTransform(cos, sin, -sin * flip, cos * flip, p.x * dpr, p.y * dpr);
      } else {
        c.globalCompositeOperation = p.kind === 'snow' ? 'source-over' : 'lighter';
        c.setTransform(dpr, 0, 0, dpr, p.x * dpr, p.y * dpr);
      }
      c.drawImage(img, -p.size / 2, -p.size / 2, p.size, p.size);
    }
    list.length = kept;
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  resize();
  return { resize, step, clear: () => { clear(); list = []; primed = false; for (const k of KINDS) counts[k] = 0; } };
}
