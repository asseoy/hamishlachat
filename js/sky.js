// Day/night cycle: sky dome with sun, moon and stars; sun light with shadows following the player.
import * as THREE from 'three';
import { G, clamp, lerp, smooth } from './ctx.js';
import { WU } from './terrain.js';

export const DAY_LEN = 20 * 60;           // seconds per full day
export function createSky() {
  const S = G.scene;
  const uni = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3() }, uSunC: { value: new THREE.Color() }, uNight: { value: 0 } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: uni,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 uTop,uHor,uSunC,uSun; uniform float uNight; varying vec3 vD;
      float h3(vec3 p){ p=fract(p*0.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){ vec3 d=normalize(vD); float h=d.y; vec3 col = mix(uHor, uTop, pow(max(h,0.),0.5));
        if (h < 0.) col = mix(uHor, uHor*0.6, clamp(-h*4.,0.,1.));
        float s = max(dot(d, normalize(uSun)), 0.); col += uSunC*(pow(s,1200.)*8. + pow(s,40.)*0.3 + pow(s,5.)*0.12);
        float m = max(dot(d, -normalize(uSun)), 0.); col += vec3(0.85,0.9,1.)*pow(m,2500.)*3.*uNight + vec3(0.2,0.25,0.35)*pow(m,30.)*0.2*uNight;
        if (uNight > 0.02 && h > 0.) { vec3 g = floor(d*500.); float n = h3(g); if (n > 0.9972) col += vec3(0.9,0.92,1.)*uNight*(0.5+0.5*sin(n*1000.)); }
        gl_FragColor = vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  dome.frustumCulled = false; dome.renderOrder = -10; S.add(dome);
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x8a7a5a, 0.9); S.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 300 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.mapSize.set(2048, 2048);
  S.add(sun); S.add(sun.target);

  const K = { time: 0.32, dome, sun, hemi };   // 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
  const C = (h) => new THREE.Color(h);
  const keys = [   // time, sky top, horizon, sun colour, sun intensity, hemi intensity
    [0.0, C('#050914'), C('#0b1426'), C('#7f8fb8'), 0.25, 0.25],
    [0.22, C('#0f1a35'), C('#3a3550'), C('#ff8a5a'), 0.3, 0.3],
    [0.27, C('#3c5f96'), C('#f0a77a'), C('#ffb27a'), 1.6, 0.6],
    [0.35, C('#3f7cc4'), C('#bcd9e8'), C('#fff1dc'), 3.0, 0.95],
    [0.5, C('#3a78c4'), C('#c4dfea'), C('#ffffff'), 3.4, 1.0],
    [0.65, C('#3f7cc4'), C('#bcd9e8'), C('#fff1dc'), 3.0, 0.95],
    [0.73, C('#3d5a90'), C('#f29a68'), C('#ff9a5c'), 1.6, 0.6],
    [0.78, C('#121c38'), C('#3d3450'), C('#ff7a4a'), 0.35, 0.3],
    [1.0, C('#050914'), C('#0b1426'), C('#7f8fb8'), 0.25, 0.25],
  ];
  const top = new THREE.Color(), hor = new THREE.Color(), sc = new THREE.Color(), dir = new THREE.Vector3();
  K.update = (dt) => {
    K.time = (K.time + dt / DAY_LEN) % 1;
    let i = 0; while (i < keys.length - 2 && keys[i + 1][0] <= K.time) i++;
    const a = keys[i], b = keys[i + 1], k = smooth(a[0], b[0], K.time);
    top.copy(a[1]).lerp(b[1], k); hor.copy(a[2]).lerp(b[2], k); sc.copy(a[3]).lerp(b[3], k);
    const si = lerp(a[4], b[4], k), hi = lerp(a[5], b[5], k);
    const ang = (K.time - 0.25) * Math.PI * 2;                     // sun goes round
    dir.set(Math.cos(ang) * 0.85, Math.sin(ang), 0.35).normalize();
    const night = clamp(1 - (dir.y + 0.12) / 0.25, 0, 1);
    uni.uTop.value.copy(top); uni.uHor.value.copy(hor); uni.uSun.value.copy(dir); uni.uSunC.value.copy(sc); uni.uNight.value = night;
    // the light comes from the sun by day and from the moon by night
    const ld = night > 0.5 ? dir.clone().negate() : dir;
    const under = G.water && G.water.under, depth = G.water ? G.water.depth : 0;
    const uw = under ? Math.exp(-depth * 0.045) : 1;
    sun.color.copy(night > 0.5 ? C('#9fb2e0') : sc); sun.intensity = (night > 0.5 ? 0.45 : si) * uw;
    hemi.intensity = hi * (under ? lerp(0.85, 0.25, clamp(depth / 60, 0, 1)) : 1); hemi.color.copy(hor).lerp(C('#ffffff'), 0.4); if (under) hemi.color.lerp(C('#5ec8d8'), 0.6);
    const p = G.player ? G.player.pos : new THREE.Vector3();
    const tx = Math.round(p.x * 2) / 2, ty = Math.round(p.y * 2) / 2, tz = Math.round(p.z * 2) / 2;
    sun.target.position.set(tx, ty, tz); sun.position.set(tx + ld.x * 120, ty + Math.max(0.15, ld.y) * 120, tz + ld.z * 120);
    dome.position.copy(G.camera.position); dome.visible = !under;
    if (G.water) { const U = G.water.U; U.uSun.value.copy(dir); U.uSunCol.value.copy(sc); U.uSkyTop.value.copy(top); U.uSkyHor.value.copy(hor); U.uNight.value = night; }
    WU.uSunCol.value.copy(sc).multiplyScalar(night > 0.5 ? 0.2 : 1);
    G.renderer.toneMappingExposure = lerp(1.0, 1.25, night);
    K.night = night; K.dir = dir;
  };
  K.applyQuality = q => { const s = q >= 2 ? 2048 : q === 1 ? 1536 : 1024; if (sun.shadow.mapSize.x !== s) { sun.shadow.mapSize.set(s, s); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } };
  G.sky = K;
  return K;
}
