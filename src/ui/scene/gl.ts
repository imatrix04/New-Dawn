import type { Light } from './light';

/**
 * Rendu WebGL du décor, sans bibliothèque : parallaxe par carte de profondeur, étalonnage, ciel, lumière de l'heure
 * et grain en un seul passage. Les mêmes effets existent en calques CSS (style.css) pour le repli sans WebGL, mais
 * chaque calque `mix-blend-mode` y est recomposé à la moindre animation de l'écran : ici, tout tient dans un shader.
 */

type Vec4 = [number, number, number, number];

/** Réglages lus dans les variables CSS `--scene-*` du décor : une seule source pour les deux rendus. */
export interface Look {
  saturate: number;
  contrast: number;
  sepia: number;
  brightness: number;
  toneTop: Vec4;
  toneBottom: Vec4;
  tone: number;
  grain: number;
  light: number;
  glow: number;
  sky: number;
}

export function readLook(root: HTMLElement): Look {
  const style = getComputedStyle(root);
  const num = (name: string, fallback: number) => {
    const value = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  // Une couleur de variable CSS n'est qu'un texte : on la fait résoudre par le navigateur.
  const probe = document.createElement('i');
  root.appendChild(probe);
  const color = (name: string): Vec4 => {
    probe.style.color = `var(${name})`;
    const parts = (getComputedStyle(probe).color.match(/[\d.]+/g) ?? []).map(Number);
    return [(parts[0] ?? 255) / 255, (parts[1] ?? 255) / 255, (parts[2] ?? 255) / 255, parts[3] ?? 1];
  };
  const look: Look = {
    saturate: num('--scene-saturate', 1),
    contrast: num('--scene-contrast', 1),
    sepia: num('--scene-sepia', 0),
    brightness: num('--scene-brightness', 1),
    toneTop: color('--scene-tone-top'),
    toneBottom: color('--scene-tone-bottom'),
    tone: num('--scene-tone', 0),
    grain: num('--scene-grain', 0),
    light: num('--scene-light', 1),
    glow: num('--scene-glow', 0),
    sky: num('--scene-sky', 1),
  };
  probe.remove();
  return look;
}

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * .5 + .5;
  gl_Position = vec4(aPos, 0., 1.);
}`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform sampler2D uGlow;
uniform sampler2D uSky;
uniform vec2 uCover;
uniform vec2 uOffset;
uniform vec4 uGrade;       // saturation, contraste, sépia, luminosité
uniform vec4 uToneTop;
uniform vec4 uToneBottom;
uniform float uTone;
uniform vec3 uMul;
uniform vec4 uWash;
uniform float uGlowAmount;
uniform float uSkyAmount;
uniform float uGrain;
varying vec2 vUv;

// Mêmes formules que les filtres et modes de fusion CSS, pour que les deux rendus se ressemblent.
vec3 softLight(vec3 b, vec3 s) {
  vec3 d = mix(((16. * b - 12.) * b + 4.) * b, sqrt(b), step(.25, b));
  return mix(b - (1. - 2. * s) * b * (1. - b), b + (2. * s - 1.) * (d - b), step(.5, s));
}

void main() {
  // Profondeur : la carte vaut 1 au premier plan et 0 au loin. Le lointain reste fixe, le premier plan glisse le plus ;
  // deux itérations de point fixe retrouvent la profondeur du pixel d'arrivée et limitent les déchirures aux contours.
  vec2 uv = (vUv - .5) * uCover + .5;
  float d = texture2D(uDepth, uv).r;
  d = texture2D(uDepth, uv + uOffset * d).r;
  d = texture2D(uDepth, uv + uOffset * d).r;
  vec2 at = uv + uOffset * d;
  vec3 c = texture2D(uImage, at).rgb;

  // Étalonnage : saturate, contrast, sepia, brightness.
  c = mix(vec3(dot(c, vec3(.2126, .7152, .0722))), c, uGrade.x);
  c = (c - .5) * uGrade.y + .5;
  c = mix(c, vec3(dot(c, vec3(.393, .769, .189)), dot(c, vec3(.349, .686, .168)), dot(c, vec3(.272, .534, .131))), uGrade.z);
  c = clamp(c * uGrade.w, 0., 1.);

  // Ciel (voile et nuages, déjà découpés par le masque), puis lueur nocturne des zones claires en « screen ».
  vec4 sky = texture2D(uSky, vUv);
  c = mix(c, sky.rgb, sky.a * uSkyAmount);
  c = 1. - (1. - c) * (1. - texture2D(uGlow, at).rgb * uGlowAmount);

  // Lumière de l'heure : teinte en « multiply », puis dégradé chaud et voile coloré en « soft-light ».
  c *= uMul;
  float y = 1. - vUv.y;
  vec4 grad = y < .5 ? vec4(uToneTop.rgb, uToneTop.a * (1. - y * 2.)) : vec4(uToneBottom.rgb, uToneBottom.a * (y * 2. - 1.));
  float a = grad.a + uWash.a * (1. - grad.a);
  vec3 tone = (grad.rgb * grad.a + uWash.rgb * uWash.a * (1. - grad.a)) / max(a, .0001);
  c = mix(c, softLight(c, tone), a * uTone);

  // Grain fin, fixe.
  float n = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - .5) * uGrain * .5;

  gl_FragColor = vec4(c, 1.);
}`;

