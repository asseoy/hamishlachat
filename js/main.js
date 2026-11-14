// Boot, game state (new / load / save), HUD, compass, death, menus, frame loop.
import * as THREE from 'three';
import { G, clamp, save, loadSave, writeSave } from './ctx.js';
import { initInput, pollInput, endInput, input } from './input.js';
import { buildTerrain, WU, PLACES, height } from './terrain.js';
import { createWater } from './water.js';
import { createSky } from './sky.js';
import { makeColliders, buildFlora } from './flora.js';
import { createFauna } from './fauna.js';
import { makeIcons, spawnItems, ITEMS } from './items.js';
import { buildWorld } from './world.js';
import { createPlayer } from './player.js';
import { createInventory, createStory } from './inventory.js';
import { createAudio } from './audio.js';
const safeLock = el => { try { const r = el && el.requestPointerLock && el.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} };

const $ = id => document.getElementById(id);
const err = m => { const e = $('err'); e.classList.remove('hidden'); e.textContent += m + '\n'; };
addEventListener('error', e => err(e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno));
addEventListener('unhandledrejection', e => err('promise: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));
const tick = () => new Promise(r => setTimeout(r, 0));
const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

async function boot() {
  loadSave(); G.settings = save.settings;
  const bar = k => { $('loadBar').style.width = Math.round(k * 100) + '%'; };
  const canvas = $('gl'); G.canvas = canvas;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  G.renderer = renderer; G.scene = new THREE.Scene(); G.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 2600);
  try { await Promise.all(['700 40px "Frank Ruhl Libre"', '700 40px "Karantina"'].map(f => document.fonts.load(f))); } catch (e) {}
  G.logo = await loadImg('assets/logo.webp');
  const st = save.game || {}; const state = { done: new Set(st.done || []), bag: st.bag, eq: st.eq, logs: st.logs, flags: st.flags, step: st.step };
  bar(0.1); await tick(); buildTerrain(); bar(0.3); await tick();
  makeColliders(); buildFlora(); bar(0.5); await tick();
  createWater(); createSky(); bar(0.6); await tick();
  createFauna(); bar(0.7); await tick();
  G.icons = makeIcons(); bar(0.8); await tick();
  spawnItems(state.done); buildWorld(state);
  // a few scraps near the camp beach so the first tank is reachable
  [[-12, 25], [-9, 19], [-14, 21], [-7, 23]].forEach(([x, z], i) => { if (!state.done.has('beachScrap' + i)) G.worldItems.add('scrap', x, height(x, z) + 0.05, z, 'beachScrap' + i); });
  bar(0.9); await tick();
  createPlayer(); const inv = createInventory(state); createStory(state); const audio = createAudio(); G.audio = audio;
  initInput(canvas);
  resize(); addEventListener('resize', resize); applyQuality();
  const P = G.player;
  function spawnAtCamp() { const c = G.campPos; P.pos.set(c.x + 1, height(c.x + 1, c.z + 8) + 0.1, c.z + 8); P.vel.set(0, 0, 0); P.yaw = Math.PI * 0.9; P.pitch = -0.05; P.hp = 100; P.o2 = P.o2Max; P.alive = true; }
  if (st.pos) { P.pos.fromArray(st.pos); P.yaw = st.yaw || 0; Object.assign(P, { hp: st.hp ?? 100, food: st.food ?? 85, water: st.water ?? 80 }); G.sky.time = st.time ?? 0.32; } else spawnAtCamp();

  // ---------- flow ----------
  G.toast = (over, text) => { $('toastOver').textContent = over; $('toastText').textContent = text; const t = $('toast'); t.classList.remove('hidden'); t.style.opacity = 1; clearTimeout(G.toast.tm); G.toast.tm = setTimeout(() => t.style.opacity = 0, 2800); };
  const screens = ['menu', 'help', 'pause', 'loading', 'dead', 'tut'];
  const show = id => { screens.forEach(s => $(s).classList.toggle('hidden', s !== id)); $('hud').classList.toggle('hidden', !!id); };
  function doSave() {
    save.game = { done: [...inv.done], bag: inv.bag, eq: inv.eq, logs: inv.logs, flags: G.story.flags, step: G.story.step, pos: P.pos.toArray(), yaw: P.yaw, hp: P.hp, food: P.food, water: P.water, time: G.sky.time };
    writeSave();
  }
  G.save = doSave;
  function start(fresh) {
    audio.start();
    if (fresh) { save.game = null; writeSave(); location.href = location.pathname + (G.dev ? '?dev&new' : '?new'); return; }
    if (!st.pos && !start.tutDone) { show('tut'); $('tutOk').onclick = () => { start.tutDone = true; start(false); setTimeout(() => G.toast('שבט הנשיא', 'האי של המשלחת'), 400); }; return; }
    G.running = true; G.paused = false; show(null); safeLock(canvas);
  }
  $('btnNew').onclick = () => start(true);
  $('btnLoad').disabled = !save.game; $('btnLoad').onclick = () => start(false);
  $('btnHelp').onclick = () => show('help'); document.querySelectorAll('.back').forEach(b => b.onclick = () => show('menu'));
  const pause = v => { if (!G.running) return; G.paused = v; if (v) { show('pause'); document.exitPointerLock && document.exitPointerLock(); $('sSens').value = save.settings.sens; $('sSfx').value = save.settings.sfx; $('sMusic').value = save.settings.music; $('sQuality').value = save.settings.quality; } else { show(null); safeLock(canvas); } };
  G.onUnlock = () => { if (P.alive) pause(true); };   // dying releases the mouse too – that must not pause the game
  $('btnResume').onclick = () => pause(false);
  $('btnSave').onclick = () => { doSave(); G.running = false; G.paused = false; show('menu'); $('btnLoad').disabled = false; };
  ['sSens', 'sSfx', 'sMusic', 'sQuality'].forEach(id => $(id).addEventListener('input', () => { save.settings.sens = +$('sSens').value; save.settings.sfx = +$('sSfx').value; save.settings.music = +$('sMusic').value; const q = +$('sQuality').value; if (q !== save.settings.quality) { save.settings.quality = q; applyQuality(); } writeSave(); audio.vol(); }));
  G.onDeath = () => { document.exitPointerLock && document.exitPointerLock(); $('fade').style.opacity = 1; setTimeout(() => { show('dead'); $('fade').style.opacity = 0; }, 700); };
  $('btnRevive').onclick = () => {   // lose some raw materials, wake up at camp
    for (const id of Object.keys(inv.bag)) if (!['gear', 'quest', 'tool'].includes(ITEMS[id].cat) && !['solarCell', 'battery'].includes(id) && Math.random() < 0.3) inv.take(id, Math.ceil(inv.bag[id] / 2));
    spawnAtCamp(); G.paused = false; P.food = Math.max(P.food, 40); P.water = Math.max(P.water, 40); show(null); safeLock(canvas);
  };
  G.onChapterEnd = () => { setTimeout(() => inv.showNote('סוף פרק 1', 'הגעת לקרקעית התעלה. מתחת לגבישים הזוהרים מסתתרת דלת מתכת עגולה – הכניסה לתחנה של תמר. הפרק הבא: התחנה בעומק.'), 1500); };
  setInterval(() => { if (G.running && !G.paused && P.alive) doSave(); }, 20000);
  if (/[?&]new/.test(location.search) || (!save.game && G.dev)) { show(null); start(false); history.replaceState(null, '', location.pathname + (G.dev ? '?dev' : '')); } else show('menu');

  // ---------- compass ----------
  const strip = $('compassStrip'), dirs = ['צ', 'צ״מ', 'מ', 'ד״מ', 'ד', 'ד״מע', 'מע', 'צ״מע'];
  strip.innerHTML = [...Array(24)].map((_, i) => `<span>${dirs[i % 8]}</span>`).join('');

  // ---------- loop ----------
  let cullT = 0, last = performance.now(), menuT = 0, fpsA = 0, fpsN = 0, slow = 0, wasUnder = false;
  function step(dt) {
    G.t += dt; WU.uTime.value = G.t;
    pollInput();
    if (G.running && !G.paused) {
      P.update(dt); inv.update(dt);
      for (const e of P.events) { if (e === 'dive' || e === 'surface') audio.play(e); else if (e === 'exhale' || e === 'step' || e === 'jump' || e === 'land') audio.play(e); }
      P.events.length = 0;
      if (Math.random() < dt) G.story.check();
    } else if (!G.running) {
      menuT += dt * 0.05; const c = G.campPos; G.camera.position.set(c.x + Math.sin(menuT) * 70, 14 + Math.sin(menuT * 0.7) * 4, c.z + Math.cos(menuT) * 70); G.camera.lookAt(c.x * 0.3, -2, c.z * 0.3);
    }
    G.sky.update(dt); G.water.update(dt); G.fauna.update(dt); audio.update(dt);
    // distance culling: vegetation cells and loose items far from the camera are not drawn
    cullT -= dt; if (cullT <= 0) { cullT = 0.25; const c = G.camera.position, under = G.water.under, k = under ? 1 : 1.6;
      for (const q of G.cull) q.o.visible = q.c.distanceTo(c) - q.r < q.far * k;
      for (const it of G.worldItems.list) if (!it.gone) it.mesh.visible = it.pos.distanceToSquared(c) < 3600; }
    if (G.campFire) { G.campFire.flame.scale.set(1 + Math.sin(G.t * 13) * 0.08, 1 + Math.sin(G.t * 9) * 0.15, 1); G.campFire.light.intensity = 7 + Math.sin(G.t * 17) * 1.2; }
    if (G.campFlag) { const pa = G.campFlag.geometry.attributes.position, b = G.campFlagBase; for (let i = 0; i < pa.count; i++) { const x = b[i * 3]; pa.array[i * 3 + 2] = Math.sin(x * 4 - G.t * 5) * 0.08 * x; } pa.needsUpdate = true; }
    // HUD
    if (G.running) {
      const o2k = P.o2 / P.o2Max; $('bO2').style.width = o2k * 100 + '%'; $('tO2').textContent = Math.ceil(P.o2) + 'ש׳'; $('bO2').parentNode.parentNode.classList.toggle('low', o2k < 0.25 && P.headUnder);
      $('bHp').style.width = P.hp + '%'; $('bFood').style.width = P.food + '%'; $('bWater').style.width = P.water + '%';
      $('depthNum').textContent = Math.round(P.depth || 0); $('depthMax').textContent = 'מקסימום ' + P.depthMax + ' מ׳'; $('depth').classList.toggle('danger', !!P.crush);
      const under = G.water.under; $('uwTint').style.opacity = under ? (G.maskOn ? 0.55 : 0.9) : 0; $('maskFrame').style.opacity = under && G.maskOn ? 1 : 0;
      $('hurt').style.opacity = (P.drowning || P.crush || P.hp < 25) ? 0.5 + 0.3 * Math.sin(G.t * 6) : 0;
      if (under && !G.maskOn) G.scene.fog.density *= 1.6;           // without a mask everything is blurry and close
      // compass: yaw 0 looks to -z (north)
      const yawDeg = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360; strip.style.left = (210 - 30 - (yawDeg / 45) * 60 - 8 * 60) + 'px';
      const tgt = G.story.target(); const mk = $('compassMark');
      if (tgt) { $('compassDist').textContent = Math.round(Math.hypot(tgt.x - P.pos.x, tgt.z - P.pos.z)) + ' מ׳'; const a = Math.atan2(tgt.x - P.pos.x, -(tgt.z - P.pos.z)) * 180 / Math.PI; let d = ((a - yawDeg + 540) % 360) - 180; mk.style.display = Math.abs(d) < 100 ? 'block' : 'none'; mk.style.left = (210 + d / 45 * 60) + 'px'; } else { mk.style.display = 'none'; $('compassDist').textContent = ''; }
    }
    if (!G.noRender) renderer.render(G.scene, G.camera);
    endInput();
  }
  G.step = step;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(1 / 20, (now - last) / 1000)); last = now;
    fpsA += dt; fpsN++; if (fpsA > 3) { G.fps = fpsN / fpsA; fpsA = 0; fpsN = 0; if (G.running && !G.dev && G.fps < 35 && save.settings.quality > 0) { if (++slow >= 2) { save.settings.quality--; applyQuality(); slow = 0; } } else slow = 0; }
    if (!G.frozen) step(dt);
  }
  requestAnimationFrame(frame);
  window.__ready = true; if (G.dev) window.__m = { G, input, inv, start };
}
function resize() { G.renderer.setSize(innerWidth, innerHeight, false); G.camera.aspect = innerWidth / innerHeight; G.camera.updateProjectionMatrix(); }
function applyQuality() { const q = save.settings.quality, d = devicePixelRatio || 1; G.renderer.setPixelRatio(q >= 2 ? Math.min(d, 2) : q === 1 ? Math.min(d, 1.4) : 1); G.sky && G.sky.applyQuality(q); resize(); }
boot();
