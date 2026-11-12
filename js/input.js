// Keyboard + mouse with pointer lock. Edge flags reset every frame.
import { G } from './ctx.js';
const safeLock = el => { try { const r = el && el.requestPointerLock && el.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} };
export const input = { f: 0, s: 0, jump: false, down: false, sprint: false, mx: 0, my: 0, locked: false, keys: {},
  jumpPressed: false, usePressed: false, invPressed: false, lampPressed: false, escPressed: false, clickPressed: false, num: 0 };
export function initInput(canvas) {
  const k = input.keys;
  addEventListener('keydown', e => {
    if (e.code === 'Tab') e.preventDefault();
    if (e.repeat) return; k[e.code] = true;
    if (e.code === 'Space') { input.jumpPressed = true; e.preventDefault(); }
    if (e.code === 'KeyE') input.usePressed = true;
    if (e.code === 'Tab' || e.code === 'KeyI') input.invPressed = true;
    if (e.code === 'KeyF') input.lampPressed = true;
    if (e.code === 'Escape') input.escPressed = true;
    if (/^Digit[1-6]$/.test(e.code)) input.num = +e.code.slice(5);
  });
  addEventListener('keyup', e => { k[e.code] = false; });
  addEventListener('blur', () => { for (const c in k) k[c] = false; });
  canvas.addEventListener('mousedown', e => { if (G.running && !G.uiOpen && !G.paused) { if (!input.locked) safeLock(canvas); else input.clickPressed = true; } });
  document.addEventListener('pointerlockchange', () => { input.locked = document.pointerLockElement === canvas; if (!input.locked && G.running && !G.uiOpen && !G.paused && !G.dev) G.onUnlock && G.onUnlock(); });
  addEventListener('mousemove', e => { if (input.locked || G.dev) { input.mx += e.movementX || 0; input.my += e.movementY || 0; } });
}
export function pollInput() {
  if (input.scripted) return; const k = input.keys;
  input.f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
  input.s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  input.jump = !!k.Space; input.down = !!(k.KeyC || k.ControlLeft); input.sprint = !!(k.ShiftLeft || k.ShiftRight);
}
export function endInput() { input.jumpPressed = input.usePressed = input.invPressed = input.lampPressed = input.escPressed = input.clickPressed = false; input.num = 0; input.mx = input.my = 0; }
