// Hand-placed places: the expedition camp, the sunken research boat "שחף", giant clams, journal pages.
import * as THREE from 'three';
import { G, rng, clamp } from './ctx.js';
import { height, underwater, PLACES } from './terrain.js';
import { itemModel } from './items.js';

export const LOGS = [
  { t: 'יומן המשלחת – יום 1', b: 'הגענו לאי עם "שחף". המים צלולים כמו באילת. תמר אומרת שהשונית כאן לא מופיעה באף מפה. מחר מתחילים לצלול.' },
  { t: 'יומן המשלחת – יום 4', b: 'בלגונה ספרנו שלושה צבי ים ולהקה של אלפי אנתיאס. נועם מצא גביש קטן שזוהר בחושך, על החול מעבר לשונית. מאיפה הוא הגיע?' },
  { t: 'יומן המשלחת – יום 7', b: 'צללנו עד המדרון. בכל פעם שאנחנו מתקרבים לתעלה הגדולה, המצפן משתגע. אסור לרדת לשם בלי חליפת עומק.' },
  { t: 'יומן המשלחת – יום 9', b: 'הסערה הגיעה בלילה. העוגן נקרע. "שחף" נגרר לים ושקע במישור החולי. הצלחנו לחלץ רק חלק מהציוד. מכשיר הקשר נשאר בספינה.' },
  { t: 'יומן המשלחת – יום 12', b: 'פירקתי את הרדיו לשלושה חלקים כדי להציל אותו מהמים, והחבאתי אותם בספינה. מי שימצא את היומן: תחבר אותם בשולחן העבודה במחנה.' },
  { t: 'יומן המשלחת – יום 15', b: 'בגן הספוגים יש שקט מוזר. הדגים נעלמים כשהגבישים זוהרים. תמר רוצה לרדת לתעלה לבדוק. אני מפחד.' },
  { t: 'יומן המשלחת – יום 18', b: 'תמר ירדה לתעלה עם הסקוטר ולא חזרה כל הלילה. בבוקר היא שידרה ברדיו: "יש כאן משהו. בנוי. תבואו". ואז השקט.' },
  { t: 'יומן המשלחת – יום 21', b: 'אם אתם קוראים את זה – אל תפחדו מהים. תכבדו אותו. תאספו רק מה שצריך, ותחזירו כוכבי ים למקום. ובבקשה: תמצאו את תמר.' },
];