export interface SceneSources {
  image: HTMLImageElement;
  /** Carte de profondeur ; sans elle, le rendu est plat et la parallaxe simple (CSS) prend le relais. */
  depth: HTMLImageElement | null;
  /** Zones claires de la photo, floutées : la lueur nocturne. */
  glow: HTMLCanvasElement;
}

export interface SceneRenderer {
  /** Redimensionne le tampon (pixels réels) et recadre la photo en « cover ». */
  resize: (width: number, height: number) => void;
  /** Recharge la texture du ciel depuis son canvas (`null` : pas de ciel). */
  setSky: (sky: HTMLCanvasElement | null) => void;
  /** Dessine. Le décalage, en coordonnées UV, est celui du premier plan : le lointain ne bouge pas. */
  render: (offsetX: number, offsetY: number, light: Light) => void;
  dispose: () => void;
}

/** Renvoie `null` si WebGL est indisponible (ou seulement logiciel) : l'appelant garde le rendu en calques CSS. */
export function createSceneRenderer(canvas: HTMLCanvasElement, sources: SceneSources, look: Look, onLost: () => void): SceneRenderer | null {
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true });
    if (!gl) return null;
    const g = gl;

    const compile = (type: number, source: string) => {
      const shader = g.createShader(type);
      if (!shader) throw new Error('shader');
      g.shaderSource(shader, source);
      g.compileShader(shader);
      if (!g.getShaderParameter(shader, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(shader) ?? 'shader');
      return shader;
    };
    const program = g.createProgram();
    if (!program) return null;
    g.attachShader(program, compile(g.VERTEX_SHADER, VERTEX));
    g.attachShader(program, compile(g.FRAGMENT_SHADER, FRAGMENT));
    g.linkProgram(program);
    if (!g.getProgramParameter(program, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(program) ?? 'program');
    g.useProgram(program);
    const uniform = (name: string) => g.getUniformLocation(program, name);

    // Un seul grand triangle couvre l'écran.
    g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    const aPos = g.getAttribLocation(program, 'aPos');
    g.enableVertexAttribArray(aPos);
    g.vertexAttribPointer(aPos, 2, g.FLOAT, false, 0, 0);

    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, 1);
    const EMPTY = new Uint8Array(4); // un pixel noir transparent : profondeur nulle, ciel absent
    const texture = (unit: number, name: string, source: TexImageSource | null) => {
      g.activeTexture(g.TEXTURE0 + unit);
      g.bindTexture(g.TEXTURE_2D, g.createTexture());
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      if (source) g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, source); // lève une exception si l'image est d'une autre origine
      else g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, EMPTY);
      g.uniform1i(uniform(name), unit);
    };
    texture(0, 'uImage', sources.image);
    texture(1, 'uDepth', sources.depth);
    texture(2, 'uGlow', sources.glow);
    texture(3, 'uSky', null);
    if (g.getError() !== g.NO_ERROR) return null;

    g.uniform4f(uniform('uGrade'), look.saturate, look.contrast, look.sepia, look.brightness);
    g.uniform4fv(uniform('uToneTop'), look.toneTop);
    g.uniform4fv(uniform('uToneBottom'), look.toneBottom);
    g.uniform1f(uniform('uTone'), look.tone);
    g.uniform1f(uniform('uGrain'), look.grain);
    const uCover = uniform('uCover');
    const uOffset = uniform('uOffset');
    const uMul = uniform('uMul');
    const uWash = uniform('uWash');
    const uGlowAmount = uniform('uGlowAmount');
    const uSkyAmount = uniform('uSkyAmount');

    const lost = (e: Event) => { e.preventDefault(); onLost(); };
    canvas.addEventListener('webglcontextlost', lost);

    const imageRatio = sources.image.naturalWidth / sources.image.naturalHeight;
    return {
      resize(width, height) {
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        g.viewport(0, 0, canvas.width, canvas.height);
        const ratio = canvas.width / canvas.height;
        if (ratio > imageRatio) g.uniform2f(uCover, 1, imageRatio / ratio);
        else g.uniform2f(uCover, ratio / imageRatio, 1);
      },
      setSky(sky) {
        g.activeTexture(g.TEXTURE3);
        if (sky) g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, sky);
        else g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, EMPTY);
        g.uniform1f(uSkyAmount, sky ? look.sky : 0);
      },
      render(offsetX, offsetY, light) {
        const k = look.light / 255;
        g.uniform2f(uOffset, offsetX, offsetY);
        g.uniform3f(uMul, 1 - look.light + light.mul[0] * k, 1 - look.light + light.mul[1] * k, 1 - look.light + light.mul[2] * k);
        g.uniform4f(uWash, light.wash[0] / 255, light.wash[1] / 255, light.wash[2] / 255, light.washA);
        g.uniform1f(uGlowAmount, light.night * look.glow);
        g.drawArrays(g.TRIANGLES, 0, 3);
      },
      dispose() {
        canvas.removeEventListener('webglcontextlost', lost);
        g.getExtension('WEBGL_lose_context')?.loseContext();
      },
    };
  } catch {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
}
