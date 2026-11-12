// Item catalogue (60 items), procedural 3D models, icons rendered from the models, world spawning + pickup.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rng, clamp, noise2, WORLD } from './ctx.js';
import { height, biome, normalAt, underwater, PLACES } from './terrain.js';

// cat: raw | material | food | tool | gear | quest | build
export const ITEMS = {
  coconut: { n: 'קוקוס', cat: 'food', d: 'אוכל ושתייה ביחד. נמצא מתחת לדקלים.', food: 18, water: 22 },
  driftwood: { n: 'עץ סחף', cat: 'raw', d: 'ענף שהים פלט לחוף.' },
  palmLeaf: { n: 'ענף דקל', cat: 'raw', d: 'עלים ארוכים – אפשר לקלוע מהם סיבים.' },
  limestone: { n: 'אבן גיר', cat: 'raw', d: 'אבן לבנה ורכה.' },
  plastic: { n: 'בקבוק פלסטיק', cat: 'raw', d: 'זבל שנסחף לאי. נותנים לו חיים חדשים.' },
  oldRope: { n: 'חבל ישן', cat: 'raw', d: 'חבל ספינה שנשחק מהמים.' },
  shell: { n: 'צדף', cat: 'raw', d: 'צדף מבריק מהלגונה.' },
  seagrass: { n: 'אצת ים', cat: 'raw', d: 'עשב ים מהלגונה.' },
  seaGlass: { n: 'זכוכית ים', cat: 'raw', d: 'שבר זכוכית שהגלים שייפו.' },
  urchin: { n: 'קיפוד ים', cat: 'raw', d: 'דוקר! עדיף עם כפפות.' },
  coralRubble: { n: 'שבר אלמוג מת', cat: 'raw', d: 'שלד אלמוג שנשבר מזמן. אוספים רק מה שכבר מת.' },
  sponge: { n: 'ספוג ים', cat: 'raw', d: 'ספוג רך מגן הספוגים.' },
  pearl: { n: 'פנינה', cat: 'raw', d: 'נדירה. נמצאת בצדפות ענק.' },
  copperOre: { n: 'עפרת נחושת', cat: 'raw', d: 'סלע עם עורקים ירקרקים.' },
  quartz: { n: 'קוורץ', cat: 'raw', d: 'גביש שקוף.' },
  salt: { n: 'גבישי מלח', cat: 'raw', d: 'מלח שהתגבש על סלעי החוף.' },
  scrap: { n: 'גרוטאת מתכת', cat: 'raw', d: 'חתיכות מהספינה הטבועה.' },
  wires: { n: 'חוטי חשמל', cat: 'raw', d: 'כבלים מתוך הספינה.' },
  battery: { n: 'סוללה', cat: 'raw', d: 'עוד יש בה קצת חשמל.' },
  radioPart: { n: 'חלק רדיו', cat: 'quest', d: 'חלק ממכשיר הקשר של המשלחת.' },
  solarCell: { n: 'תא סולארי', cat: 'raw', d: 'לוח קטן שעוד עובד.' },
  silverOre: { n: 'עפרת כסף', cat: 'raw', d: 'מהמעמקים. כבדה ומבריקה.' },
  glowCrystal: { n: 'גביש זוהר', cat: 'raw', d: 'זוהר בחושך. מה המשלחת חיפשה כאן?' },
  deepSponge: { n: 'ספוג עמוק', cat: 'raw', d: 'ספוג סגול מהעומק.' },
  sardine: { n: 'סרדין', cat: 'raw', d: 'דג קטן. צריך לצלות.' },
  snapper: { n: 'לוטיאנוס', cat: 'raw', d: 'דג גדול. צריך לצלות.' },
  // materials
  fiber: { n: 'סיבים', cat: 'material', d: 'סיבים קלועים.' },
  rope: { n: 'חבל', cat: 'material', d: 'חבל חזק. בלי חבל אין שבט.' },
  glass: { n: 'זכוכית', cat: 'material', d: 'זכוכית שקופה.' },
  copperWire: { n: 'חוט נחושת', cat: 'material', d: 'מוליך חשמל.' },
  metalPlate: { n: 'לוח מתכת', cat: 'material', d: 'מתכת מעובדת.' },
  lens: { n: 'עדשה', cat: 'material', d: 'מקרבת ומאירה.' },
  // food
  water: { n: 'מים מותפלים', cat: 'food', d: 'מים מתוקים מהמזקק.', water: 45 },
  grilledSardine: { n: 'סרדין צלוי', cat: 'food', d: 'טעים.', food: 28 },
  grilledSnapper: { n: 'לוטיאנוס צלוי', cat: 'food', d: 'ארוחה שלמה.', food: 55, water: -5 },
  salad: { n: 'סלט אצות', cat: 'food', d: 'בריא. מלוח.', food: 16, water: -4 },
  firstAid: { n: 'ערכת עזרה ראשונה', cat: 'food', d: 'מחזירה בריאות.', hp: 50 },
  // tools / gear
  knife: { n: 'סכין', cat: 'tool', d: 'חותכת ספוגים ואצות.' },
  spear: { n: 'חנית דיג', cat: 'tool', d: 'תופסים דגים מרחוק יותר.' },
  gloves: { n: 'כפפות צלילה', cat: 'gear', slot: 'gloves', d: 'קיפודי ים כבר לא דוקרים.' },
  mask: { n: 'מסכת צלילה', cat: 'gear', slot: 'mask', d: 'רואים רחוק יותר מתחת למים.' },
  fins: { n: 'סנפירים', cat: 'gear', slot: 'fins', d: 'שחייה מהירה יותר.' },
  o2Tank: { n: 'מיכל חמצן', cat: 'gear', slot: 'tank', d: '+45 שניות אוויר.', o2: 45 },
  o2TankBig: { n: 'מיכל חמצן גדול', cat: 'gear', slot: 'tank', d: '+110 שניות אוויר.', o2: 110 },
  lamp: { n: 'פנס צלילה', cat: 'gear', slot: 'lamp', d: 'F להדלקה.' },
  suit: { n: 'חליפת צלילה', cat: 'gear', slot: 'suit', d: 'אפשר לרדת עד 60 מטר.', depth: 60 },
  suitDeep: { n: 'חליפת עומק', cat: 'gear', slot: 'suit', d: 'אפשר לרדת עד 180 מטר.', depth: 180 },
  scooter: { n: 'סקוטר תת־ימי', cat: 'gear', slot: 'scooter', d: 'Shift + W – טסים מתחת למים.' },
  scanner: { n: 'סורק', cat: 'tool', d: 'מגלה מה זה כל יצור.' },
  lightStick: { n: 'מקל תאורה', cat: 'tool', d: 'משאירים אותו בחושך.' },
  radio: { n: 'רדיו מתוקן', cat: 'quest', d: 'אולי מישהו עוד משדר...' },
  beacon: { n: 'משואה', cat: 'tool', d: 'סימון במצפן.' },
  storage: { n: 'ארגז אחסון', cat: 'build', d: 'ארגז עץ למחנה.' },
  journal: { n: 'דף יומן', cat: 'quest', d: '' },
  starfish: { n: 'כוכב ים', cat: 'raw', d: 'יפה. מחזירים אותו לים אחרי שמסתכלים.' },
  bottleMsg: { n: 'בקבוק עם פתק', cat: 'quest', d: 'פתק בתוך בקבוק.' },
  rubber: { n: 'גומי', cat: 'material', d: 'מבקבוקי פלסטיק מותכים.' },
  cloth: { n: 'בד', cat: 'material', d: 'בד קלוע מסיבים.' },
};
export const RECIPES = [
  { out: 'fiber', n: 2, in: { palmLeaf: 1, seagrass: 1 }, tab: 'חומרים' },
  { out: 'rope', in: { fiber: 3 }, tab: 'חומרים' },
  { out: 'rope', in: { oldRope: 2 }, tab: 'חומרים', alt: true },
  { out: 'cloth', in: { fiber: 4 }, tab: 'חומרים' },
  { out: 'rubber', in: { plastic: 2 }, tab: 'חומרים' },
  { out: 'glass', in: { seaGlass: 2, salt: 1 }, tab: 'חומרים' },
  { out: 'copperWire', in: { copperOre: 2 }, tab: 'חומרים' },
  { out: 'metalPlate', in: { scrap: 2 }, tab: 'חומרים' },
  { out: 'lens', in: { quartz: 1, glass: 1 }, tab: 'חומרים' },
  { out: 'water', in: { plastic: 1 }, tab: 'אוכל' },
  { out: 'grilledSardine', in: { sardine: 1, driftwood: 1 }, tab: 'אוכל' },
  { out: 'grilledSnapper', in: { snapper: 1, driftwood: 1 }, tab: 'אוכל' },
  { out: 'salad', in: { seagrass: 2, salt: 1 }, tab: 'אוכל' },
  { out: 'firstAid', in: { cloth: 1, sponge: 1, salt: 1 }, tab: 'אוכל' },
  { out: 'knife', in: { scrap: 1, driftwood: 1 }, tab: 'כלים' },
  { out: 'spear', in: { driftwood: 2, scrap: 1, rope: 1 }, tab: 'כלים' },
  { out: 'gloves', in: { rubber: 1, cloth: 1 }, tab: 'ציוד' },
  { out: 'mask', in: { glass: 1, rubber: 1 }, tab: 'ציוד' },
  { out: 'fins', in: { rubber: 2, rope: 1 }, tab: 'ציוד' },
  { out: 'o2Tank', in: { metalPlate: 2, rope: 1, rubber: 1 }, tab: 'ציוד' },
  { out: 'o2TankBig', in: { o2Tank: 1, metalPlate: 2, copperWire: 1 }, tab: 'ציוד' },
  { out: 'lamp', in: { battery: 1, glass: 1, copperWire: 1 }, tab: 'ציוד' },
  { out: 'suit', in: { cloth: 3, rubber: 2, sponge: 2 }, tab: 'ציוד' },
  { out: 'suitDeep', in: { suit: 1, metalPlate: 3, silverOre: 2, deepSponge: 2 }, tab: 'ציוד' },
  { out: 'scooter', in: { battery: 2, metalPlate: 3, copperWire: 2, solarCell: 1 }, tab: 'ציוד' },
  { out: 'scanner', in: { lens: 1, battery: 1, copperWire: 1 }, tab: 'כלים' },
  { out: 'lightStick', n: 2, in: { glowCrystal: 1, plastic: 1 }, tab: 'כלים' },
  { out: 'beacon', in: { metalPlate: 1, glowCrystal: 1, battery: 1 }, tab: 'כלים' },
  { out: 'radio', in: { radioPart: 3, copperWire: 1, battery: 1 }, tab: 'משימה' },
  { out: 'storage', in: { driftwood: 4, rope: 1 }, tab: 'כלים' },
];

