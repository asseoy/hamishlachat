// Island + seafloor heightfield, biomes, chunked mesh, heightmap texture for the water shader,
// and the shared "underwater" shader patch (caustics + depth absorption) used by every seabed material.
import * as THREE from 'three';
import { G, clamp, lerp, smooth, noise2, fbm, WORLD, rng } from './ctx.js';

const TRENCH_A = 3.9, SPONGE_A = 1.2, WRECK = { x: 205, z: 95 };
export const PLACES = { wreck: WRECK, camp: { x: -18, z: 38 }, trench: { a: TRENCH_A }, sponge: { a: SPONGE_A } };
const angDist = (a, b) => { let d = Math.abs(a - b) % (Math.PI * 2); return d > Math.PI ? Math.PI * 2 - d : d; };

export function islandR(a) { return 62 + 16 * noise2(Math.cos(a) * 1.4 + 3, Math.sin(a) * 1.4 - 2) + 6 * noise2(Math.cos(a) * 4, Math.sin(a) * 4); }

export function height(x, z) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x), R = islandR(a);
  let h;
  if (r < R) {                                       // land: dunes rising to a rocky hill
    const k = 1 - r / R; h = 1.4 + 15 * Math.pow(k, 1.6) + 2.2 * fbm(x * 0.03, z * 0.03, 3) * k + 0.6 * noise2(x * 0.15, z * 0.15) * k;
  } else if (r < R + 9) {                            // beach slope
    h = lerp(1.4, -2.6, smooth(R, R + 9, r));
  } else if (r < 108) {                              // lagoon
    h = lerp(-2.6, -7, smooth(R + 9, 100, r)) + 0.8 * fbm(x * 0.04, z * 0.04, 3);
  } else if (r < 135) {                              // reef crest
    const c = Math.exp(-Math.pow((r - 120) / 7, 2));
    h = lerp(-7, -16, smooth(108, 135, r)) + c * 6 + 2.2 * fbm(x * 0.07, z * 0.07, 4);
  } else if (r < 195) {                              // reef slope
    h = lerp(-16, -25, smooth(135, 195, r)) + 2.5 * fbm(x * 0.05, z * 0.05, 4);
  } else if (r < 305) {                              // sandy plain (wreck)
    h = -25 - 6 * smooth(195, 305, r) + 0.7 * noise2(x * 0.08, z * 0.08) + 0.35 * Math.sin(x * 0.6 + noise2(x * 0.02, z * 0.02) * 4);
  } else {                                           // drop-off into the deep
    h = lerp(-31, -78, smooth(305, 390, r)) - 8 * smooth(390, 460, r) + 4 * fbm(x * 0.03, z * 0.03, 4);
  }
  // sponge garden: a raised field of mounds
  const sg = Math.max(0, 1 - angDist(a, SPONGE_A) / 0.35) * smooth(150, 200, r) * (1 - smooth(290, 320, r));
  if (sg > 0) h += sg * (3 + 3 * fbm(x * 0.06, z * 0.06, 3));
  // trench: a deep canyon cutting outward
  const tw = Math.max(0, 1 - angDist(a, TRENCH_A) / 0.16) * smooth(170, 240, r);
  if (tw > 0) h -= Math.pow(tw, 1.5) * (40 + (r - 170) * 0.45);
  // wreck site: flatten a little
  const wd = Math.hypot(x - WRECK.x, z - WRECK.z); if (wd < 30) h = lerp(h, -27, (1 - wd / 30) * 0.7);
  return h;
}
export function biome(x, z, h) {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  if (h > 1.2) return 'land'; if (h > -1.5) return 'beach';
  if (Math.max(0, 1 - angDist(a, TRENCH_A) / 0.16) * smooth(170, 240, r) > 0.4 && h < -40) return 'trench';
  if (r < 106) return 'lagoon'; if (r < 140) return 'reef'; if (r < 195) return 'slope';
  if (angDist(a, SPONGE_A) < 0.33 && r < 300) return 'sponge';
  if (r < 305) return 'plain'; return 'deep';
}
export function normalAt(x, z, out) { const e = 0.8, hx = height(x + e, z) - height(x - e, z), hz = height(x, z + e) - height(x, z - e); return out.set(-hx, 2 * e, -hz).normalize(); }

