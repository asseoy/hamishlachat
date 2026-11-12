// Backpack, equipment, crafting, eating; interaction with the world (pick up, loot, clams, logs, fish);
// story objectives.
import * as THREE from 'three';
import { G, clamp, save, writeSave } from './ctx.js';
import { ITEMS, RECIPES } from './items.js';
import { LOGS } from './world.js';
import { input } from './input.js';

const $ = id => document.getElementById(id);
export function createInventory(state) {
  const inv = { bag: state.bag || {}, eq: state.eq || {}, done: state.done, logs: state.logs || [] };
  G.inv = inv;
  const count = id => inv.bag[id] || 0;
  inv.add = (id, n = 1, quiet) => { inv.bag[id] = count(id) + n; if (!quiet) pickupToast(id, n); autoEquip(id); G.story && G.story.check(); refresh(); };
  inv.take = (id, n = 1) => { inv.bag[id] = count(id) - n; if (inv.bag[id] <= 0) delete inv.bag[id]; refresh(); };
  inv.count = count;
  inv.o2Bonus = () => (inv.eq.tank ? ITEMS[inv.eq.tank].o2 : 0);
  function applyGear() {
    const P = G.player; if (!P) return;
    P.swimMul = inv.eq.fins ? 1.45 : 1; P.scooter = !!inv.eq.scooter; P.hasLamp = !!inv.eq.lamp;
    P.depthMax = inv.eq.suit ? ITEMS[inv.eq.suit].depth : 32; G.maskOn = !!inv.eq.mask;
  }
  inv.applyGear = applyGear;
  function autoEquip(id) {
    const it = ITEMS[id]; if (!it.slot) return;
    const cur = inv.eq[it.slot];
    const better = !cur || (it.slot === 'tank' && ITEMS[id].o2 > ITEMS[cur].o2) || (it.slot === 'suit' && ITEMS[id].depth > ITEMS[cur].depth);
    if (better) { inv.eq[it.slot] = id; applyGear(); G.toast && G.toast('ציוד חדש', it.n); }
  }

  // ---------- UI ----------
  let tab = 'הכל', open = false, craftOpen = false, craftTab = 'חומרים';
  function pickupToast(id, n) { const d = document.createElement('div'); d.className = 'pick'; d.innerHTML = `<img src="${G.icons[id]}"><span>${ITEMS[id].n}${n > 1 ? ' ×' + n : ''}</span>`; $('picks').prepend(d); setTimeout(() => d.classList.add('out'), 2200); setTimeout(() => d.remove(), 2700); while ($('picks').children.length > 5) $('picks').lastChild.remove(); }
  function cell(id, n, extra = '') { return `<div class="cell ${extra}" data-id="${id}" title="${ITEMS[id].n}"><img src="${G.icons[id]}"><b>${n > 1 ? n : ''}</b></div>`; }
  function refresh() {
    if (!open) return;
    const ids = Object.keys(inv.bag).filter(id => tab === 'הכל' || catName(ITEMS[id].cat) === tab);
    $('bagGrid').innerHTML = ids.map(id => cell(id, inv.bag[id], Object.values(inv.eq).includes(id) ? 'eq' : '')).join('') || '<p class="dim">התיק ריק. אוספים דברים עם E.</p>';
    $('eqRow').innerHTML = ['mask', 'suit', 'fins', 'tank', 'lamp', 'gloves', 'scooter'].map(s => { const id = inv.eq[s]; return `<div class="slot">${id ? `<img src="${G.icons[id]}">` : ''}<span>${SLOT[s]}</span></div>`; }).join('');
    document.querySelectorAll('#bagGrid .cell').forEach(c => { c.onmouseenter = () => info(c.dataset.id); c.onclick = () => use(c.dataset.id); });
    const lg = $('logList'); lg.innerHTML = inv.logs.length ? inv.logs.sort((a, b) => a - b).map(i => `<button class="logBtn" data-i="${i}">${LOGS[i].t}</button>`).join('') : '<p class="dim">עוד לא מצאת דפי יומן.</p>';
    lg.querySelectorAll('.logBtn').forEach(b => b.onclick = () => showLog(+b.dataset.i));
  }
  const SLOT = { mask: 'מסכה', suit: 'חליפה', fins: 'סנפירים', tank: 'מיכל', lamp: 'פנס', gloves: 'כפפות', scooter: 'סקוטר' };
  const catName = c => ({ raw: 'חומרי גלם', material: 'חומרים', food: 'אוכל', tool: 'כלים', gear: 'ציוד', quest: 'משימה', build: 'כלים' })[c];
  function info(id) { const it = ITEMS[id]; let extra = ''; if (it.food || it.water || it.hp) extra = '<br><span class="y">לחיצה – לאכול/לשתות</span>'; $('itemInfo').innerHTML = `<img src="${G.icons[id]}"><div><b>${it.n}</b><br>${it.d || ''}${extra}</div>`; }
  function use(id) {
    const it = ITEMS[id], P = G.player;
    if (it.food || it.water || it.hp) { P.food = clamp(P.food + (it.food || 0), 0, 100); P.water = clamp(P.water + (it.water || 0), 0, 100); P.hp = clamp(P.hp + (it.hp || 0), 0, 100); if (id === 'coconut') { inv.take(id); } else inv.take(id); G.sfx && G.sfx('eat'); refresh(); }
    else if (id === 'bottleMsg') showNote('פתק בבקבוק', 'אם מצאת את הבקבוק הזה – המחנה שלנו נמצא בצד הצפוני של האי, ליד הדקלים. בשולחן העבודה אפשר לבנות ציוד. בהצלחה! – המשלחת');
  }
  function showLog(i) { showNote(LOGS[i].t, LOGS[i].b); }
  function showNote(t, b) { $('noteTitle').textContent = t; $('noteBody').textContent = b; $('note').classList.remove('hidden'); G.uiOpen = true; document.exitPointerLock && document.exitPointerLock(); }
  $('noteClose').onclick = () => { $('note').classList.add('hidden'); if (!open && !craftOpen) closeUI(); };
  inv.showNote = showNote;
  document.querySelectorAll('#bagTabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; document.querySelectorAll('#bagTabs button').forEach(x => x.classList.toggle('on', x === b)); refresh(); });
  inv.toggle = (v = !open) => { open = v; $('bag').classList.toggle('hidden', !open); if (open) { craftOpen && inv.craft(false); G.uiOpen = true; document.exitPointerLock && document.exitPointerLock(); refresh(); } else closeUI(); };
  function closeUI() { G.uiOpen = false; $('note').classList.add('hidden'); if (G.running && !G.paused) G.canvas.requestPointerLock && G.canvas.requestPointerLock(); }

  // ---------- crafting ----------
  const canMake = r => Object.entries(r.in).every(([id, n]) => count(id) >= n);
  function craftRefresh() {
    if (!craftOpen) return;
    const tabs = [...new Set(RECIPES.map(r => r.tab))];
    $('craftTabs').innerHTML = tabs.map(t => `<button class="${t === craftTab ? 'on' : ''}">${t}</button>`).join('');
    $('craftTabs').querySelectorAll('button').forEach(b => b.onclick = () => { craftTab = b.textContent; craftRefresh(); });
    $('craftList').innerHTML = RECIPES.map((r, i) => r.tab !== craftTab ? '' : `<div class="rec ${canMake(r) ? 'ok' : ''}" data-i="${i}">
      <img src="${G.icons[r.out]}"><div class="rn"><b>${ITEMS[r.out].n}${r.n > 1 ? ' ×' + r.n : ''}</b><small>${ITEMS[r.out].d || ''}</small></div>
      <div class="ing">${Object.entries(r.in).map(([id, n]) => `<span class="${count(id) >= n ? 'have' : ''}"><img src="${G.icons[id]}">${count(id)}/${n}</span>`).join('')}</div>
      <button class="mk" ${canMake(r) ? '' : 'disabled'}>בנה</button></div>`).join('');
    $('craftList').querySelectorAll('.rec').forEach(el => { el.querySelector('.mk').onclick = () => make(RECIPES[+el.dataset.i]); });
  }
  function make(r) {
    if (!canMake(r)) return;
    for (const [id, n] of Object.entries(r.in)) inv.take(id, n);
    inv.add(r.out, r.n || 1); G.sfx && G.sfx('craft'); craftRefresh();
    if (r.out === 'radio') G.story && G.story.flag('radioBuilt');
  }
  inv.craft = (v, t) => { craftOpen = v; if (t) craftTab = t; $('craft').classList.toggle('hidden', !v); if (v) { open && inv.toggle(false); G.uiOpen = true; document.exitPointerLock && document.exitPointerLock(); craftRefresh(); } else closeUI(); };
  $('craftClose').onclick = () => inv.craft(false); $('bagClose').onclick = () => inv.toggle(false);

  // ---------- interaction ----------
  const look = new THREE.Vector3(), tmp = new THREE.Vector3();
  let target = null;
  inv.update = (dt) => {
    const P = G.player, cam = G.camera.position; P.lookDir(look);
    if (input.invPressed) inv.toggle();
    if (input.escPressed && (open || craftOpen || !$('note').classList.contains('hidden'))) { input.escPressed = false; inv.toggle(false); inv.craft(false); closeUI(); }
    if (input.lampPressed && P.hasLamp) { P.lampOn = !P.lampOn; G.sfx && G.sfx('click'); }
    if (G.uiOpen) { $('prompt').classList.add('hidden'); return; }
    // what am I looking at?
    target = null; let best = 1e9;
    const consider = (o, pos, r, label) => { tmp.copy(pos).sub(cam); const d = tmp.length(); if (d > r + 0.6) return; const dot = tmp.normalize().dot(look); const score = d * (1.6 - dot); if (dot > 0.82 && score < best) { best = score; target = { o, label }; } };
    for (const it of G.worldItems.near(cam.x, cam.z)) consider(it, it.pos, 2.2, ITEMS[it.id].n);
    for (const it of G.interactables) if (!it.used || it.kind === 'craft' || it.kind === 'radio') consider(it, it.pos, it.r, it.label);
    const pr = $('prompt');
    if (target) { pr.classList.remove('hidden'); $('promptText').textContent = target.label; } else pr.classList.add('hidden');
    // fish: catch with E when one is right in front (spear reaches further)
    if (input.usePressed && !target && P.headUnder) { const id = G.fauna.catchNear(cam, look); if (id) { inv.add(id); G.sfx && G.sfx('splash'); } }
    if (input.usePressed && target) act(target.o);
  };
  function act(o) {
    const P = G.player;
    if (o.kind === 'item') {
      if (o.id === 'urchin' && !inv.eq.gloves) { P.hp -= 6; G.toast && G.toast('אאוץ׳!', 'קיפוד ים דוקר – כדאי לבנות כפפות'); }
      if ((o.id === 'sponge' || o.id === 'deepSponge') && !count('knife')) { G.toast && G.toast('צריך סכין', 'ספוגים חותכים עם סכין'); return; }
      if (o.id === 'starfish') { G.toast && G.toast('כוכב ים', 'צילמת אותו בזיכרון והחזרת לים'); inv.done.add(o.key); G.worldItems.remove(o); G.story && G.story.check(); return; }
      inv.add(o.id); inv.done.add(o.key); G.worldItems.remove(o); G.sfx && G.sfx('pick');
      if (o.id === 'bottleMsg') use('bottleMsg');
    } else if (o.kind === 'craft') inv.craft(true, o.tab);
    else if (o.kind === 'loot') { o.used = true; inv.done.add(o.key); for (const [id, n] of Object.entries(o.items)) inv.add(id, n); o.mesh.children[0].rotation.x = -1.2; G.sfx && G.sfx('open'); }
    else if (o.kind === 'clam') { o.used = true; inv.done.add(o.key); inv.add('pearl'); G.sfx && G.sfx('pick'); }
    else if (o.kind === 'log') { o.used = true; inv.done.add(o.key); o.mesh.visible = false; if (!inv.logs.includes(o.idx)) inv.logs.push(o.idx); showLog(o.idx); G.sfx && G.sfx('page'); G.story && G.story.check(); }
    else if (o.kind === 'radio') G.story && G.story.radio();
  }
  applyGear();
  return inv;
}

// ---------- story ----------
export function createStory(state) {
  const st = { flags: state.flags || {}, step: state.step || 0 };
  const inv = G.inv, P = () => G.player;
  const steps = [
    { t: 'מצא את מחנה המשלחת על האי', done: () => G.campPos.distanceTo(P().pos) < 12, target: () => G.campPos },
    { t: 'קרא את דף היומן בשולחן העבודה', done: () => inv.logs.includes(0), target: () => G.campPos },
    { t: 'אסוף חומרים ובנה מסכה וסנפירים', done: () => inv.eq.mask && inv.eq.fins, hint: 'פלסטיק וזכוכית ים בחוף, אצות בלגונה, מלח על סלעי החוף' },
    { t: 'בנה מיכל חמצן', done: () => inv.eq.tank, hint: 'גרוטאות מתכת יש סביב הספינה הטבועה – אבל קרוב לחוף יש גם' },
    { t: 'צלול אל הספינה הטבועה "שחף"', done: () => G.wreckPos.distanceTo(P().pos) < 18, target: () => G.wreckPos, hint: 'במישור החולי, מעבר לשונית, בעומק 27 מטר' },
    { t: 'מצא 3 חלקי רדיו בספינה', done: () => (inv.count('radioPart') >= 3) || st.flags.radioBuilt, target: () => G.wreckPos },
    { t: 'בנה את הרדיו בשולחן העבודה', done: () => st.flags.radioBuilt, target: () => G.campPos },
    { t: 'הפעל את הרדיו בעמדת הקשר', done: () => st.flags.radioHeard, target: () => G.campPos },
    { t: 'בנה חליפת עומק וסקוטר', done: () => inv.eq.suit === 'suitDeep' && inv.eq.scooter, hint: 'כסף וספוגים סגולים יש רק במעמקים' },
    { t: 'רד אל קרקעית התעלה', done: () => P().pos.y < -110, hint: 'התעלה בדרום־מערב, מעבר למישור' },
    { t: 'המשך יבוא... (סוף פרק 1)', done: () => false },
  ];
  st.steps = steps;
  st.check = () => { let changed = false; while (st.step < steps.length - 1 && steps[st.step].done()) { st.step++; changed = true; } if (changed) { G.sfx && G.sfx('quest'); G.toast && G.toast('משימה חדשה', steps[st.step].t); if (st.step === steps.length - 1) G.onChapterEnd && G.onChapterEnd(); } render(); };
  st.flag = (f) => { st.flags[f] = true; st.check(); };
  st.radio = () => {
    if (!st.flags.radioBuilt) { inv.showNote('עמדת הקשר', 'הרדיו מפורק. צריך שלושה חלקי רדיו, חוט נחושת וסוללה – ולבנות אותו בשולחן העבודה.'); return; }
    st.flags.radioHeard = true;
    inv.showNote('שידור מהמעמקים', '...קשש... כאן תמר... אם מישהו שומע... אני בתוך התחנה בקרקעית התעלה... יש כאן אוויר... הגבישים... הם מאירים את הדרך... תביאו חליפת עומק... קשש...');
    st.check();
  };
  function render() {
    const s = steps[st.step]; $('objText').textContent = s.t; $('objHint').textContent = s.hint || '';
  }
  st.target = () => steps[st.step].target ? steps[st.step].target() : null;
  render();
  G.story = st;
  return st;
}