function rustTex(name) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#e8e2d6'; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 260; i++) { const x = Math.random() * 512, y = Math.random() * 256, r = 4 + Math.random() * 28; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,60,25,.9)'); gr.addColorStop(1, 'rgba(120,60,25,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(110,55,20,.5)'; g.lineWidth = 2; const x = Math.random() * 512; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 20, 80 + Math.random() * 170); g.stroke(); }
  g.fillStyle = 'rgba(40,90,60,.35)'; g.fillRect(0, 200, 512, 56);
  g.fillStyle = '#1d3a6a'; g.fillRect(0, 170, 512, 14);
  if (name) { g.fillStyle = '#1d3a6a'; g.font = '700 70px "Frank Ruhl Libre", serif'; g.textAlign = 'center'; g.direction = 'rtl'; g.fillText(name, 256, 120); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function buildWorld(state) {
  const S = G.scene, Cl = G.colliders, I = []; G.interactables = I;
  const done = state.done;                                            // keys of used things
  const box = (w, h, d, mat, x, y, z, yaw = 0, col = true, parent = S) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = yaw; m.castShadow = m.receiveShadow = true; parent.add(m); if (col) Cl.addB(x, y, z, w / 2, h / 2, d / 2, yaw); return m; };
  const M = (c, o = {}) => underwater(new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, o)));

  // ================= camp =================
  const cx = PLACES.camp.x, cz = PLACES.camp.z, cy = height(cx, cz);
  const wood = M(0x8a6440), tarp = M(0x5f6e3b, { side: THREE.DoubleSide }), tarpO = M(0xb8582a, { side: THREE.DoubleSide });
  const at = (dx, dz) => ({ x: cx + dx, z: cz + dz, y: height(cx + dx, cz + dz) });
  // tents
  for (const [dx, dz, m] of [[-6, -3, tarp], [-6, 4, tarpO]]) { const p = at(dx, dz); const t = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.9, 4, 1, true), m); t.position.set(p.x, p.y + 0.95, p.z); t.rotation.y = Math.PI / 4; t.castShadow = true; S.add(t); Cl.addB(p.x, p.y + 0.9, p.z, 1.2, 0.9, 1.2); }
  // workbench
  const wb = at(2, -2);
  box(2.2, 0.08, 1.0, wood, wb.x, wb.y + 0.9, wb.z, 0.3);
  for (const [lx, lz] of [[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]]) { const c = Math.cos(0.3), s = Math.sin(0.3); box(0.08, 0.9, 0.08, wood, wb.x + lx * c + lz * s, wb.y + 0.45, wb.z - lx * s + lz * c, 0.3, false); }
  const tools = itemModel('knife'); tools.position.set(wb.x - 0.4, wb.y + 0.96, wb.z); S.add(tools);
  const tk = itemModel('o2Tank'); tk.position.set(wb.x + 0.5, wb.y + 1.0, wb.z + 0.1); S.add(tk);
  I.push({ pos: new THREE.Vector3(wb.x, wb.y + 1, wb.z), r: 2.2, label: 'שולחן עבודה – ייצור', kind: 'craft' });
  // camp fire
  const fp = at(-1, 3);
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), M(0x777066)); st.position.set(fp.x + Math.cos(a) * 0.7, fp.y + 0.1, fp.z + Math.sin(a) * 0.7); S.add(st); }
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.9, 6), M(0x4a3020)); l.position.set(fp.x, fp.y + 0.25, fp.z); l.rotation.set(1.0, i * 2.1, 0); S.add(l); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85 })); flame.position.set(fp.x, fp.y + 0.55, fp.z); S.add(flame);
  const fl = new THREE.PointLight(0xff9a40, 8, 14, 1.6); fl.position.set(fp.x, fp.y + 1, fp.z); S.add(fl);
  G.campFire = { flame, light: fl };
  I.push({ pos: new THREE.Vector3(fp.x, fp.y + 0.5, fp.z), r: 2, label: 'מדורה – בישול', kind: 'craft', tab: 'אוכל' });
  // radio table
  const rp = at(4, 4);
  box(1.2, 0.06, 0.7, wood, rp.x, rp.y + 0.8, rp.z, -0.4); box(1.1, 0.8, 0.06, wood, rp.x, rp.y + 0.4, rp.z, -0.4, false);
  const brokenRadio = itemModel('radio'); brokenRadio.position.set(rp.x, rp.y + 0.9, rp.z); brokenRadio.rotation.y = -0.4; brokenRadio.scale.setScalar(2); S.add(brokenRadio);
  I.push({ pos: new THREE.Vector3(rp.x, rp.y + 1, rp.z), r: 2, label: 'עמדת הקשר', kind: 'radio' });
  // tribe flag
  const fg = at(0, -6);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 5, 8), wood); pole.position.set(fg.x, fg.y + 2.5, fg.z); S.add(pole);
  if (G.logo) { const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d'); g.fillStyle = '#f1efeb'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#a8121b'; g.fillRect(0, 0, 256, 18); g.fillRect(0, 142, 256, 18); const w = 110, h = w * G.logo.height / G.logo.width; g.drawImage(G.logo, 128 - w / 2, 80 - h / 2, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const fgm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.88, 10, 4).translate(0.7, 0, 0), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 })); fgm.position.set(fg.x, fg.y + 4.4, fg.z); S.add(fgm); G.campFlag = fgm; G.campFlagBase = Float32Array.from(fgm.geometry.attributes.position.array); }
  // crates + the wrecked dinghy on the beach
  for (const [dx, dz] of [[3, -5], [3.7, -4.6], [-3, -6]]) { const p = at(dx, dz); box(0.8, 0.6, 0.6, M(0x7a5a3a), p.x, p.y + 0.3, p.z, dx); }
  const dp = at(-10, 22); const boat = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.7, 4, 12, 1, true, 0, Math.PI), M(0xd8d0c0, { side: THREE.DoubleSide })); boat.rotation.set(0, 0.5, Math.PI / 2); boat.position.set(dp.x, dp.y + 0.5, dp.z); boat.castShadow = true; S.add(boat); Cl.addB(dp.x, dp.y + 0.4, dp.z, 0.9, 0.5, 2, 0.5);

  // ================= the sunken boat "שחף" =================
  const wx = PLACES.wreck.x, wz = PLACES.wreck.z, wy = height(wx, wz), yaw = 0.7;
  const hullMat = underwater(new THREE.MeshStandardMaterial({ map: rustTex('שחף'), roughness: 0.8, metalness: 0.3, side: THREE.DoubleSide }));
  const rust = M(0x6a4030, { metalness: 0.4, roughness: 0.9 }), deck = M(0x6e5a44, { roughness: 1 });
  const W = new THREE.Group(); W.position.set(wx, wy - 0.4, wz); W.rotation.y = yaw; S.add(W);
  const L = 22, Wd = 6, Hh = 4;
  const wl = (x, y, z, w, h, d, m) => { const mm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mm.position.set(x, y, z); mm.castShadow = mm.receiveShadow = true; W.add(mm); const wp = W.localToWorld(new THREE.Vector3(x, y, z)); Cl.addB(wp.x, wp.y, wp.z, w / 2, h / 2, d / 2, yaw); return mm; };
  W.updateMatrixWorld();
  wl(0, 0.2, 0, Wd, 0.4, L, rust);                                         // bottom
  wl(-Wd / 2, Hh / 2, -3, 0.2, Hh, L - 6, hullMat);                        // port side, intact
  wl(Wd / 2, Hh / 2, -7, 0.2, Hh, 8, hullMat);                             // starboard: broken open in the middle
  wl(Wd / 2, Hh / 2, 6.5, 0.2, Hh, 5, hullMat);
  wl(Wd / 2, 0.9, 1.5, 0.2, 1.4, 4, hullMat);                              // low rim at the breach: swim in over it
  wl(0, Hh / 2, -L / 2, Wd, Hh, 0.2, hullMat);                             // stern
  wl(-1.5, Hh / 2, L / 2 - 1.5, 3, Hh, 0.2, hullMat);                      // bow part
  wl(0, Hh, -5, Wd, 0.15, 10, deck);                                       // deck aft (roof inside)
  wl(0, Hh, 8, Wd, 0.15, 4, deck);
  // cabin: walls only, so you can swim in
  wl(-1.8, Hh + 1.3, -6, 0.12, 2.4, 4, M(0xe8e2d6)); wl(1.8, Hh + 1.3, -6.9, 0.12, 2.4, 2.2, M(0xe8e2d6)); wl(0, Hh + 1.3, -8, 3.6, 2.4, 0.12, M(0xe8e2d6)); wl(0, Hh + 2.5, -6, 3.6, 0.12, 4, M(0xe8e2d6));
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 11, 8), rust); mast.position.set(4.5, 1.2, 3); mast.rotation.set(0.15, 0, 1.35); W.add(mast);
  for (let i = 0; i < 30; i++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.15 + Math.random() * 0.2, 0.3 + Math.random() * 0.5, 6), M(new THREE.Color().setHSL(Math.random() < 0.5 ? 0.9 : 0.1, 0.5, 0.55))); b.position.set((Math.random() - 0.5) * Wd, Hh + 0.1, (Math.random() - 0.5) * L * 0.8); W.add(b); }   // corals growing on the deck
  W.updateMatrixWorld();
  // loot inside the boat
  const loot = [
    { lp: [1.5, 0.6, -9], items: { radioPart: 1, battery: 1 }, key: 'crate1' }, { lp: [-1.8, 0.6, 2], items: { radioPart: 1, wires: 2 }, key: 'crate2' },
    { lp: [0, Hh + 0.6, -6.5], items: { radioPart: 1, solarCell: 1 }, key: 'crate3' }, { lp: [1.5, 0.6, 7.5], items: { battery: 1, scrap: 2, wires: 1 }, key: 'crate4' },
  ];
  for (const l of loot) {
    const wp = W.localToWorld(new THREE.Vector3(...l.lp));
    const cr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.6), M(0x3d5a3a, { roughness: 0.7 })); cr.position.copy(wp); cr.rotation.y = yaw; cr.castShadow = true; S.add(cr);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.62), M(0xf3e03b)); lid.position.y = 0.31; cr.add(lid);
    I.push({ pos: wp, r: 1.8, label: 'ארגז ציוד של המשלחת', kind: 'loot', items: l.items, key: l.key, mesh: cr, used: done.has(l.key) });
    if (done.has(l.key)) lid.rotation.x = -1.2;
  }
  // ================= giant clams =================
  const r = rng(31);
  let clams = 0;
  for (let t = 0; t < 2000 && clams < 14; t++) {
    const a = r() * 6.28, d = 112 + r() * 30, x = Math.cos(a) * d, z = Math.sin(a) * d, h = height(x, z); if (h > -3 || h < -18) continue;
    const g = new THREE.Group(); g.position.set(x, h, z); g.rotation.y = r() * 6; S.add(g);
    const sh = (s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xd8cfb8, { side: THREE.DoubleSide })); m.scale.set(1, 0.5, 0.75); m.rotation.x = s * 0.35; g.add(m); return m; };
    sh(1).position.z = 0.02; const top = sh(-1); top.rotation.x = Math.PI - 0.35; top.position.y = 0.06;
    const mantle = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.15), M(0x3a2a9a, { emissive: 0x2a1aa0, emissiveIntensity: 0.4 })); mantle.position.y = 0.08; g.add(mantle);
    const key = 'clam' + clams; clams++;
    I.push({ pos: new THREE.Vector3(x, h + 0.2, z), r: 1.6, label: 'צדפת ענק', kind: 'clam', key, used: done.has(key) });
  }
  // ================= journal pages =================
  const logSpots = [[cx + 3, cz - 1, 1.0], [-80, 30, null], [118, -40, null], [null, null, 'wreckA'], [null, null, 'wreckB'], [Math.cos(1.2) * 230, Math.sin(1.2) * 230, null], [Math.cos(3.9) * 205, Math.sin(3.9) * 205, null], [Math.cos(3.9) * 255, Math.sin(3.9) * 255, null]];
  logSpots.forEach((s, i) => {
    let p;
    if (s[2] === 'wreckA') p = W.localToWorld(new THREE.Vector3(-1.5, 0.45, -4)); else if (s[2] === 'wreckB') p = W.localToWorld(new THREE.Vector3(0.8, Hh + 0.15, -5.5));
    else p = new THREE.Vector3(s[0], height(s[0], s[1]) + (s[2] || 0.05), s[1]);
    if (i === 0) p.y = height(wb.x, wb.z) + 0.95, p.x = wb.x + 0.2, p.z = wb.z - 0.2;
    const key = 'log' + i;
    const m = itemModel('journal'); m.position.copy(p); m.rotation.y = r() * 6; S.add(m); if (done.has(key)) m.visible = false;
    I.push({ pos: p, r: 1.6, label: 'דף יומן', kind: 'log', idx: i, key, mesh: m, used: done.has(key) });
  });
  G.wreckPos = new THREE.Vector3(wx, wy, wz);
  G.campPos = new THREE.Vector3(cx, cy, cz);
}