// ---------- underwater shader patch shared by seabed materials ----------
export const WU = { uTime: { value: 0 }, uCaus: { value: null }, uCausK: { value: 1 }, uSunCol: { value: new THREE.Color(1, 1, 1) } };
export function underwater(mat, opts = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, WU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn; uniform float uTime;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        vec4 cwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cwp = instanceMatrix * cwp;
        #endif
        cwp = modelMatrix * cwp; vWp = cwp.xyz;
        vec3 cwn = objectNormal;
        #ifdef USE_INSTANCING
          cwn = mat3(instanceMatrix) * cwn;
        #endif
        vWn = normalize(mat3(modelMatrix) * cwn);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWp; varying vec3 vWn; uniform float uTime; uniform sampler2D uCaus; uniform float uCausK; uniform vec3 uSunCol;`)
      .replace('#include <opaque_fragment>', `
        if (vWp.y < 0.3) {
          float d = max(0.0, -vWp.y);
          // sunlight that reaches depth d loses red first, then green
          vec3 absorb = exp(-vec3(0.075, 0.03, 0.017) * d);
          outgoingLight *= mix(vec3(1.0), absorb, smoothstep(0.3, -0.6, vWp.y)) ;
          // caustics: two scrolling layers of a cell texture, min-combined
          vec2 p = vWp.xz * 0.11;
          float c1 = texture2D(uCaus, p + vec2(uTime * 0.021, uTime * 0.013)).r;
          float c2 = texture2D(uCaus, p * 1.23 + vec2(-uTime * 0.017, uTime * 0.024)).r;
          float c = pow(min(c1, c2), 1.6) * 2.4;
          float up = clamp(vWn.y * 0.8 + 0.2, 0.0, 1.0);
          outgoingLight += diffuseColor.rgb * uSunCol * c * up * uCausK * exp(-d * 0.06) * smoothstep(0.3, -0.8, vWp.y) * ${opts.causK || '0.9'};
        }
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'uw' + (opts.causK || '');
  return mat;
}

function causticTexture() {         // tileable Worley-edge pattern
  const N = 256, pts = [], r = rng(5), cells = 8;
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) pts.push([(i + r()) / cells, (j + r()) / cells]);
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N; let f1 = 9, f2 = 9;
    for (const p of pts) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const dx = u - p[0] - ox, dy = v - p[1] - oy, d = dx * dx + dy * dy;
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    const e = Math.sqrt(f2) - Math.sqrt(f1), val = Math.pow(clamp(1 - e * 9, 0, 1), 3);
    const k = (y * N + x) * 4; data[k] = data[k + 1] = data[k + 2] = val * 255; data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

function sandTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26000; i++) { const v = 100 + Math.random() * 60; g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.5})`; g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? 60 : 200},${Math.random() < 0.5 ? 60 : 200},${Math.random() < 0.5 ? 60 : 200},.25)`; g.beginPath(); g.arc(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2.5, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

export function buildTerrain() {
  const S = G.scene;
  WU.uCaus.value = causticTexture();
  const mat = underwater(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: sandTexture() }), { causK: '1.0' });
  mat.map.repeat.set(1, 1);
  const CH = 100, RES = 2, N = CH / RES + 1, half = WORLD / 2;
  const col = new THREE.Color(), nrm = new THREE.Vector3();
  const C = {
    land: new THREE.Color('#e2cd98'), grass: new THREE.Color('#a3a857'), rock: new THREE.Color('#a8957a'), beach: new THREE.Color('#e9dbb5'),
    lagoon: new THREE.Color('#f0e3bf'), reef: new THREE.Color('#c7b48f'), plain: new THREE.Color('#d8c9a2'), slope: new THREE.Color('#b8a684'),
    sponge: new THREE.Color('#a99b7e'), deep: new THREE.Color('#5f6670'), trench: new THREE.Color('#3b3f48'),
  };
  for (let cx = -half; cx < half; cx += CH) for (let cz = -half; cz < half; cz += CH) {
    const g = new THREE.PlaneGeometry(CH, CH, N - 1, N - 1); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx + CH / 2, z = pos.getZ(i) + cz + CH / 2, h = height(x, z);
      pos.setXYZ(i, x, h, z); normalAt(x, z, nrm); nor.setXYZ(i, nrm.x, nrm.y, nrm.z); uv.setXY(i, x / 6, z / 6);
      const b = biome(x, z, h), steep = 1 - nrm.y;
      col.copy(C[b] || C.plain);
      if (b === 'land') { col.lerp(C.grass, clamp(0.2 + 0.7 * noise2(x * 0.05, z * 0.05), 0, 0.65) * smooth(3, 6, h)); }
      if (steep > 0.25) col.lerp(C.rock, smooth(0.25, 0.55, steep));
      col.offsetHSL(0, 0, 0.04 * noise2(x * 0.2, z * 0.2));
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = false; m.matrixAutoUpdate = false; S.add(m);
  }
  // depth texture for the water shader (turquoise shallows, foam on the shore)
  const TN = 256, data = new Uint8Array(TN * TN * 4);
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
    const x = (i + 0.5) / TN * WORLD - half, z = (j + 0.5) / TN * WORLD - half, h = height(x, z), k = (j * TN + i) * 4;
    data[k] = clamp(-h / 60, 0, 1) * 255; data[k + 1] = clamp((h + 3) / 6, 0, 1) * 255; data[k + 2] = 0; data[k + 3] = 255;
  }
  const ht = new THREE.DataTexture(data, TN, TN); ht.magFilter = ht.minFilter = THREE.LinearFilter; ht.needsUpdate = true;
  G.heightTex = ht;
  G.terrainMat = mat;
}
