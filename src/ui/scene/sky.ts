import { css, type Light } from './light';

// Nuages : [x, y, échelle, couche] dans une tuile de 1600 × 900 qui se répète. Couche 0 = lointaine et lente, 1 = proche.
type Cloud = readonly [number, number, number, 0 | 1];
const CLOUDS: Cloud[] = [
  [80, 60, .8, 0], [420, 210, .6, 0], [760, 110, .9, 0], [1100, 330, .7, 0], [1380, 40, .6, 0], [250, 430, .75, 0], [900, 520, .65, 0], [1300, 480, .8, 0], [600, 300, .55, 0],
  [200, 150, 1.2, 1], [700, 420, 1, 1], [1200, 220, 1.3, 1], [1500, 560, 1.1, 1], [450, 30, 1, 1], [1000, 60, 1.15, 1],
];
const TILE_W = 1600;
const TILE_H = 900;
/** Vitesse des deux couches, en unités de tuile par seconde (une traversée d'écran : 4 min et 2 min 30). */
const SPEED = [TILE_W / 240, TILE_W / 150];
/** Largeur du canvas : volontairement basse, l'agrandissement adoucit les nuages et le bord du masque. */
const WIDTH = 640;

export interface Sky {
  /** Redessine le ciel : `time` (secondes) fait dériver les nuages. */
  draw: (time: number, light: Light) => void;
}

/**
 * Ciel du décor, dessiné sur un petit canvas : voile coloré selon l'heure et nuages stylisés, découpés par le masque
 * du ciel de la photo (voir `buildSkyMask`). `ratio` est le rapport largeur / hauteur de l'écran.
 */
export function createSky(canvas: HTMLCanvasElement, mask: HTMLCanvasElement, ratio: number): Sky | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const W = WIDTH;
  const H = Math.max(1, Math.round(WIDTH / ratio));
  canvas.width = W;
  canvas.height = H;

  // Le masque suit le cadrage « cover » de la photo.
  const scale = Math.max(W / mask.width, H / mask.height);
  const mw = mask.width * scale;
  const mh = mask.height * scale;
  const mx = (W - mw) / 2;
  const my = (H - mh) / 2;
  const k = W / TILE_W; // la tuile occupe la largeur du canvas
  const rows = Math.ceil(H / (TILE_H * k));

  return {
    draw(time, light) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // Voile du ciel, un peu plus clair vers l'horizon.
      ctx.globalAlpha = 1;
      ctx.fillStyle = css(light.sky, light.skyA);
      ctx.fillRect(0, 0, W, H);
      const horizon = ctx.createLinearGradient(0, H * .3, 0, H);
      horizon.addColorStop(0, 'rgb(255 255 255 / 0)');
      horizon.addColorStop(1, 'rgb(255 255 255 / .16)');
      ctx.fillStyle = horizon;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = css(light.cloud);
      ctx.globalAlpha = .92;
      for (const [x, y, s, layer] of CLOUDS) {
        const width = 190 * s;
        // Position bouclée : le nuage sort entièrement à gauche avant de rentrer par la droite.
        const span = TILE_W + width;
        const cx = ((((x + width - time * SPEED[layer]) % span) + span) % span) - width;
        for (let row = 0; row < rows; row++) {
          ctx.setTransform(k * s, 0, 0, k * s, cx * k, (y + row * TILE_H) * k);
          ctx.beginPath();
          ctx.ellipse(60, 50, 44, 26, 0, 0, Math.PI * 2);
          ctx.moveTo(142, 36);
          ctx.ellipse(102, 36, 40, 30, 0, 0, Math.PI * 2);
          ctx.moveTo(184, 52);
          ctx.ellipse(144, 52, 40, 22, 0, 0, Math.PI * 2);
          ctx.roundRect(30, 50, 140, 24, 12);
          ctx.fill();
        }
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, mx, my, mw, mh);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}
