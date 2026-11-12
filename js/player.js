// First-person explorer: walks on land, swims/dives in 3D, oxygen, health, food, water, lamp.
import * as THREE from 'three';
import { G, clamp, lerp, damp, WATER } from './ctx.js';
import { height } from './terrain.js';
import { waveHeight } from './water.js';
import { input } from './input.js';

const EYE = 1.62, R = 0.38;
export function createPlayer() {
  const P = {
    pos: new THREE.Vector3(-18, 5, 30), vel: new THREE.Vector3(), yaw: 0, pitch: 0,
    swim: false, headUnder: false, grounded: false, bob: 0, roll: 0,
    o2: 45, o2Max: 45, hp: 100, food: 85, water: 80, alive: true,
    speedMul: 1, swimMul: 1, scooter: false, lampOn: false, hasLamp: false, depthMax: 30,
    events: [],
  };
  G.player = P;
  const cam = G.camera;
  const lamp = new THREE.SpotLight(0xfff2dc, 0, 32, 0.5, 0.55, 1.3); lamp.castShadow = false;
  cam.add(lamp); lamp.position.set(0.15, -0.1, 0); lamp.target.position.set(0, 0, -5); cam.add(lamp.target); G.scene.add(cam);
  P.lamp = lamp;

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3();
  const pushOut = () => {
    const C = G.colliders; if (!C) return;
    const cy = P.pos.y + 0.9;
    for (const s of C.near(P.pos.x, P.pos.z)) {
      if (s.type === 's') {
        const dx = P.pos.x - s.x, dy = cy - s.y, dz = P.pos.z - s.z, d = Math.hypot(dx, dy * 0.6, dz), m = s.r + R;
        if (d < m && d > 1e-4) { const k = (m - d) / d; P.pos.x += dx * k; P.pos.z += dz * k; if (!P.swim && dy > s.r * 0.4) { /* standing on a rock */ } else P.pos.y += dy * k * 0.6; }
      } else {                                                       // yaw box
        const dx = P.pos.x - s.x, dz = P.pos.z - s.z, lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c;
        if (cy < s.y - s.hy - 0.9 || P.pos.y > s.y + s.hy) continue;
        const qx = clamp(lx, -s.hx, s.hx), qz = clamp(lz, -s.hz, s.hz); let ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
        if (d < R) {
          if (d < 1e-4) { const px = s.hx - Math.abs(lx), pz = s.hz - Math.abs(lz); if (px < pz) { ex = Math.sign(lx); ez = 0; d = 0; } else { ex = 0; ez = Math.sign(lz); d = 0; } const k = (px < pz ? px : pz) + R; const wx = ex * s.c + ez * s.s, wz = -ex * s.s + ez * s.c; P.pos.x += wx * k; P.pos.z += wz * k; }
          else { const k = (R - d) / d; const wx = (ex * s.c + ez * s.s) * k, wz = (-ex * s.s + ez * s.c) * k; P.pos.x += wx; P.pos.z += wz; }
        }
      }
    }
  };
  // highest walkable surface under the player (terrain, rock tops, box tops)
  function floorAt(x, z, y) {
    let f = height(x, z); const C = G.colliders; if (!C) return f;
    for (const s of C.near(x, z)) {
      if (s.type === 's') { const dx = x - s.x, dz = z - s.z, d2 = dx * dx + dz * dz; if (d2 < s.r * s.r) { const top = s.y + Math.sqrt(s.r * s.r - d2) * 0.9; if (top <= y + 0.6 && top > f) f = top; } }
      else { const dx = x - s.x, dz = z - s.z, lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c; if (Math.abs(lx) < s.hx && Math.abs(lz) < s.hz) { const top = s.y + s.hy; if (top <= y + 0.6 && top > f) f = top; } }
    }
    return f;
  }
  P.floorAt = floorAt;

  P.update = (dt) => {
    if (!P.alive) return;
    const s = G.settings;
    if (!G.uiOpen) { P.yaw -= input.mx * 0.0022 * s.sens; P.pitch -= input.my * 0.0022 * s.sens; P.pitch = clamp(P.pitch, -1.5, 1.5); }
    const wl = waveHeight(P.pos.x, P.pos.z, G.t);
    const bodyY = P.pos.y + 0.9;
    P.swim = bodyY < wl + 0.1;
    fwd.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); right.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
    const mvF = G.uiOpen ? 0 : input.f, mvS = G.uiOpen ? 0 : input.s;
    if (!P.swim) {
      // ---- walking ----
      const sp = 4.4 * (input.sprint ? 1.55 : 1) * P.speedMul;
      wish.copy(fwd).multiplyScalar(mvF).addScaledVector(right, mvS); if (wish.lengthSq() > 1) wish.normalize(); wish.multiplyScalar(sp);
      const acc = P.grounded ? 14 : 3;
      P.vel.x = damp(P.vel.x, wish.x, acc, dt); P.vel.z = damp(P.vel.z, wish.z, acc, dt);
      P.vel.y -= 22 * dt;
      if (P.grounded && input.jumpPressed && !G.uiOpen) { P.vel.y = 7.2; P.grounded = false; P.events.push('jump'); }
      P.pos.addScaledVector(P.vel, dt); pushOut();
      const f = floorAt(P.pos.x, P.pos.z, P.pos.y);
      if (P.pos.y <= f + 0.02 && P.vel.y <= 0) { if (!P.grounded && P.vel.y < -6) P.events.push('land'); P.pos.y = f; P.vel.y = 0; P.grounded = true; }
      else if (P.grounded && P.pos.y - f < 0.35 && P.vel.y <= 0) { P.pos.y = f; P.vel.y = 0; }
      else P.grounded = false;
      const hs = Math.hypot(P.vel.x, P.vel.z); if (P.grounded && hs > 0.5) { const pb = P.bob; P.bob += hs * dt * 1.9; if (Math.floor(pb / Math.PI) !== Math.floor(P.bob / Math.PI)) P.events.push('step'); }
    } else {
      // ---- swimming: move where you look ----
      const cp = Math.cos(P.pitch), lookF = new THREE.Vector3(-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp);
      let sp = 3.3 * P.swimMul * (input.sprint ? 1.45 : 1); if (P.scooter && input.f > 0 && input.sprint) sp = 9.5;
      wish.copy(lookF).multiplyScalar(mvF).addScaledVector(right, mvS);
      if (!G.uiOpen) { if (input.jump) wish.y += 1; if (input.down) wish.y -= 1; }
      if (wish.lengthSq() > 1) wish.normalize(); wish.multiplyScalar(sp);
      const atSurface = P.pos.y + EYE > wl - 0.25;
      if (atSurface && wish.y > 0) wish.y = 0;                     // can't fly out of the water
      P.vel.lerp(wish, 1 - Math.exp(-(P.scooter && input.sprint ? 2.5 : 3.2) * dt));
      if (wish.lengthSq() < 0.01) P.vel.y += (P.pos.y + EYE < wl - 0.6 ? 0.35 : 0) * dt;   // gentle buoyancy
      if (atSurface && wish.lengthSq() < 0.01) P.pos.y = damp(P.pos.y, wl - EYE + 0.25, 3, dt);   // float with the head out
      P.pos.addScaledVector(P.vel, dt); pushOut();
      const f = floorAt(P.pos.x, P.pos.z, P.pos.y);
      if (P.pos.y < f + 0.15) { P.pos.y = f + 0.15; if (P.vel.y < 0) P.vel.y = 0; }
      if (P.pos.y + EYE > wl + 0.3) P.pos.y = wl + 0.3 - EYE;
      P.grounded = false;
      const hs = P.vel.length(); P.bob += hs * dt * 0.9;
      // exhale bubbles
      P.bubT = (P.bubT || 0) - dt;
      if (P.headUnder && P.bubT <= 0) { P.bubT = 2.6 + Math.random() * 1.5; P.events.push('exhale'); const e = cam.position; G.water.bubble(e.x, e.y - 0.05, e.z, 9, 0.15); }
      if (P.headUnder && hs > 3 && Math.random() < dt * 4) G.water.bubble(cam.position.x, cam.position.y - 0.3, cam.position.z, 1, 0.4);
    }
    // world edge
    const rr = Math.hypot(P.pos.x, P.pos.z); if (rr > 430) { P.pos.x *= 430 / rr; P.pos.z *= 430 / rr; }

    // ---- camera ----
    const eyeY = P.pos.y + EYE + (P.swim ? Math.sin(P.bob * 1.3) * 0.04 : (P.grounded ? Math.abs(Math.sin(P.bob)) * 0.055 - 0.03 : 0));
    cam.position.set(P.pos.x, eyeY, P.pos.z);
    P.roll = damp(P.roll, P.swim ? -mvS * 0.06 + Math.sin(G.t * 0.7) * 0.012 : -mvS * 0.012, 4, dt);
    cam.rotation.set(P.pitch, P.yaw, P.roll, 'YXZ');
    const wasUnder = P.headUnder; P.headUnder = eyeY < wl - 0.02;
    if (wasUnder !== P.headUnder) P.events.push(P.headUnder ? 'dive' : 'surface');

    // ---- vitals ----
    const tank = G.inv ? G.inv.o2Bonus() : 0; P.o2Max = 45 + tank;
    if (P.headUnder) { P.o2 -= dt * (input.sprint ? 1.4 : 1); if (P.o2 <= 0) { P.o2 = 0; P.hp -= dt * 9; P.drowning = true; } }
    else { P.o2 = Math.min(P.o2Max, P.o2 + dt * 18); P.drowning = false; }
    P.food = Math.max(0, P.food - dt * 0.032); P.water = Math.max(0, P.water - dt * 0.045);
    if (P.food <= 0 || P.water <= 0) P.hp -= dt * 0.6; else if (P.hp < 100 && P.food > 40 && P.water > 40) P.hp = Math.min(100, P.hp + dt * 0.25);
    // pressure: going deeper than the suit allows hurts
    const depth = Math.max(0, -eyeY); P.depth = depth;
    if (depth > P.depthMax) { P.hp -= dt * (depth - P.depthMax) * 0.4; P.crush = true; } else P.crush = false;
    if (P.hp <= 0) { P.hp = 0; P.alive = false; G.onDeath && G.onDeath(); }
    lamp.intensity = P.lampOn && P.hasLamp ? (P.headUnder ? 40 : 18) : 0; G.lampOn = P.lampOn && P.hasLamp;
  };
  P.lookDir = (out) => out.set(0, 0, -1).applyQuaternion(cam.quaternion);
  return P;
}
