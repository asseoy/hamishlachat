// Synthesized sound: surf + wind above water, muffled deep hum below, bubbles, pickups, gentle music.
import { G, clamp, save } from './ctx.js';
export function createAudio() {
  const A = { ok: false }; let ctx, master, sfx, mus, amb, noise, surfG, deepG, lp, musLp, nextNote = 0, step = 0;
  A.start = () => {
    if (ctx) { ctx.resume(); return; } try { ctx = new AudioContext(); } catch (e) { return; }
    master = ctx.createGain(); master.connect(ctx.destination);
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.connect(master);   // everything goes muffled underwater
    sfx = ctx.createGain(); sfx.connect(lp); mus = ctx.createGain(); musLp = ctx.createBiquadFilter(); musLp.type = 'lowpass'; musLp.frequency.value = 3000; mus.connect(musLp); musLp.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate); const d = noise.getChannelData(0); let b = 0; for (let i = 0; i < d.length; i++) { b = 0.98 * b + 0.02 * (Math.random() * 2 - 1); d[i] = b * 4 + (Math.random() * 2 - 1) * 0.15; }
    const loop = (rate, f, q, type) => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.playbackRate.value = rate; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(sfx); s.start(); return g; };
    surfG = loop(1, 700, 0.5, 'lowpass'); deepG = loop(0.5, 160, 1.2, 'lowpass');
    A.ok = true; A.vol();
  };
  A.vol = () => { if (!ctx) return; sfx.gain.value = save.settings.sfx; mus.gain.value = save.settings.music * 0.5; };
  const env = (node, t, a, peak, dur) => { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); node.connect(g); g.connect(sfx); return g; };
  const tone = (f0, f1, dur, vol, type = 'sine', delay = 0) => { const t = ctx.currentTime + delay, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); env(o, t, 0.01, vol, dur); o.start(t); o.stop(t + dur + 0.05); };
  const hiss = (dur, f, vol, delay = 0) => { const t = ctx.currentTime + delay, s = ctx.createBufferSource(); s.buffer = noise; const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; s.connect(fl); env(fl, t, 0.01, vol, dur); s.start(t, Math.random()); s.stop(t + dur + 0.05); };
  A.play = (n) => {
    if (!A.ok) return;
    switch (n) {
      case 'pick': tone(520, 780, 0.12, 0.15, 'triangle'); break;
      case 'craft': [0, 4, 7].forEach((s, i) => tone(392 * 2 ** (s / 12), 392 * 2 ** (s / 12), 0.25, 0.12, 'triangle', i * 0.07)); hiss(0.3, 2000, 0.1); break;
      case 'eat': hiss(0.15, 900, 0.2); hiss(0.15, 700, 0.2, 0.18); break;
      case 'quest': [0, 5, 9, 12].forEach((s, i) => tone(330 * 2 ** (s / 12), 330 * 2 ** (s / 12), 0.6, 0.12, 'triangle', i * 0.12)); break;
      case 'open': tone(200, 120, 0.2, 0.2, 'square'); hiss(0.3, 600, 0.2); break;
      case 'page': hiss(0.25, 3000, 0.15); break;
      case 'click': tone(1200, 900, 0.04, 0.08, 'square'); break;
      case 'splash': hiss(0.4, 1500, 0.3); break;
      case 'dive': hiss(0.6, 800, 0.4); tone(300, 80, 0.5, 0.15); break;
      case 'surface': hiss(0.5, 1800, 0.35); hiss(0.2, 400, 0.3, 0.05); break;
      case 'exhale': for (let i = 0; i < 6; i++) tone(300 + Math.random() * 500, 600 + Math.random() * 600, 0.06, 0.06, 'sine', i * 0.05 + Math.random() * 0.03); break;
      case 'step': hiss(0.08, 1200, 0.15); break;
      case 'jump': hiss(0.15, 900, 0.12); break;
      case 'land': hiss(0.15, 500, 0.25); break;
      case 'warn': tone(880, 880, 0.12, 0.12, 'square'); tone(660, 660, 0.12, 0.12, 'square', 0.15); break;
    }
  };
  const N = n => 440 * 2 ** ((n - 69) / 12);
  const prog = [[57, 64, 69, 72], [53, 60, 65, 69], [48, 55, 60, 64], [55, 62, 67, 71]];   // Am F C G – soft arpeggios
  A.update = (dt) => {
    if (!A.ok) return; const t = ctx.currentTime, P = G.player, under = G.water && G.water.under, depth = G.water ? G.water.depth : 0;
    lp.frequency.setTargetAtTime(under ? 650 - Math.min(400, depth * 6) : 20000, t, 0.08);
    surfG.gain.setTargetAtTime(under ? 0.05 : 0.35 * clamp(1 - Math.hypot(P.pos.x, P.pos.z) / 260, 0.25, 1), t, 0.3);
    deepG.gain.setTargetAtTime(under ? 0.25 + Math.min(0.4, depth / 120) : 0, t, 0.4);
    if (P.o2 < 10 && P.headUnder) { A.warnT = (A.warnT || 0) - dt; if (A.warnT <= 0) { A.warnT = 1.2; A.play('warn'); } }
    if (!G.running || G.paused) return;
    musLp.frequency.setTargetAtTime(under ? 900 : 3500, t, 0.3);
    while (nextNote < t + 0.3) {
      if (nextNote < t) nextNote = t + 0.05;
      const ch = prog[Math.floor(step / 8) % 4], k = step % 8, n = ch[[0, 2, 1, 3, 2, 1, 3, 2][k]] + (under ? -12 : 0);
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = N(n);
      g.gain.setValueAtTime(0.0001, nextNote); g.gain.exponentialRampToValueAtTime(k === 0 ? 0.09 : 0.05, nextNote + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, nextNote + 1.6);
      o.connect(g); g.connect(mus); o.start(nextNote); o.stop(nextNote + 1.7);
      nextNote += 0.42; step++;
    }
  };
  G.sfx = A.play;
  return A;
}
