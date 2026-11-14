// Red Sea life: anthias clouds, clownfish at anemones, butterflyfish, parrotfish, sardine schools,
// blue-spotted rays on the sand, sea turtles and jellyfish. Schools are boids that avoid the diver.
import * as THREE from 'three';
import { G, rng, clamp, lerp, damp, noise2 } from './ctx.js';
import { height, biome, underwater, WU, PLACES } from './terrain.js';

function fishGeo(L, Hh, W, paint) {
  const g = new THREE.SphereGeometry(1, 14, 10); g.scale(W, Hh, L);
  const tail = new THREE.BufferGeometry(); const tp = new Float32Array([0, 0, -L * 0.85, 0, Hh * 0.9, -L * 1.45, 0, -Hh * 0.9, -L * 1.45]);
  tail.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tail.computeVertexNormals();
  const fin = new THREE.BufferGeometry(); fin.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, Hh * 0.8, L * 0.3, 0, Hh * 1.5, -L * 0.2, 0, Hh * 0.7, -L * 0.6]), 3)); fin.computeVertexNormals();
  const parts = [g.toNonIndexed(), tail, fin];
  const all = parts.map(p => { if (!p.attributes.uv) p.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.attributes.position.count * 2), 2)); return p; });
  const merged = new THREE.BufferGeometry();
  let n = 0; all.forEach(p => n += p.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0; const c = new THREE.Color();
  all.forEach(p => { pos.set(p.attributes.position.array, o * 3); nor.set(p.attributes.normal.array, o * 3); for (let i = 0; i < p.attributes.position.count; i++) { const x = p.attributes.position.getX(i), y = p.attributes.position.getY(i), z = p.attributes.position.getZ(i); paint(x / W, y / Hh, z / L, c); col.set([c.r, c.g, c.b], (o + i) * 3); } o += p.attributes.position.count; });
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3)); merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return merged;
}
const wiggle = (mat, speed, amp) => {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => { prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3 + length(instanceMatrix[0].xyz) * 40.0;
        #endif
        float back = clamp(-position.z / ${Math.max(0.01, 1).toFixed(2)}, 0.0, 3.0);
        transformed.x += sin(uTime * ${speed.toFixed(2)} + ph + position.z * 6.0) * ${amp.toFixed(3)} * (0.25 + back * back); }`); };
  mat.customProgramCacheKey = () => 'wig' + speed + amp; return mat;
};

export function createFauna() {
  const S = G.scene, r = rng(77), F = { schools: [], extras: [] };
  const mk = (geo, speed, amp, o = {}) => wiggle(underwater(new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.45, metalness: 0.05 }, o))), speed, amp);
  const C = (h) => new THREE.Color(h);
  const SPECIES = {
    anthias: { name: 'אנתיאס', n: 70, geo: fishGeo(0.05, 0.03, 0.012, (x, y, z, c) => c.copy(C('#ff7a3d')).lerp(C('#ff4fa0'), clamp(y * 0.5 + 0.5, 0, 1) * 0.5)), spd: 1.6, wig: [16, 0.012], biome: ['reef'], depth: [-14, -3], tight: 0.9 },
    butterfly: { name: 'דג פרפר', n: 14, geo: fishGeo(0.08, 0.09, 0.015, (x, y, z, c) => { c.copy(C('#ffe14a')); if (Math.abs(z - 0.45) < 0.12) c.set('#202020'); if (y > 0.6) c.lerp(C('#ffffff'), 0.4); }), spd: 1.2, wig: [10, 0.01], biome: ['reef', 'lagoon'], depth: [-10, -2], tight: 0.4 },
    parrot: { name: 'דג תוכי', n: 8, geo: fishGeo(0.3, 0.13, 0.07, (x, y, z, c) => { c.copy(C('#1fa58c')).lerp(C('#5ad1e0'), clamp(y, 0, 1) * 0.6); if (Math.abs(Math.sin(z * 18)) > 0.9) c.lerp(C('#e86aa4'), 0.6); if (z > 0.75) c.set('#3c8fd0'); }), spd: 1.3, wig: [6, 0.02], biome: ['reef', 'slope'], depth: [-18, -4], tight: 0.1, catchable: false },
    sardine: { name: 'סרדין', n: 120, geo: fishGeo(0.09, 0.025, 0.014, (x, y, z, c) => c.copy(C('#b8c8d6')).lerp(C('#2c4a66'), clamp(y * 1.4, 0, 1)).offsetHSL(0, 0, x * 0.05)), spd: 2.4, wig: [18, 0.01], biome: ['plain', 'slope'], depth: [-22, -6], tight: 1.0, metal: 0.6, catchable: true, item: 'sardine' },
    snapper: { name: 'לוטיאנוס', n: 18, geo: fishGeo(0.22, 0.08, 0.05, (x, y, z, c) => { c.copy(C('#d8b45c')).lerp(C('#f2e6c0'), clamp(-y, 0, 1)); if (Math.abs(y - 0.1) < 0.12) c.lerp(C('#3a74c4'), 0.7); }), spd: 1.5, wig: [8, 0.016], biome: ['slope', 'plain', 'sponge'], depth: [-28, -8], tight: 0.6, catchable: true, item: 'snapper' },
  };
  for (const key in SPECIES) {
    const sp = SPECIES[key];
    const mat = mk(sp.geo, sp.wig[0], sp.wig[1], { metalness: sp.metal || 0.05, roughness: sp.metal ? 0.3 : 0.5 });
    const groups = key === 'anthias' ? 9 : key === 'sardine' ? 5 : key === 'butterfly' ? 10 : key === 'parrot' ? 7 : 6;
    for (let gi = 0; gi < groups; gi++) {
      // find a home for the school
      let hx = 0, hz = 0, hh = 0;
      for (let t = 0; t < 400; t++) { const x = (r() - 0.5) * 700, z = (r() - 0.5) * 700, h = height(x, z); if (sp.biome.includes(biome(x, z, h)) && h > sp.depth[0] - 6) { hx = x; hz = z; hh = h; break; } }
      const n = Math.round(sp.n * (0.6 + r() * 0.8)), im = new THREE.InstancedMesh(sp.geo, mat, n); im.frustumCulled = false; im.castShadow = false; S.add(im);
      const fish = []; for (let i = 0; i < n; i++) fish.push({ p: new THREE.Vector3(hx + (r() - 0.5) * 4, Math.min(-1.5, hh + 2 + r() * 3), hz + (r() - 0.5) * 4), v: new THREE.Vector3(r() - 0.5, 0, r() - 0.5).multiplyScalar(sp.spd), s: 0.8 + r() * 0.5, alive: true, dead: 0 });
      F.schools.push({ key, sp, im, fish, home: new THREE.Vector3(hx, hh, hz), target: new THREE.Vector3(hx, hh + 3, hz), tt: 0 });
    }
  }
  // clownfish pairs hover at anemones
  {
    const sp = { name: 'דג ליצן', geo: fishGeo(0.06, 0.035, 0.018, (x, y, z, c) => { c.set('#ff7b1c'); const b = Math.abs(z); if (Math.abs(z - 0.45) < 0.1 || Math.abs(z + 0.1) < 0.1 || z < -0.75) c.set('#ffffff'); if (z < -0.85 || y > 0.85) c.lerp(C('#111'), 0.6); }) };
    const ans = (G.anemones || []).slice(0, 80), n = ans.length * 2, im = new THREE.InstancedMesh(sp.geo, mk(sp.geo, 12, 0.008), n); im.frustumCulled = false; S.add(im);
    F.clowns = { im, ans, ph: ans.map(() => r() * 6) };
  }
  // rays on the sand, turtles cruising, jellyfish drifting
  const rayGeo = (() => { const g = new THREE.PlaneGeometry(1.1, 1.0, 10, 8); g.rotateX(-Math.PI / 2); const pa = g.attributes.position, col = new Float32Array(pa.count * 3), c = new THREE.Color(); for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i), d = Math.abs(x) / 0.55 + Math.abs(z + 0.05) / 0.5; if (d > 1) { pa.setX(i, x / d); pa.setZ(i, z / d); } pa.setY(i, (1 - Math.min(1, d)) * 0.08); c.set('#c8a868'); if (Math.sin(x * 40) * Math.sin(z * 40) > 0.7) c.set('#2f7fe0'); c.toArray(col, i * 3); } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); const tail = new THREE.CylinderGeometry(0.01, 0.02, 0.6, 4).rotateX(Math.PI / 2).translate(0, 0.02, -0.75).toNonIndexed(); return g; })();
  const rayMat = underwater(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
  rayMat.onBeforeCompile = ((prev) => (sh, rr) => { prev(sh, rr); sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    { float ph = 0.0;
      #ifdef USE_INSTANCING
        ph = instanceMatrix[3].x + instanceMatrix[3].z;
      #endif
      transformed.y += sin(uTime * 2.2 + ph - abs(position.x) * 3.0) * 0.12 * abs(position.x) * 2.0; }`); })(rayMat.onBeforeCompile);
  rayMat.customProgramCacheKey = () => 'ray';
  const rays = []; const rayIm = new THREE.InstancedMesh(rayGeo, rayMat, 12); rayIm.frustumCulled = false; S.add(rayIm);
  for (let i = 0; i < 12; i++) { let x, z, h; for (let t = 0; t < 200; t++) { x = (r() - 0.5) * 500; z = (r() - 0.5) * 500; h = height(x, z); const b = biome(x, z, h); if (b === 'lagoon' || b === 'plain') break; } rays.push({ p: new THREE.Vector3(x, h + 0.3, z), yaw: r() * 6, sp: 0.6 + r() * 0.4, turn: 0 }); }
  F.rays = { im: rayIm, list: rays };

  const turtles = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const shellTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#5a4a2a'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#2e2412'; x.lineWidth = 3; for (let k = 0; k < 14; k++) { x.beginPath(); const cx = (k % 4) * 36 + (Math.floor(k / 4) % 2) * 18, cy = Math.floor(k / 4) * 32; for (let a = 0; a < 7; a++) x.lineTo(cx + Math.cos(a * 1.047) * 18, cy + Math.sin(a * 1.047) * 18); x.stroke(); } return new THREE.CanvasTexture(c); })();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), underwater(new THREE.MeshStandardMaterial({ map: shellTex, roughness: 0.6 }))); shell.scale.set(0.85, 0.45, 1); g.add(shell);
    const skin = underwater(new THREE.MeshStandardMaterial({ color: 0x8a8a5a, roughness: 0.8 }));
    const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 14), skin); belly.scale.set(1, 1, 1.15); g.add(belly);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skin); head.scale.set(0.9, 0.8, 1.2); head.position.set(0, 0.03, 0.58); g.add(head);
    const flips = [];
    for (const [sx, sz, len] of [[1, 0.25, 0.55], [-1, 0.25, 0.55], [1, -0.35, 0.25], [-1, -0.35, 0.25]]) { const piv = new THREE.Group(); piv.position.set(sx * 0.38, 0, sz); const f = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.18), skin); f.position.x = sx * len / 2; piv.add(f); g.add(piv); flips.push({ piv, sx, front: sz > 0 }); }
    let x, z, h; for (let t = 0; t < 200; t++) { x = (r() - 0.5) * 400; z = (r() - 0.5) * 400; h = height(x, z); if (h < -5 && h > -25) break; }
    g.position.set(x, h + 3, z); S.add(g);
    turtles.push({ g, flips, yaw: r() * 6, sp: 0.9, target: new THREE.Vector3(x, h + 3, z), tt: 0, ph: r() * 6 });
  }
  F.turtles = turtles;

  const jelly = [];
  const bellG = new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const jMat = new THREE.MeshStandardMaterial({ color: 0xd8c8ff, emissive: 0x8a6aff, emissiveIntensity: 0.25, transparent: true, opacity: 0.55, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const tentM = new THREE.LineBasicMaterial({ color: 0xc8b8ff, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group(); const b = new THREE.Mesh(bellG, jMat); g.add(b);
    const lines = []; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const pts = []; for (let s = 0; s < 6; s++) pts.push(new THREE.Vector3(Math.cos(a) * 0.15, -s * 0.12, Math.sin(a) * 0.15)); const lg = new THREE.BufferGeometry().setFromPoints(pts); const l = new THREE.Line(lg, tentM); g.add(l); lines.push(l); }
    let x, z, h; for (let t = 0; t < 200; t++) { x = (r() - 0.5) * 600; z = (r() - 0.5) * 600; h = height(x, z); if (h < -6) break; }
    g.position.set(x, lerp(h + 2, -1.5, r()), z); S.add(g); jelly.push({ g, b, lines, ph: r() * 6, drift: new THREE.Vector3(r() - 0.5, 0, r() - 0.5).multiplyScalar(0.15) });
  }
  F.jelly = jelly;

  // ---------- update ----------
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1), dir = new THREE.Vector3(), tmp = new THREE.Vector3(), cen = new THREE.Vector3(), avg = new THREE.Vector3();
  F.update = (dt) => {
    const P = G.player.pos, cam = G.camera.position, t = G.t;
    for (const sc_ of F.schools) {
      const far = sc_.home.distanceTo(cam) > 140; if (far && Math.random() > 0.1) continue;   // distant schools update rarely
      const ddt = far ? dt * 10 : dt;
      sc_.tt -= ddt;
      if (sc_.tt <= 0) { sc_.tt = 4 + Math.random() * 6; for (let k = 0; k < 20; k++) { const x = sc_.home.x + (Math.random() - 0.5) * 30, z = sc_.home.z + (Math.random() - 0.5) * 30, h = height(x, z); if (h < -2) { sc_.target.set(x, clamp(h + 1.5 + Math.random() * 3, sc_.sp.depth[0], Math.min(sc_.sp.depth[1], -1.2)), z); break; } } }
      cen.set(0, 0, 0); avg.set(0, 0, 0); let n = 0; for (const f of sc_.fish) if (f.alive) { cen.add(f.p); avg.add(f.v); n++; } if (!n) continue; cen.divideScalar(n); avg.divideScalar(n);
      const fl = sc_.fish, sp = sc_.sp;
      for (let i = 0; i < fl.length; i++) {
        const f = fl[i];
        if (!f.alive) { f.dead -= ddt; if (f.dead <= 0) { f.alive = true; f.p.copy(sc_.target); } sc_.im.setMatrixAt(i, m.makeScale(0, 0, 0)); continue; }
        // steer: toward target + cohesion + alignment, away from neighbours and the diver
        dir.copy(sc_.target).sub(f.p).multiplyScalar(0.25);
        dir.addScaledVector(tmp.copy(cen).sub(f.p), 0.6 * sp.tight).addScaledVector(avg, 0.3);
        for (let k = 1; k <= 3; k++) { const o = fl[(i + k * 7) % fl.length]; tmp.copy(f.p).sub(o.p); const d2 = tmp.lengthSq(); if (d2 < 0.09 && d2 > 1e-6) dir.addScaledVector(tmp, 0.3 / d2); }
        tmp.copy(f.p).sub(P); tmp.y -= 1; const dp = tmp.length(); if (dp < 4) dir.addScaledVector(tmp, (4 - dp) * 3 / dp);
        const floor = height(f.p.x, f.p.z); if (f.p.y < floor + 0.6) dir.y += 3; if (f.p.y > -0.8) dir.y -= 3;
        f.v.addScaledVector(dir, ddt * 2.2);
        const s = f.v.length(), max = sp.spd * (dp < 4 ? 2.2 : 1) * f.s; if (s > max) f.v.multiplyScalar(max / s); if (s < sp.spd * 0.3) f.v.multiplyScalar(1.2);
        f.p.addScaledVector(f.v, ddt);
        q.setFromUnitVectors(up, tmp.copy(f.v).normalize()); sc.setScalar(f.s); m.compose(f.p, q, sc); sc_.im.setMatrixAt(i, m);
      }
      sc_.im.instanceMatrix.needsUpdate = true;
    }
    if (F.clowns) { const { im, ans, ph } = F.clowns; for (let i = 0; i < ans.length; i++) for (let k = 0; k < 2; k++) { const a = ans[i], tt = t * (0.8 + k * 0.3) + ph[i] + k * 3; tmp.set(a.x + Math.cos(tt) * 0.35, a.h + 0.45 + Math.sin(tt * 1.7) * 0.1, a.z + Math.sin(tt) * 0.35); dir.set(-Math.sin(tt), 0, Math.cos(tt)); q.setFromUnitVectors(up, dir); m.compose(tmp, q, sc.setScalar(1)); im.setMatrixAt(i * 2 + k, m); } im.instanceMatrix.needsUpdate = true; }
    for (let i = 0; i < F.rays.list.length; i++) { const ry = F.rays.list[i]; ry.turn = damp(ry.turn, Math.sin(t * 0.2 + i) * 0.5, 1, dt); ry.yaw += ry.turn * dt; ry.p.x += Math.sin(ry.yaw) * ry.sp * dt; ry.p.z += Math.cos(ry.yaw) * ry.sp * dt; const h = height(ry.p.x, ry.p.z); if (h > -2 || h < -32) ry.yaw += Math.PI * dt; ry.p.y = damp(ry.p.y, h + 0.35, 2, dt); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry.yaw); m.compose(ry.p, q, sc.setScalar(1.3)); F.rays.im.setMatrixAt(i, m); } F.rays.im.instanceMatrix.needsUpdate = true;
    for (const tu of F.turtles) {
      tu.tt -= dt; if (tu.tt <= 0 || tu.g.position.distanceTo(tu.target) < 2) { tu.tt = 15; for (let k = 0; k < 20; k++) { const x = tu.g.position.x + (Math.random() - 0.5) * 60, z = tu.g.position.z + (Math.random() - 0.5) * 60, h = height(x, z); if (h < -4 && h > -30) { tu.target.set(x, Math.min(-1, h + 2 + Math.random() * 4), z); break; } } }
      dir.copy(tu.target).sub(tu.g.position).normalize(); const ty = Math.atan2(dir.x, dir.z); let dy = ty - tu.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); tu.yaw += clamp(dy, -0.4 * dt, 0.4 * dt);
      tu.g.position.x += Math.sin(tu.yaw) * tu.sp * dt; tu.g.position.z += Math.cos(tu.yaw) * tu.sp * dt; tu.g.position.y += dir.y * 0.4 * dt;
      tu.g.rotation.set(-dir.y * 0.5, tu.yaw, Math.sin(t * 0.8 + tu.ph) * 0.06);
      const st = Math.sin(t * 1.6 + tu.ph); for (const f of tu.flips) f.piv.rotation.set(f.front ? st * 0.25 : 0, f.front ? -f.sx * st * 0.3 : 0, f.sx * (f.front ? st * 0.7 : Math.sin(t * 1.6 + tu.ph + 1) * 0.3));
    }
    for (const j of F.jelly) { const pu = Math.sin(t * 2.2 + j.ph); j.b.scale.set(1 + pu * 0.12, 1 - pu * 0.15, 1 + pu * 0.12); j.g.position.addScaledVector(j.drift, dt); j.g.position.y += (pu > 0 ? 0.12 : -0.03) * dt; if (j.g.position.y > -1) j.g.position.y = -1; j.lines.forEach((l, k) => l.rotation.set(Math.sin(t * 1.3 + k) * 0.15, 0, Math.cos(t * 1.1 + k) * 0.15)); }
  };
  // catch the nearest catchable fish in front of the diver
  F.catchNear = (pos, look, reach = 1.8) => {
    let best = null, bd = reach;
    for (const s of F.schools) { if (!s.sp.catchable || s.home.distanceTo(pos) > 60) continue; for (const f of s.fish) { if (!f.alive) continue; tmp.copy(f.p).sub(pos); const d = tmp.length(); if (d < bd && tmp.normalize().dot(look) > 0.75) { bd = d; best = { s, f }; } } }
    if (!best) return null; best.f.alive = false; best.f.dead = 40; return best.s.sp.item;
  };
  G.fauna = F;
  return F;
}
