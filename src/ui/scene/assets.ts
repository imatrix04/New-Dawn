/** Images du décor et ce qu'on en déduit une fois pour toutes : masque du ciel (grâce à la carte de profondeur) et lueur nocturne. */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image introuvable : ${src}`));
    img.src = src;
  });
}

/**
 * Lueur nocturne : la photo réduite à ses zones claires (fenêtres, lampes) et floutée. Mêmes réglages que le
 * filtre de `.scene-glow` dans style.css, le flou étant ramené à la petite taille du canvas.
 */
export function buildGlow(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = Math.max(1, Math.round((canvas.width * image.naturalHeight) / image.naturalWidth));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.filter = 'brightness(.74) contrast(5) blur(4px)';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Masque du ciel : les pixels à la fois lointains (carte de profondeur), clairs et neutres (ou bleus).
 * Renvoie un petit canvas en alpha, ou `null` si la photo ne montre pas de ciel.
 */
export function buildSkyMask(image: HTMLImageElement, depth: HTMLImageElement): HTMLCanvasElement | null {
  const W = 320;
  const H = Math.max(1, Math.round((W * image.naturalHeight) / image.naturalWidth));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(depth, 0, 0, W, H);
  const near = ctx.getImageData(0, 0, W, H).data;
  ctx.drawImage(image, 0, 0, W, H);
  const photo = ctx.getImageData(0, 0, W, H);
  const px = photo.data;

  let cover = 0;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const max = Math.max(r, g, b);
    const lum = (.2126 * r + .7152 * g + .0722 * b) / 255;
    const sat = max ? (max - Math.min(r, g, b)) / max : 0;
    const far = 1 - smooth(.03, .1, near[i] / 255);
    const bright = smooth(.55, .78, lum);
    // Ciel couvert : presque neutre. Ciel dégagé : bleu. Les prés et les façades, plus colorés, sont écartés.
    const pale = 1 - smooth(.08, .18, sat);
    const blue = b >= r && b >= g ? 1 - smooth(.5, .7, sat) : 0;
    const a = far * bright * Math.max(pale, blue);
    px[i] = px[i + 1] = px[i + 2] = 255;
    px[i + 3] = Math.round(a * 255);
    cover += a;
  }
  if (cover / (W * H) < .004) return null;
  ctx.putImageData(photo, 0, 0);
  return canvas;
}
