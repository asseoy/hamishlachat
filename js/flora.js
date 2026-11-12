// Seagrass, corals, sponges, anemones, rocks, palms, glowing trench life. All instanced.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rng, clamp, noise2, WORLD } from './ctx.js';
import { height, biome, normalAt, underwater, WU } from './terrain.js';

// ---------- colliders: spheres + yaw boxes in a coarse grid ----------
export function makeColliders() {
  const CELL = 12, map = new Map(), out = [], key = (i, j) => i * 4096 + j;
  const C = {
    addS(x, y, z, r) { const s = { type: 's', x, y, z, r }; ins(s, x, z, r); return s; },
    addB(x, y, z, hx, hy, hz, yaw = 0) { const s = { type: 'b', x, y, z, hx, hy, hz, c: Math.cos(yaw), s: Math.sin(yaw) }; ins(s, x, z, Math.hypot(hx, hz)); return s; },
    near(x, z) { out.length = 0; const i0 = Math.floor(x / CELL), j0 = Math.floor(z / CELL); for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) { const a = map.get(key(i, j)); if (a) for (const s of a) if (!out.includes(s)) out.push(s); } return out; },
  };
  function ins(s, x, z, r) { for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) { const k = key(i, j); let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(s); } }
  G.colliders = C; return C;
}