// ---------- models ----------
const M = (c, o = {}) => underwater(new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6 }, o)));
function rock(r0, col, speck) { const g = new THREE.IcosahedronGeometry(r0, 1); const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pa, i); v.multiplyScalar(1 + noise2(v.x * 9, v.y * 9 + v.z * 5) * 0.22); pa.setXYZ(i, v.x, v.y * 0.75, v.z); } g.computeVertexNormals(); const grp = new THREE.Group(); grp.add(new THREE.Mesh(g, M(col, { roughness: 0.95, flatShading: true }))); if (speck) for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(r0 * 0.18), M(speck, { metalness: 0.6, roughness: 0.3 })); s.position.set((Math.random() - 0.5) * r0 * 1.4, (Math.random() - 0.2) * r0 * 0.7, (Math.random() - 0.5) * r0 * 1.4); grp.add(s); } return grp; }
const lathe = (pts, col, o) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 16), M(col, o));
function model(id) {
  const g = new THREE.Group(), add = (m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); g.add(m); return m; };
  switch (id) {
    case 'coconut': { const m = add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), M(0x6a4526, { roughness: 1 }))); m.scale.set(1, 1.15, 1); for (let k = 0; k < 3; k++) add(new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), M(0x2a1a0e)), Math.cos(k * 2.1) * 0.04, 0.14, Math.sin(k * 2.1) * 0.04); break; }
    case 'driftwood': { const m = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.7, 7), M(0xb8ab98, { roughness: 1 }))); m.rotation.z = 1.4; const b = add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.25, 6), M(0xa89b88)), 0.12, 0.06, 0); b.rotation.z = 0.6; break; }
    case 'palmLeaf': { const pg = new THREE.PlaneGeometry(0.16, 0.8, 1, 6); const pa = pg.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, Math.pow(pa.getY(i), 2) * 0.3); const m = add(new THREE.Mesh(pg, M(0x5d8a32, { side: THREE.DoubleSide }))); m.rotation.x = -1.2; break; }
    case 'limestone': g.add(rock(0.13, 0xe6dccb)); break;
    case 'plastic': case 'water': add(lathe([[0, 0], [0.05, 0], [0.055, 0.02], [0.055, 0.17], [0.03, 0.22], [0.02, 0.25], [0.022, 0.27], [0, 0.27]], id === 'water' ? 0x9fd8ff : 0x6fb6d8, { transparent: true, opacity: 0.7, roughness: 0.2 }), 0, -0.13, 0); add(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.025, 10), M(id === 'water' ? 0x2f6fd0 : 0xd03030)), 0, 0.15, 0); g.rotation.z = 1.3; break;
    case 'oldRope': case 'rope': add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.028, 8, 20), M(id === 'rope' ? 0xd8bf88 : 0x8a7a5a, { roughness: 1 }))).rotation.x = Math.PI / 2; add(new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.028, 8, 20), M(id === 'rope' ? 0xd8bf88 : 0x8a7a5a, { roughness: 1 })), 0, 0.05, 0).rotation.x = Math.PI / 2; break;
    case 'shell': { const sg = new THREE.ConeGeometry(0.1, 0.03, 12, 1, true, 0, Math.PI); const pa = sg.attributes.position; for (let i = 0; i < pa.count; i++) pa.setY(i, pa.getY(i) + Math.sin(Math.atan2(pa.getZ(i), pa.getX(i)) * 9) * 0.008); sg.computeVertexNormals(); const m = add(new THREE.Mesh(sg, M(0xf2d0b8, { side: THREE.DoubleSide, roughness: 0.4 }))); m.rotation.x = -1.4; break; }
    case 'seagrass': for (let k = 0; k < 7; k++) { const b = add(new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.4), M(0x5f8a3a, { side: THREE.DoubleSide })), (Math.random() - 0.5) * 0.08, 0.2, (Math.random() - 0.5) * 0.08); b.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * 3, (Math.random() - 0.5) * 0.4); } break;
    case 'seaGlass': add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.05, 0), M(0x6fd8a8, { transparent: true, opacity: 0.75, roughness: 0.35 }))).scale.set(1.3, 0.5, 1); break;
    case 'urchin': { add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), M(0x2a1830))); const sp = []; for (let k = 0; k < 40; k++) { const c = new THREE.ConeGeometry(0.006, 0.14, 3); c.translate(0, 0.1, 0); const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize(); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)); sp.push(c); } add(new THREE.Mesh(mergeGeometries(sp), M(0x1a0f20))); break; }
    case 'coralRubble': for (let k = 0; k < 5; k++) { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.16, 5), M(0xefe8da, { roughness: 1 })), (Math.random() - 0.5) * 0.15, 0.03, (Math.random() - 0.5) * 0.15); c.rotation.set(Math.random() * 3, Math.random() * 3, 1.4); } break;
    case 'sponge': case 'deepSponge': { const s = new THREE.IcosahedronGeometry(0.12, 2); const pa = s.attributes.position; for (let i = 0; i < pa.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pa, i); v.multiplyScalar(1 + noise2(v.x * 30, v.y * 30 + v.z * 20) * 0.15); pa.setXYZ(i, v.x, v.y, v.z); } s.computeVertexNormals(); add(new THREE.Mesh(s, M(id === 'sponge' ? 0xe0b13a : 0x7a3aa8, { roughness: 1 }))); break; }
    case 'pearl': add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), M(0xfaf6ee, { roughness: 0.15, metalness: 0.3, emissive: 0x221f1a }))); break;
    case 'copperOre': g.add(rock(0.13, 0x6f6458, 0x3fae86)); break;
    case 'silverOre': g.add(rock(0.14, 0x5a5d66, 0xdfe4ec)); break;
    case 'quartz': case 'glowCrystal': for (let k = 0; k < 5; k++) { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(0, 0.035, 0.22, 6), M(id === 'quartz' ? 0xeef4ff : 0x2adcc8, id === 'quartz' ? { transparent: true, opacity: 0.8, roughness: 0.1 } : { emissive: 0x22ffd8, emissiveIntensity: 1.6 })), (Math.random() - 0.5) * 0.08, 0.08, (Math.random() - 0.5) * 0.08); c.rotation.set((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8); } break;
    case 'salt': for (let k = 0; k < 6; k++) { const c = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), M(0xffffff, { roughness: 0.3 })), (Math.random() - 0.5) * 0.12, 0.025 + (k > 3 ? 0.04 : 0), (Math.random() - 0.5) * 0.12); c.rotation.set(Math.random(), Math.random(), Math.random()); } break;
    case 'scrap': case 'metalPlate': { const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.22), M(id === 'scrap' ? 0x7a5a44 : 0xa8b0b8, { metalness: 0.7, roughness: id === 'scrap' ? 0.8 : 0.35 }))); if (id === 'scrap') { b.rotation.z = 0.3; add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.1), M(0x6a4a34, { metalness: 0.6 })), 0.08, 0.05, 0).rotation.set(0.4, 0.3, 1); } break; }
    case 'wires': case 'copperWire': { const pts = []; for (let k = 0; k < 60; k++) pts.push(new THREE.Vector3(Math.cos(k * 0.6) * 0.09, k * 0.002, Math.sin(k * 0.6) * 0.09)); const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.012, 5); add(new THREE.Mesh(tg, M(id === 'wires' ? 0xd03a2a : 0xc87a3a, { metalness: id === 'wires' ? 0 : 0.8, roughness: 0.4 }))); if (id === 'copperWire') add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.15, 12), M(0x5a4a3a)), 0, 0.06, 0); break; }
    case 'battery': add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 12), M(0x222222))).rotation.z = Math.PI / 2; add(new THREE.Mesh(new THREE.CylinderGeometry(0.051, 0.051, 0.06, 12), M(0xd8a020, { metalness: 0.5 })), 0.07, 0, 0).rotation.z = Math.PI / 2; break;
    case 'radioPart': add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.15), M(0x2f7a3a))); for (let k = 0; k < 6; k++) add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.03), M(k % 2 ? 0x222222 : 0xc8a040, { metalness: 0.5 })), (k % 3 - 1) * 0.06, 0.02, (k > 2 ? 1 : -1) * 0.04); break;
    case 'solarCell': add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.015, 0.2), M(0x1d3a7a, { metalness: 0.4, roughness: 0.25 }))); add(new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.01, 0.005), M(0xcccccc)), 0, 0.01, 0); break;
    case 'sardine': case 'snapper': case 'grilledSardine': case 'grilledSnapper': { const L = id.includes('nap') ? 0.2 : 0.1; const b = add(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), M(id.startsWith('grilled') ? 0x8a5a2a : id === 'snapper' ? 0xd8b45c : 0xb8c8d6, { metalness: id === 'sardine' ? 0.5 : 0.1, roughness: 0.4 }))); b.scale.set(L * 0.25, L * 0.4, L); const t = add(new THREE.Mesh(new THREE.ConeGeometry(L * 0.35, L * 0.4, 3), b.material), 0, 0, -L * 1.1); t.rotation.x = Math.PI / 2; g.rotation.y = 1.2; break; }
    case 'fiber': for (let k = 0; k < 8; k++) { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4), M(0xc8b070)), (Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.04); c.rotation.z = 1.4 + (Math.random() - 0.5) * 0.2; } add(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 10), M(0x8a6a3a)), 0, 0, 0).rotation.y = Math.PI / 2; break;
    case 'cloth': add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.2), M(0xcfb98a, { roughness: 1 }))); add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.2), M(0xbfa97a, { roughness: 1 })), 0.01, 0.035, 0.01); break;
    case 'rubber': add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.12), M(0x1f2a2a, { roughness: 0.7 }))); break;
    case 'glass': add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.01, 0.18), M(0xcfefff, { transparent: true, opacity: 0.55, roughness: 0.05 }))); break;
    case 'lens': add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 8), M(0xdff4ff, { transparent: true, opacity: 0.7, roughness: 0.05 }))).scale.set(1, 0.3, 1); add(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.01, 6, 20), M(0x333333)), 0, 0, 0).rotation.x = Math.PI / 2; break;
    case 'salad': add(lathe([[0, 0], [0.08, 0], [0.12, 0.06], [0.12, 0.065], [0, 0.065]], 0xd8c8a8)); for (let k = 0; k < 8; k++) add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), M(0x4f8a32)), (Math.random() - 0.5) * 0.12, 0.07, (Math.random() - 0.5) * 0.12); break;
    case 'firstAid': add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), M(0xf2f2ee))); add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.125, 0.1), M(0xd02020)), 0, 0, 0); add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.125, 0.03), M(0xd02020)), 0, 0, 0); break;
    case 'knife': add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.04), M(0xcfd6dc, { metalness: 0.9, roughness: 0.2 })), 0.08, 0, 0); add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.12, 8), M(0x5a3a22)), -0.08, 0, 0).rotation.z = Math.PI / 2; break;
    case 'spear': add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 1.0, 6), M(0x9a7a50))).rotation.z = Math.PI / 2; add(new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 6), M(0xbfc6cc, { metalness: 0.8 })), 0.55, 0, 0).rotation.z = -Math.PI / 2; break;
    case 'gloves': for (const s of [-1, 1]) { add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.14), M(0x1f2a2a)), s * 0.07, 0, 0); for (let k = 0; k < 4; k++) add(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.025, 0.06), M(0x1f2a2a)), s * 0.07 + (k - 1.5) * 0.022, 0, 0.09); } break;
    case 'mask': add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.06), M(0x20304a))); for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.07, 0.01), M(0x9fe0ff, { transparent: true, opacity: 0.6, roughness: 0.05 })), s * 0.05, 0, 0.032); add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 4, 20, Math.PI), M(0x111111)), 0, 0, -0.03).rotation.z = 0; break;
    case 'fins': for (const s of [-1, 1]) { const f = add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.32), M(0xf3e03b)), s * 0.07, 0, 0); f.rotation.y = s * 0.12; add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.1), M(0x222222)), s * 0.07, 0.02, -0.12); } break;
    case 'o2Tank': case 'o2TankBig': { const big = id === 'o2TankBig'; add(new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.08 : 0.065, big ? 0.08 : 0.065, big ? 0.45 : 0.34, 14), M(big ? 0xd8d8d0 : 0xf3c31b, { metalness: 0.5, roughness: 0.35 }))); add(new THREE.Mesh(new THREE.SphereGeometry(big ? 0.08 : 0.065, 14, 8, 0, 6.3, 0, 1.6), M(big ? 0xd8d8d0 : 0xf3c31b, { metalness: 0.5 })), 0, big ? 0.225 : 0.17, 0); add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8), M(0x333333, { metalness: 0.8 })), 0, big ? 0.32 : 0.26, 0); g.rotation.z = 1.2; break; }
    case 'lamp': add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.22, 12), M(0x222222))).rotation.z = Math.PI / 2; add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.05, 12), M(0xf3e03b)), 0.12, 0, 0).rotation.z = Math.PI / 2; add(new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), M(0xffffee, { emissive: 0xffffcc, emissiveIntensity: 2 })), 0.146, 0, 0).rotation.y = Math.PI / 2; break;
    case 'suit': case 'suitDeep': { const c = id === 'suit' ? 0x2f5f9a : 0x1a1a1f; add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.3), M(c, { roughness: 0.6 }))); add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.03), M(id === 'suit' ? 0xf3e03b : 0xa8121b)), 0, 0.035, 0.05); break; }
    case 'scooter': add(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 6, 12), M(0xf3e03b, { roughness: 0.4 }))).rotation.z = Math.PI / 2; add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16), M(0x222222)), -0.25, 0, 0).rotation.y = Math.PI / 2; for (let k = 0; k < 3; k++) add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.08, 0.02), M(0x333333)), -0.25, Math.cos(k * 2.1) * 0.04, Math.sin(k * 2.1) * 0.04).rotation.x = k * 2.1; break;
    case 'scanner': add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.2), M(0x3a3a3a))); add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.005, 0.08), M(0x2adcc8, { emissive: 0x2adcc8, emissiveIntensity: 1 })), 0, 0.023, -0.03); break;
    case 'lightStick': add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 8), M(0x2adcc8, { emissive: 0x22ffd8, emissiveIntensity: 2 }))).rotation.z = 1.2; break;
    case 'radio': add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.12), M(0x4a5a3a))); add(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 4), M(0x222222)), 0.09, 0.2, 0); add(new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), M(0x222222)), -0.05, 0, 0.061); break;
    case 'beacon': add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.3, 8), M(0xa8b0b8, { metalness: 0.6 }))); add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), M(0xff4040, { emissive: 0xff2020, emissiveIntensity: 2 })), 0, 0.18, 0); break;
    case 'storage': add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.22), M(0x8a6440, { roughness: 1 }))); add(new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.03, 0.23), M(0x5a4028)), 0, 0.07, 0); break;
    case 'starfish': for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, c = add(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 5), M(0xe0582a)), Math.cos(a) * 0.06, 0.01, Math.sin(a) * 0.06); c.rotation.set(0, -a, Math.PI / 2); } break;
    case 'bottleMsg': add(lathe([[0, 0], [0.05, 0], [0.05, 0.16], [0.02, 0.22], [0.02, 0.26], [0, 0.26]], 0x4f8a5a, { transparent: true, opacity: 0.6, roughness: 0.1 }), 0, -0.12, 0); add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), M(0xf2e8c8)), 0, -0.03, 0); g.rotation.z = 1.4; break;
    case 'journal': add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.26), M(0x6a3a22))); add(new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.032, 0.25), M(0xf2e8c8)), 0.004, 0.002, 0); break;
    default: add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), M(0xff00ff)));
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}
export const itemModel = model;

