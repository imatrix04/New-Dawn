import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MIN_SIZE, useLayout, type WindowId } from './layout';

interface Props {
  id: WindowId;
  title: string;
  children: ReactNode;
}

/** Friction du glissement après le lâcher (constante de temps, en ms). */
const GLIDE_TIME_MS = 180;
/** Vitesse maximale du lancer (px/ms) : le glissement dépasse au plus d'environ 320 px. */
const MAX_GLIDE_SPEED = 1.8;
/** Part minimale de la carte qui doit rester visible dans le tableau. */
const MIN_VISIBLE = 100;

type ResizeMode = 'e' | 's' | 'se';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function BoardWindow({ id, title, children }: Props) {
  const { t } = useTranslation();
  const win = useLayout((s) => s.windows[id]);
  const focus = useLayout((s) => s.focus);
  const move = useLayout((s) => s.move);
  const resize = useLayout((s) => s.resize);
  const close = useLayout((s) => s.close);

  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  // La carte reste montée le temps de l'animation de fermeture.
  const [mounted, setMounted] = useState(win.open);
  const [exiting, setExiting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    if (win.open) {
      setMounted(true);
      setExiting(false);
    } else {
      setExiting(true);
    }
  }, [win.open]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = ref.current;
    const board = el?.parentElement;
    if (!el || !board) return;
    e.preventDefault();
    cancelAnimationFrame(raf.current);

    const clampPos = (x: number, y: number) => ({
      x: clamp(x, MIN_VISIBLE - el.offsetWidth, board.clientWidth - MIN_VISIBLE),
      y: clamp(y, 0, board.clientHeight - 48),
    });
    const place = (x: number, y: number) => {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };

    // Position réelle (un glissement peut être en cours).
    const originX = parseFloat(el.style.left) || win.x;
    const originY = parseFloat(el.style.top) || win.y;
    const startX = e.clientX;
    const startY = e.clientY;
    let x = originX;
    let y = originY;
    let vx = 0; // vitesse en px/ms, lissée
    let vy = 0;
    let lastT = performance.now();
    let lastX = e.clientX;
    let lastY = e.clientY;

    setDragging(true);
    focus(id);

    const onMove = (ev: globalThis.PointerEvent) => {
      const p = clampPos(originX + ev.clientX - startX, originY + ev.clientY - startY);
      x = p.x;
      y = p.y;
      place(x, y);

      const now = performance.now();
      const dt = now - lastT;
      if (dt > 0) {
        vx = 0.7 * vx + 0.3 * ((ev.clientX - lastX) / dt);
        vy = 0.7 * vy + 0.3 * ((ev.clientY - lastY) / dt);
      }
      lastT = now;
      lastX = ev.clientX;
      lastY = ev.clientY;
      // La carte s'incline légèrement dans le sens du mouvement.
      el.style.setProperty('--tilt', `${clamp(vx * 3, -4, 4)}deg`);
    };

    const glide = () => {
      // Plafonne la vitesse : un geste très brusque ne doit pas envoyer la carte hors du tableau.
      const speed = Math.hypot(vx, vy);
      if (speed > MAX_GLIDE_SPEED) {
        vx *= MAX_GLIDE_SPEED / speed;
        vy *= MAX_GLIDE_SPEED / speed;
      }
      let prev = performance.now();
      const step = (now: number) => {
        const dt = Math.min(32, now - prev);
        prev = now;
        const wantX = x + vx * dt;
        const wantY = y + vy * dt;
        const p = clampPos(wantX, wantY);
        if (p.x !== wantX) vx = 0; // arrêt contre le bord
        if (p.y !== wantY) vy = 0;
        x = p.x;
        y = p.y;
        place(x, y);
        const friction = Math.exp(-dt / GLIDE_TIME_MS);
        vx *= friction;
        vy *= friction;
        if (Math.hypot(vx, vy) > 0.02) raf.current = requestAnimationFrame(step);
        else move(id, x, y);
      };
      if (Math.hypot(vx, vy) > 0.05) raf.current = requestAnimationFrame(step);
      else move(id, x, y);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDragging(false);
      el.style.setProperty('--tilt', '0deg');
      if (performance.now() - lastT > 80) {
        vx = 0; // la souris s'est arrêtée avant le lâcher : pas de glissement
        vy = 0;
      }
      glide();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  /** Redimensionne par un bord (e, s) ou le coin (se). La taille est bornée par le tableau. */
  const startResize = (mode: ResizeMode) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = ref.current;
    const board = el?.parentElement;
    if (!el || !board) return;
    e.preventDefault();
    e.stopPropagation();
    cancelAnimationFrame(raf.current);
    focus(id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = el.offsetWidth;
    const startH = el.offsetHeight;
    const maxW = Math.max(MIN_SIZE.w, board.clientWidth - el.offsetLeft - 4);
    const maxH = Math.max(MIN_SIZE.h, board.clientHeight - el.offsetTop - 4);
    let w = startW;
    let h = startH;
    const changesH = mode !== 'e';

    setResizing(true);

    const onMove = (ev: globalThis.PointerEvent) => {
      if (mode !== 's') w = clamp(startW + ev.clientX - startX, MIN_SIZE.w, maxW);
      if (changesH) h = clamp(startH + ev.clientY - startY, MIN_SIZE.h, maxH);
      el.style.width = `${w}px`;
      if (changesH) el.style.height = `${h}px`;
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setResizing(false);
      resize(id, w, changesH ? h : useLayout.getState().windows[id].h);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  /** Double-clic sur un bord inférieur : retour à la hauteur automatique. */
  const autoHeight = () => resize(id, useLayout.getState().windows[id].w, null);

  if (!mounted) return null;

  return (
    <div
      ref={ref}
      className={`win win-${id}${exiting ? ' exiting' : ''}${dragging ? ' dragging' : ''}${resizing ? ' resizing' : ''}`}
      style={{ left: win.x, top: win.y, zIndex: win.z, width: win.w, height: win.h ?? undefined }}
      onPointerDown={() => focus(id)}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && exiting) {
          setMounted(false);
          setExiting(false);
        }
      }}
    >
      <div className="win-title" onPointerDown={startDrag}>
        <span>{title}</span>
        <button
          className="win-close"
          title={t('board.close')}
          aria-label={t('board.close')}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => close(id)}
        >
          ✕
        </button>
      </div>
      <div className="win-body">{children}</div>

      <div className="win-resize win-resize-e" onPointerDown={startResize('e')} />
      <div className="win-resize win-resize-s" onPointerDown={startResize('s')} onDoubleClick={autoHeight} title={t('board.autoHeight')} />
      <div className="win-resize win-resize-se" onPointerDown={startResize('se')} onDoubleClick={autoHeight} title={t('board.autoHeight')} />
    </div>
  );
}