const swayPatch = (mat, amt = 0.18) => {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 ip = vec3(0.);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float k = max(position.y, 0.0); k = k * k;
        transformed.x += sin(uTime * 1.1 + ip.x * 0.3 + ip.z * 0.2) * ${amt} * k;
        transformed.z += cos(uTime * 0.9 + ip.z * 0.35) * ${amt} * 0.7 * k; }`);
  };
  mat.customProgramCacheKey = () => 'sway' + amt;
  return mat;
};

export function buildFlora() {
  const S = G.scene, r = rng(42), half = WORLD / 2 - 10; G.cull = G.cull || [];
  const nrm = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), m = new THREE.Matrix4(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const Cl = G.colliders;

  // generic placer: sample points, keep those where accept(b,h,x,z,steep) is true
  function scatter(count, accept, maxTries = count * 30, region = null) {
    const pts = [];
    for (let t = 0; t < maxTries && pts.length < count; t++) {
      let x, z;
      if (region) { const a = region.a + (r() - 0.5) * region.da, rr = region.r0 + r() * (region.r1 - region.r0); x = Math.cos(a) * rr; z = Math.sin(a) * rr; }
      else { x = (r() * 2 - 1) * half; z = (r() * 2 - 1) * half; }
      const h = height(x, z); normalAt(x, z, nrm); const b = biome(x, z, h);
      if (accept(b, h, x, z, 1 - nrm.y)) pts.push({ x, z, h, n: nrm.clone() });
    }
    return pts;
  }
  // instances are split into 60 m cells so the camera only draws what is near and on screen
  function instanced(geo, mat, pts, place, opts = {}) {
    const mats = [], cols = [];
    pts.forEach((pt, i) => { place(pt, i); mats.push(m.clone()); if (opts.color) { opts.color(pt, i, col); cols.push(col.clone()); } });
    const cells = new Map(), CS = 60;
    mats.forEach((mm, i) => { const k = Math.floor(mm.elements[12] / CS) + ',' + Math.floor(mm.elements[14] / CS); let a = cells.get(k); if (!a) { a = []; cells.set(k, a); } a.push(i); });
    let first = null;
    for (const [k, idx] of cells) {
      const im = new THREE.InstancedMesh(geo, mat, idx.length); im.castShadow = !!opts.shadow; im.receiveShadow = true;
      idx.forEach((i, j) => { im.setMatrixAt(j, mats[i]); if (opts.color) im.setColorAt(j, cols[i]); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); im.frustumCulled = true; S.add(im);
      G.cull.push({ o: im, c: im.boundingSphere.center.clone(), r: im.boundingSphere.radius, far: opts.far || 150 });
      first = first || im;
    }
    return first;
  }
  const along = (pt, s, yaw, tilt = 1) => { q.setFromUnitVectors(up, up.clone().lerp(pt.n, tilt).normalize()); q2.setFromAxisAngle(up, yaw); q.multiply(q2); p.set(pt.x, pt.h - 0.05, pt.z); sc.setScalar(s); m.compose(p, q, sc); };
  const std = (o) => underwater(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85 }, o)));

  // ---------- seagrass meadows ----------
  {
    const blades = [];
    for (let i = 0; i < 9; i++) { const g = new THREE.PlaneGeometry(0.07, 0.7, 1, 4); g.translate(0, 0.35, 0); const pa = g.attributes.position; for (let k = 0; k < pa.count; k++) { const y = pa.getY(k); pa.setZ(k, pa.getZ(k) + y * y * 0.25); } g.rotateY(r() * Math.PI); g.translate((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5); g.scale(1, 0.6 + r() * 0.8, 1); blades.push(g); }
    const clump = mergeGeometries(blades);
    const mat = swayPatch(std({ color: 0x5f8a3a, side: THREE.DoubleSide, roughness: 0.9 }), 0.22);
    const pts = scatter(6500, (b, h, x, z, st) => (b === 'lagoon' || b === 'slope' || b === 'plain' && h > -28) && st < 0.3 && noise2(x * 0.03, z * 0.03) > -0.05 && h < -1.8);
    instanced(clump, mat, pts, (pt) => along(pt, 0.8 + r() * 0.9, r() * 6), { far: 70, color: (pt, i, c) => c.setHSL(0.24 + r() * 0.06, 0.45, 0.32 + r() * 0.12) });
  }

  // ---------- coral shapes ----------
  const brainGeo = (() => { const g = new THREE.IcosahedronGeometry(0.6, 2); const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pa, i); const n = v.clone().normalize(); const ridge = Math.sin(n.x * 18 + Math.sin(n.z * 9) * 2) * 0.035; v.addScaledVector(n, ridge); if (v.y < 0) v.y *= 0.3; pa.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; })();
  const branchGeo = (() => { const parts = []; const rr = rng(3); const branch = (o, d, len, rad, depth) => { const g = new THREE.CylinderGeometry(rad * 0.7, rad, len, 5, 1, true); g.translate(0, len / 2, 0); const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); g.applyQuaternion(qq); g.translate(o.x, o.y, o.z); parts.push(g); if (depth > 0) { const e = o.clone().addScaledVector(d, len); for (let k = 0; k < 2 + (depth > 1 ? 1 : 0); k++) { const nd = d.clone().add(new THREE.Vector3(rr() - 0.5, rr() * 0.5, rr() - 0.5).multiplyScalar(1.2)).normalize(); branch(e, nd, len * 0.75, rad * 0.7, depth - 1); } } };
    for (let k = 0; k < 4; k++) branch(new THREE.Vector3(), new THREE.Vector3(rr() - 0.5, 1, rr() - 0.5).normalize(), 0.42, 0.055, 2);
    const tips = parts.length; return mergeGeometries(parts.map(g => g.toNonIndexed ? g.toNonIndexed() : g)); })();
  const tableGeo = (() => { const top = new THREE.CylinderGeometry(0.9, 0.75, 0.12, 14, 1); top.translate(0, 0.55, 0); const pa = top.attributes.position; for (let i = 0; i < pa.count; i++) pa.setY(i, pa.getY(i) + Math.sin(pa.getX(i) * 4) * 0.04); const st = new THREE.CylinderGeometry(0.1, 0.18, 0.55, 7); st.translate(0, 0.27, 0); return mergeGeometries([top.toNonIndexed(), st.toNonIndexed()]); })();
  const fanGeo = (() => { const g = new THREE.PlaneGeometry(1.2, 1.1, 6, 6); g.translate(0, 0.55, 0); const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.sin(pa.getX(i) * 2.5) * 0.08); return g; })();
  const fanTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineCap = 'round'; const br = (x, y, a, l, w, d) => { const x2 = x + Math.sin(a) * l, y2 = y - Math.cos(a) * l; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); if (d > 0) { br(x2, y2, a - 0.35 - Math.random() * 0.2, l * 0.78, w * 0.72, d - 1); br(x2, y2, a + 0.35 + Math.random() * 0.2, l * 0.78, w * 0.72, d - 1); } }; br(128, 256, 0, 60, 7, 6); for (let i = 0; i < 800; i++) { g.globalAlpha = 0.3; g.fillStyle = '#fff'; } const t = new THREE.CanvasTexture(c); return t; })();
  const softGeo = (() => { const parts = []; const rr = rng(8); for (let k = 0; k < 9; k++) { const h = 0.25 + rr() * 0.35; const g = new THREE.CylinderGeometry(0.045, 0.06, h, 5, 1, true); g.translate(0, h / 2, 0); g.rotateX((rr() - 0.5) * 0.7); g.rotateZ((rr() - 0.5) * 0.7); g.translate((rr() - 0.5) * 0.3, 0, (rr() - 0.5) * 0.3); parts.push(g.toNonIndexed()); const b = new THREE.SphereGeometry(0.07, 5, 3); b.translate(0, h, 0); b.rotateX(0); parts.push(b.toNonIndexed()); } return mergeGeometries(parts); })();
  const tubeGeo = (() => { const parts = []; const rr = rng(11); for (let k = 0; k < 5; k++) { const h = 0.5 + rr() * 1.1, rad = 0.09 + rr() * 0.07; const g = new THREE.CylinderGeometry(rad, rad * 0.8, h, 9, 1, true); g.translate((rr() - 0.5) * 0.4, h / 2, (rr() - 0.5) * 0.4); parts.push(g.toNonIndexed()); } return mergeGeometries(parts); })();
  const barrelGeo = (() => { const pts2 = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts2.push(new THREE.Vector2(0.35 + Math.sin(t * Math.PI) * 0.25 - (t > 0.9 ? (t - 0.9) * 3 : 0), t * 1.1)); } const g = new THREE.LatheGeometry(pts2, 14); return g; })();
  const anemoneGeo = (() => { const parts = [new THREE.CylinderGeometry(0.22, 0.25, 0.15, 10).translate(0, 0.07, 0).toNonIndexed()]; const rr = rng(13); for (let k = 0; k < 40; k++) { const a = rr() * 6.28, d = rr() * 0.22, h = 0.18 + rr() * 0.12; const g = new THREE.CylinderGeometry(0.012, 0.02, h, 4); g.translate(0, h / 2, 0); g.rotateZ((rr() - 0.5) * 0.9); g.translate(Math.cos(a) * d, 0.12, Math.sin(a) * d); parts.push(g.toNonIndexed()); } return mergeGeometries(parts); })();

  const patch = (x, z) => noise2(x * 0.045, z * 0.045) * 0.7 + noise2(x * 0.15, z * 0.15) * 0.3;
  const onReef = (b, h, x, z, st) => (b === 'reef' && patch(x, z) > -0.25 || b === 'slope' && h > -22 && patch(x, z) > 0.1 || b === 'lagoon' && h < -4 && patch(x, z) > 0.4) && h < -1.2;
  const brain = scatter(2000, onReef);
  instanced(brainGeo, std({ roughness: 0.75 }), brain, (pt) => { along(pt, 0.5 + r() * 1.2, r() * 6, 0.6); if (r() < 0.25) Cl.addS(pt.x, pt.h + 0.2, pt.z, 0.7); }, { shadow: true, color: (pt, i, c) => c.setHSL(r.pick([0.08, 0.12, 0.3, 0.55, 0.9]), 0.45, 0.45 + r() * 0.15) });
  const branches = scatter(2600, onReef);
  instanced(branchGeo, std({ roughness: 0.7 }), branches, (pt) => along(pt, 0.9 + r() * 1.3, r() * 6, 0.3), { far: 75, color: (pt, i, c) => c.setHSL(r.pick([0.95, 0.02, 0.6, 0.13, 0.75]), 0.55, 0.55 + r() * 0.15) });
  const tables = scatter(600, (b, h, x, z, st) => onReef(b, h, x, z, st) && h < -4);
  instanced(tableGeo, std({ roughness: 0.75 }), tables, (pt) => { const s = 0.8 + r() * 1.4; along(pt, s, r() * 6, 0.15); }, { shadow: true, color: (pt, i, c) => c.setHSL(r.pick([0.1, 0.33, 0.5]), 0.35, 0.55) });
  const fans = scatter(1300, (b, h, x, z, st) => onReef(b, h, x, z, st) || b === 'sponge');
  instanced(fanGeo, swayPatch(std({ map: fanTex, alphaTest: 0.4, transparent: false, side: THREE.DoubleSide, roughness: 0.9 }), 0.06), fans, (pt) => along(pt, 0.8 + r() * 1.4, r() * 6, 0.2), { color: (pt, i, c) => c.setHSL(r.pick([0.0, 0.83, 0.08, 0.75]), 0.6, 0.5) });
  const softs = scatter(3200, onReef);
  instanced(softGeo, swayPatch(std({ roughness: 0.8 }), 0.12), softs, (pt) => along(pt, 0.8 + r() * 1.2, r() * 6, 0.5), { far: 70, color: (pt, i, c) => c.setHSL(r.pick([0.9, 0.95, 0.05, 0.8, 0.15]), 0.55, 0.62) });
  const tubes = scatter(1600, (b, h, x, z, st) => b === 'sponge' || b === 'slope' && noise2(x * 0.04, z * 0.04) > 0.5);
  instanced(tubeGeo, std({ roughness: 0.9, side: THREE.DoubleSide }), tubes, (pt) => along(pt, 0.9 + r() * 1.5, r() * 6, 0.3), { shadow: true, color: (pt, i, c) => c.setHSL(r.pick([0.78, 0.08, 0.05, 0.13]), 0.55, 0.45) });
  const barrels = scatter(260, (b, h, x, z, st) => b === 'sponge' || b === 'plain' && r() < 0.1 || b === 'deep' && h > -60);
  instanced(barrelGeo, std({ roughness: 0.95, side: THREE.DoubleSide }), barrels, (pt) => { const s = 0.8 + r() * 1.6; along(pt, s, r() * 6, 0.3); Cl.addS(pt.x, pt.h + 0.5 * s, pt.z, 0.5 * s); }, { shadow: true, color: (pt, i, c) => c.setHSL(0.05 + r() * 0.05, 0.4, 0.35) });
  const anem = scatter(380, (b, h, x, z, st) => (b === 'reef' || b === 'lagoon') && h < -2.5 && st < 0.4);
  instanced(anemoneGeo, swayPatch(std({ roughness: 0.6, emissive: 0x1a0a10 }), 0.25), anem, (pt) => along(pt, 1 + r() * 0.8, r() * 6, 0.8), { color: (pt, i, c) => c.setHSL(r.pick([0.95, 0.12, 0.3]), 0.6, 0.6) });
  G.anemones = anem;

  // ---------- rocks ----------
  const rockGeos = [0, 1, 2].map(k => { const g = new THREE.IcosahedronGeometry(1, 1); const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pa, i); const n = noise2(v.x * 1.7 + k * 10, v.z * 1.7 + v.y) * 0.25 + noise2(v.x * 4 + k, v.y * 4) * 0.08; v.multiplyScalar(1 + n); v.y *= 0.65; pa.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; });
  const rockMat = std({ color: 0x8f8573, roughness: 1, flatShading: false });
  rockGeos.forEach((g, k) => {
    const pts = scatter(330, (b, h, x, z, st) => b !== 'lagoon' && (st > 0.15 || b === 'reef' || b === 'deep' || b === 'trench' || b === 'land' && r() < 0.3 || b === 'beach' && r() < 0.2));
    instanced(g, rockMat, pts, (pt) => { const s = 0.4 + Math.pow(r(), 2) * 3.2; q.setFromEuler(new THREE.Euler(r() * 0.4, r() * 6, r() * 0.4)); p.set(pt.x, pt.h + s * 0.15, pt.z); sc.set(s, s * (0.7 + r() * 0.5), s * (0.8 + r() * 0.4)); m.compose(p, q, sc); if (s > 0.9) Cl.addS(pt.x, pt.h + s * 0.25, pt.z, s * 0.8); },
      { shadow: true, color: (pt, i, c) => { c.setHSL(0.08, 0.12, 0.42 + r() * 0.15); if (pt.h < -40) c.offsetHSL(0.5, 0, -0.12); } });
  });

  // ---------- palms on the island ----------
  {
    const trunk = new THREE.CylinderGeometry(0.16, 0.26, 1, 8, 6, false); trunk.translate(0, 0.5, 0);
    const trunkTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#7a5f40'; g.fillRect(0, 0, 64, 256); for (let y = 0; y < 256; y += 12) { g.fillStyle = 'rgba(40,25,10,.6)'; g.fillRect(0, y, 64, 3); g.fillStyle = 'rgba(200,170,120,.25)'; g.fillRect(0, y + 4, 64, 2); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 6); return t; })();
    const frondG = (() => { const g = new THREE.PlaneGeometry(0.7, 3.2, 1, 8); g.translate(0, 1.6, 0); const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); pa.setX(i, pa.getX(i) * Math.sin(y / 3.2 * Math.PI) * 1.2); pa.setZ(i, -y * y * 0.09); } g.rotateX(-1.1); return g; })();
    const fronds = mergeGeometries([...Array(11)].map((_, k) => frondG.clone().rotateY(k / 11 * Math.PI * 2 + Math.random() * 0.2)));
    const frondTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); g.clearRect(0, 0, 64, 256); g.strokeStyle = '#4f7a2e'; g.lineWidth = 2; for (let y = 6; y < 250; y += 5) { g.beginPath(); g.moveTo(32, y); g.lineTo(2, y - 10); g.moveTo(32, y); g.lineTo(62, y - 10); g.stroke(); } g.strokeStyle = '#6b5a2e'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 256); g.stroke(); return new THREE.CanvasTexture(c); })();
    const pts = scatter(70, (b, h, x, z, st) => (b === 'land' || b === 'beach' && h > 0.8) && st < 0.25 && h < 9);
    const tMat = new THREE.MeshStandardMaterial({ map: trunkTex, roughness: 0.95 }), fMat = swayPatch(underwater(new THREE.MeshStandardMaterial({ map: frondTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 })), 0.02);
    const tops = [];
    const tm = instanced(trunk, tMat, pts, (pt) => { const hgt = 5 + r() * 4; const lean = new THREE.Euler((r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.3); q.setFromEuler(lean); p.set(pt.x, pt.h - 0.2, pt.z); sc.set(1, hgt, 1); m.compose(p, q, sc); const top = new THREE.Vector3(0, hgt, 0).applyQuaternion(q).add(p); tops.push({ top, q: q.clone() }); Cl.addS(pt.x, pt.h + 0.8, pt.z, 0.3); }, { shadow: true });
    instanced(fronds, fMat, tops, (t) => { m.compose(t.top, t.q, sc.setScalar(1)); }, { shadow: true, color: (t, i, c) => c.setHSL(0.24, 0.4, 0.5 + r() * 0.15) });
    G.palmTops = tops.map(t => t.top);
  }

  // ---------- glowing life in the trench and the deep ----------
  {
    const glowGeo = new THREE.CylinderGeometry(0.05, 0.08, 1, 6); glowGeo.translate(0, 0.5, 0);
    const pts = scatter(700, (b, h) => b === 'trench' || b === 'deep' && h < -60);
    const gm = swayPatch(underwater(new THREE.MeshStandardMaterial({ color: 0x113344, emissive: 0x33ffd8, emissiveIntensity: 1.2, roughness: 0.4 })), 0.1);
    instanced(glowGeo, gm, pts, (pt) => along(pt, 0.6 + r() * 1.8, r() * 6, 0.4), { color: (pt, i, c) => c.setHSL(r.pick([0.47, 0.55, 0.8]), 0.8, 0.5) });
  }
}