// icons: render each model once with a little studio light
export function makeIcons() {
  const size = 96, rnd = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  rnd.setSize(size, size); rnd.outputColorSpace = THREE.SRGBColorSpace; rnd.toneMapping = THREE.ACESFilmicToneMapping;
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6)); const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(1, 2, 1.5); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
  const icons = {};
  for (const id in ITEMS) {
    const m = model(id); sc.add(m);
    const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()).length();
    m.position.sub(c); m.rotation.y += 0.6;
    cam.position.set(0, s * 0.9, s * 1.6); cam.lookAt(0, 0, 0);
    rnd.render(sc, cam); icons[id] = rnd.domElement.toDataURL();
    sc.remove(m);
  }
  rnd.dispose();
  return icons;
}

// ---------- world spawning ----------
// where each pickup can be found
const SPAWN = {
  coconut: { n: 60, near: 'palms' }, driftwood: { n: 70, b: ['beach'] }, palmLeaf: { n: 70, b: ['land'] }, limestone: { n: 60, b: ['land', 'beach', 'lagoon'] },
  plastic: { n: 55, b: ['beach'] }, oldRope: { n: 30, b: ['beach'] }, shell: { n: 90, b: ['lagoon', 'beach'] }, seagrass: { n: 120, b: ['lagoon', 'slope'] },
  seaGlass: { n: 60, b: ['lagoon', 'beach'] }, urchin: { n: 60, b: ['reef'] }, coralRubble: { n: 80, b: ['reef', 'lagoon'] }, sponge: { n: 70, b: ['sponge'] },
  copperOre: { n: 55, b: ['slope', 'reef'], steep: true }, quartz: { n: 50, b: ['slope', 'plain', 'reef'] }, salt: { n: 45, b: ['beach'] },
  scrap: { n: 50, near: 'wreck', r: 45 }, silverOre: { n: 40, b: ['deep'] }, glowCrystal: { n: 45, b: ['trench', 'deep'], deep: -55 }, deepSponge: { n: 40, b: ['deep', 'trench'], deep: -45 },
  starfish: { n: 50, b: ['lagoon', 'plain'] }, bottleMsg: { n: 1, fixed: [[-52, 60]] },
};
export function spawnItems(collected) {
  const S = G.scene, r = rng(2026), half = WORLD / 2 - 15, nrm = new THREE.Vector3();
  const list = [];        // {id, key, pos, mesh}
  const grid = new Map(), CELL = 8, gk = (x, z) => Math.floor(x / CELL) * 4096 + Math.floor(z / CELL);
  const put = (id, x, y, z, key) => {
    if (collected && collected.has(key)) return;
    const m = model(id); m.position.set(x, y, z); m.rotation.y = r() * 6; S.add(m);
    const it = { id, key, pos: m.position, mesh: m, kind: 'item' }; list.push(it);
    const k = gk(x, z); let a = grid.get(k); if (!a) { a = []; grid.set(k, a); } a.push(it);
  };
  for (const id in SPAWN) {
    const s = SPAWN[id]; let made = 0, tries = 0;
    if (s.fixed) { s.fixed.forEach(([x, z], i) => put(id, x, height(x, z) + 0.05, z, id + i)); continue; }
    while (made < s.n && tries++ < s.n * 400) {
      let x, z;
      if (s.near === 'palms' && G.palmTops) { const t = r.pick(G.palmTops); x = t.x + (r() - 0.5) * 3; z = t.z + (r() - 0.5) * 3; }
      else if (s.near === 'wreck') { const a = r() * 6.28, d = r() * s.r; x = PLACES.wreck.x + Math.cos(a) * d; z = PLACES.wreck.z + Math.sin(a) * d; }
      else { x = (r() * 2 - 1) * half; z = (r() * 2 - 1) * half; }
      const h = height(x, z), b = biome(x, z, h);
      if (s.b && !s.b.includes(b)) continue; if (s.deep && h > s.deep) continue;
      normalAt(x, z, nrm); if (s.steep && nrm.y > 0.93 && r() < 0.7) continue;
      put(id, x, h + 0.04, z, id + made); made++;
    }
  }
  const W = { list, grid };
  W.near = (x, z) => { const out = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = grid.get((Math.floor(x / CELL) + i) * 4096 + Math.floor(z / CELL) + j); if (a) out.push(...a); } return out; };
  W.add = put;
  W.remove = (it) => { G.scene.remove(it.mesh); it.gone = true; const a = grid.get(gk(it.pos.x, it.pos.z)); if (a) a.splice(a.indexOf(it), 1); };
  G.worldItems = W;
  return W;
}
