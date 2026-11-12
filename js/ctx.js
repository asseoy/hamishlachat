// Shared state, math helpers, noise.
export const G = { dev: /[?&]dev/.test(location.search), t: 0, running: false, paused: false, uiOpen: false };
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const WATER = 0;           // sea level
export const WORLD = 900;         // world size (metres), centred on 0

export function rng(seed) {
  let s = seed >>> 0;
  const r = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  r.range = (a, b) => a + (b - a) * r(); r.int = (a, b) => Math.floor(a + (b - a + 1) * r()); r.pick = a => a[Math.floor(r() * a.length)];
  return r;
}

// ---- 2D simplex noise (seeded) ----
const grad = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const perm = new Uint8Array(512);
{ const r = rng(1234), p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
export function noise2(x, y) {
  const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
  const x0 = x - (i - t), y0 = y - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2, ii = i & 255, jj = j & 255;
  let n = 0, tt;
  tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { const g = grad[perm[ii + perm[jj]] & 7]; tt *= tt; n += tt * tt * (g[0] * x0 + g[1] * y0); }
  tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { const g = grad[perm[ii + i1 + perm[jj + j1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x1 + g[1] * y1); }
  tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { const g = grad[perm[ii + 1 + perm[jj + 1]] & 7]; tt *= tt; n += tt * tt * (g[0] * x2 + g[1] * y2); }
  return 70 * n;
}
export const fbm = (x, y, oct = 4) => { let a = 0, f = 1, w = 0.5, s = 0; for (let i = 0; i < oct; i++) { a += noise2(x * f, y * f) * w; s += w; f *= 2.03; w *= 0.5; } return a / s; };

// ---- save ----
const KEY = 'hamishlachat.v1';
export const save = { settings: { sens: 1, sfx: 0.8, music: 0.4, quality: 2 }, game: null };
export function loadSave() { try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); if (s.settings) Object.assign(save.settings, s.settings); save.game = s.game || null; } catch (e) {} }
export function writeSave() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }
