// Ocean surface (both sides), underwater fog/colour, god rays, marine snow, bubbles.
import * as THREE from 'three';
import { G, clamp, lerp, damp, WORLD } from './ctx.js';
import { WU } from './terrain.js';

export function createWater() {
  const S = G.scene;
  const U = {
    uTime: WU.uTime, uHeight: { value: G.heightTex }, uWorld: { value: WORLD },
    uSun: { value: new THREE.Vector3(0.4, 0.8, 0.3) }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
    uSkyTop: { value: new THREE.Color('#4a86c6') }, uSkyHor: { value: new THREE.Color('#bcd8e6') },
    uDeep: { value: new THREE.Color('#0a3a5e') }, uShallow: { value: new THREE.Color('#25c4c4') }, uNight: { value: 0 },
  };
  Object.assign(U, THREE.UniformsUtils.clone(THREE.UniformsLib.fog));
  const waves = `
    vec3 gerst(vec2 p, vec2 d, float a, float k, float s, inout vec3 tb, inout vec3 bn){
      float f = k * (dot(d, p) - s * uTime); float c = cos(f), sn = sin(f);
      tb += vec3(-d.x*d.x*a*k*sn, d.x*a*k*c, -d.x*d.y*a*k*sn);
      bn += vec3(-d.x*d.y*a*k*sn, d.y*a*k*c, -d.y*d.y*a*k*sn);
      return vec3(d.x * a * c * 0.6, a * sn, d.y * a * c * 0.6);
    }
    vec3 waveSum(vec2 p, out vec3 n){
      vec3 tb = vec3(1.,0.,0.), bn = vec3(0.,0.,1.), o = vec3(0.);
      o += gerst(p, normalize(vec2(1.0, 0.3)), 0.22, 0.16, 1.3, tb, bn);
      o += gerst(p, normalize(vec2(-0.4, 1.0)), 0.13, 0.31, 1.7, tb, bn);
      o += gerst(p, normalize(vec2(0.7, -0.8)), 0.07, 0.62, 2.3, tb, bn);
      o += gerst(p, normalize(vec2(-0.9, -0.2)), 0.04, 1.1, 3.1, tb, bn);
      n = normalize(cross(bn, tb)); return o;
    }`;
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: true,
    vertexShader: `uniform float uTime; varying vec3 vW; varying vec3 vN; ${waves}
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.); vec3 n; vec3 o = waveSum(w.xz, n);
        float far = clamp(1.0 - length(w.xz - cameraPosition.xz) / 260.0, 0.0, 1.0); w.xyz += o * far; vN = mix(vec3(0.,1.,0.), n, far); vW = w.xyz;
        vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime, uWorld, uNight; uniform sampler2D uHeight; uniform vec3 uSun, uSunCol, uSkyTop, uSkyHor, uDeep, uShallow; varying vec3 vW; varying vec3 vN;
      #include <fog_pars_fragment>
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 uv = (vW.xz + uWorld * 0.5) / uWorld; vec4 hm = texture2D(uHeight, uv);
        float depth = hm.r * 60.0, shore = hm.g;
        // fine ripples
        vec2 q = vW.xz * 0.9; float e = 0.12;
        float r0 = vn(q + uTime * 0.6) + vn(q * 2.3 - uTime * 0.9) * 0.5;
        float rx = vn(q + vec2(e,0.) + uTime * 0.6) + vn((q + vec2(e,0.)) * 2.3 - uTime * 0.9) * 0.5;
        float rz = vn(q + vec2(0.,e) + uTime * 0.6) + vn((q + vec2(0.,e)) * 2.3 - uTime * 0.9) * 0.5;
        vec3 N = normalize(vN + vec3(r0 - rx, 0., r0 - rz) * 0.55);
        vec3 V = normalize(cameraPosition - vW);
        if (gl_FrontFacing) {
          float shallow = 1.0 - smoothstep(0.0, 22.0, depth);
          vec3 water = mix(uDeep, uShallow, pow(shallow, 1.4));
          water = mix(water, vec3(0.62, 0.9, 0.85), pow(1.0 - smoothstep(0.0, 3.0, depth), 2.0) * 0.6);
          vec3 R = reflect(-V, N); vec3 sky = mix(uSkyHor, uSkyTop, clamp(R.y, 0., 1.));
          float fr = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 col = mix(water, sky, fr);
          col += uSunCol * pow(max(dot(R, normalize(uSun)), 0.0), 280.0) * 4.0 * (1.0 - uNight);
          // shore foam
          float fz = smoothstep(0.62, 0.42, abs(shore - 0.47) + 0.0) ;
          float foam = fz * smoothstep(0.45, 0.85, vn(vW.xz * 0.7 + vec2(uTime * 0.3, 0.)) + 0.4 * sin(depth * 4.0 - uTime * 2.0));
          col = mix(col, vec3(0.95), clamp(foam, 0.0, 1.0) * 0.85);
          float a = mix(0.45, 0.93, smoothstep(0.0, 14.0, depth)) + fr * 0.4 + foam * 0.5;
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
        } else {
          // seen from below: Snell's window, total internal reflection outside it
          vec3 Nd = -N; float c = dot(V, Nd); float up = clamp(-V.y, 0.0, 1.0);
          float win = smoothstep(0.62, 0.72, up);
          vec3 sky = mix(uSkyHor, uSkyTop, up) * 1.15 + uSunCol * pow(max(dot(-V, normalize(uSun)), 0.0), 60.0) * 2.0;
          vec3 tir = uDeep * 0.9 + vec3(0.02, 0.08, 0.1);
          vec3 col = mix(tir, sky, win);
          col += vec3(0.6, 0.9, 1.0) * smoothstep(0.6, 1.0, vn(vW.xz * 1.5 + uTime)) * win * 0.25;
          gl_FragColor = vec4(col, 0.94);
        }
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 280, 280).rotateX(-Math.PI / 2), mat);
  surf.frustumCulled = false; surf.renderOrder = 5; S.add(surf);

  // ---------- underwater extras ----------
  // god rays: tall soft blades hanging from the surface around the camera
  const rayTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); const g2 = g.createLinearGradient(0, 0, 64, 0); g.globalCompositeOperation = 'destination-in'; g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.5, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = g2; g.fillRect(0, 0, 64, 256); return new THREE.CanvasTexture(c); })();
  const rayMat = new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x9fe8ff, opacity: 0.12, fog: false, side: THREE.DoubleSide });
  const rays = [];
  for (let i = 0; i < 22; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), rayMat.clone()); m.userData = { ox: (Math.random() - 0.5) * 50, oz: (Math.random() - 0.5) * 50, w: 1 + Math.random() * 3, l: 18 + Math.random() * 22, ph: Math.random() * 6 }; m.renderOrder = 6; S.add(m); rays.push(m); }

  // marine snow
  const SN = 1800, sp = new Float32Array(SN * 3); for (let i = 0; i < SN * 3; i++) sp[i] = (Math.random() - 0.5) * 40;
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snowMat = new THREE.PointsMaterial({ color: 0xcfe8e8, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false });
  const snow = new THREE.Points(sg, snowMat); snow.frustumCulled = false; S.add(snow);

  // bubbles
  const BN = 300, bp = new Float32Array(BN * 3), bl = new Float32Array(BN), bv = [];
  for (let i = 0; i < BN; i++) { bp[i * 3 + 1] = -9999; bv.push({ life: 0, x: 0, y: -9999, z: 0, s: 1 }); }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
  const bubTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.5; g.beginPath(); g.arc(16, 16, 12, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,.25)'; g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(11, 11, 3, 0, 7); g.fill(); return new THREE.CanvasTexture(c); })();
  const bubbles = new THREE.Points(bg, new THREE.PointsMaterial({ map: bubTex, size: 0.09, transparent: true, depthWrite: false, opacity: 0.8 })); bubbles.frustumCulled = false; S.add(bubbles);
  let bh = 0;
  const W = { surf, mat, U, under: false, depth: 0 };
  W.bubble = (x, y, z, n = 1, spread = 0.1) => { for (let k = 0; k < n; k++) { const b = bv[bh]; bh = (bh + 1) % BN; b.x = x + (Math.random() - 0.5) * spread; b.y = y + (Math.random() - 0.5) * spread; b.z = z + (Math.random() - 0.5) * spread; b.life = 0; b.ph = Math.random() * 6; b.v = 0.8 + Math.random() * 0.8; } };

  const fogShallow = new THREE.Color('#1d7f92'), fogDeep = new THREE.Color('#031421'), fogNight = new THREE.Color('#020a12'), tmpC = new THREE.Color();
  const airFog = new THREE.FogExp2(0xbcd8e6, 0.0016), seaFog = new THREE.FogExp2(0x1d7f92, 0.03);
  W.update = (dt) => {
    const cam = G.camera.position, t = G.t;
    surf.position.set(Math.round(cam.x / 5) * 5, 0, Math.round(cam.z / 5) * 5);
    const under = cam.y < waveHeight(cam.x, cam.z, t) - 0.05; W.under = under; W.depth = Math.max(0, -cam.y);
    const night = U.uNight.value;
    if (under) {
      const d = W.depth;
      tmpC.copy(fogShallow).lerp(fogDeep, clamp(d / 70, 0, 1)).lerp(fogNight, night * 0.85);
      seaFog.color.copy(tmpC); seaFog.density = lerp(0.028, 0.04, clamp(d / 80, 0, 1)) * (G.lampOn ? 0.7 : 1);
      G.scene.fog = seaFog; G.scene.background = tmpC;
      WU.uCausK.value = (1 - night) * clamp(1 - d / 45, 0, 1);
    } else {
      G.scene.fog = airFog; airFog.color.copy(U.uSkyHor.value); G.scene.background = null; WU.uCausK.value = 1 - night;
    }
    // god rays
    const rayK = under ? clamp(1 - W.depth / 40, 0, 1) * (1 - night) : 0;
    for (const m of rays) {
      const u = m.userData; m.visible = rayK > 0.01;
      if (!m.visible) continue;
      let x = cam.x + u.ox + Math.sin(t * 0.1 + u.ph) * 2, z = cam.z + u.oz + Math.cos(t * 0.13 + u.ph) * 2;
      if (Math.abs(x - cam.x) > 25) u.ox = -Math.sign(x - cam.x) * 24; if (Math.abs(z - cam.z) > 25) u.oz = -Math.sign(z - cam.z) * 24;
      m.scale.set(u.w, u.l, 1); m.position.set(x, -u.l / 2 + 0.2, z);
      m.lookAt(cam.x, m.position.y, cam.z); m.rotateZ(-0.25);
      m.material.opacity = 0.11 * rayK * (0.6 + 0.4 * Math.sin(t * 0.7 + u.ph));
    }
    // snow wraps around the camera
    snow.visible = under; if (under) { const a = sg.attributes.position.array; for (let i = 0; i < SN; i++) { for (let k = 0; k < 3; k++) { let v = a[i * 3 + k]; const c = k === 0 ? cam.x : k === 1 ? cam.y : cam.z; if (v - c > 20) v -= 40; else if (v - c < -20) v += 40; a[i * 3 + k] = v; } a[i * 3 + 1] -= dt * 0.05; } sg.attributes.position.needsUpdate = true; snowMat.color.setRGB(0.8 - night * 0.6, 0.9 - night * 0.6, 0.9 - night * 0.5); }
    // bubbles rise, wobble, pop at the surface
    for (let i = 0; i < BN; i++) { const b = bv[i]; if (b.y < -9000) continue; b.life += dt; b.y += b.v * dt * (1 + b.life * 0.4); b.x += Math.sin(t * 7 + b.ph) * 0.004; b.z += Math.cos(t * 6 + b.ph) * 0.004; if (b.y > -0.05 || b.life > 12) b.y = -9999; bp[i * 3] = b.x; bp[i * 3 + 1] = b.y; bp[i * 3 + 2] = b.z; }
    bg.attributes.position.needsUpdate = true;
  };
  G.water = W;
  return W;
}
// CPU copy of the big waves for "am I under the surface"
export function waveHeight(x, z, t) {
  const w = (dx, dz, a, k, s) => { const l = Math.hypot(dx, dz); return a * Math.sin(k * ((dx / l) * x + (dz / l) * z - s * t)); };
  return w(1, 0.3, 0.22, 0.16, 1.3) + w(-0.4, 1, 0.13, 0.31, 1.7) + w(0.7, -0.8, 0.07, 0.62, 2.3) + w(-0.9, -0.2, 0.04, 1.1, 3.1);
}
