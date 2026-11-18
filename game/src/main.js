// ============================================================================
// NIGHTFALL: DISTRICT ZERO
// A 2D top-down open-world crime game set in the fictional coastal city of
// Vespera. You are Jace Mercer, back in the city after years away, chasing the
// trail of your vanished mentor Elias Rook through eight districts, eight
// missions, the police, rival crews, and the night itself.
//
// Everything in this file is original: the city, the people, the vehicles,
// the story, the art, the sounds. No third-party assets, no network calls.
//
// How it plays (keyboard + mouse):
//   WASD ........ move / drive        Shift ...... sprint / boost
//   Space ....... hop                 C .......... crouch (harder to spot)
//   E ........... interact / enter or exit a vehicle
//   Mouse ....... aim                 Left click . shoot
//   Right click . aim down sights     R .......... reload
//   Q or 1-5 .... switch weapon       Esc ........ pause menu
//   M ........... city map            J .......... mission journal
//   H ........... headlights          0 .......... mute sound
//
// Screenshot staging: ?shot=start (downtown drive), ?shot=play (mission and
// combat), ?shot=chase (police pursuit), ?shot=night (rainy night city).
// ============================================================================

// --- Canvas -----------------------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

let viewW = 1280;
let viewH = 800;

function resizeView() {
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = viewW;
  canvas.height = viewH;
}
window.addEventListener('resize', resizeView);
resizeView();

// --- World constants --------------------------------------------------------
const WORLD_W = 3600;
const WORLD_H = 2700;
const ROAD_GAP = 300;
const ROAD_W = 70;
const SAVE_KEY = 'nightfall-save';
const SHOT_PARAM = new URLSearchParams(window.location.search).get('shot');
const TAU = Math.PI * 2;

// --- Seeded random (world generation only; gameplay uses Math.random) -------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261118);
function rand(a, b) { return a + rng() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function pickOne(list) { return list[Math.floor(rng() * list.length)]; }

// --- Small helpers ----------------------------------------------------------
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2d(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function fmtCash(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
// Turn a fractional hour of the in-game day (0-24) into a 12-hour clock
// string such as "6:30 PM" for the HUD.
function formatClockTime(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h % 1) * 60);
  const ap = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return h12 + ':' + String(mm).padStart(2, '0') + ' ' + ap;
}

// Circle vs rectangle, used for pushing people and cars out of buildings.
function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// Segment vs rectangle (Liang-Barsky), used for police line of sight.
function segHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

// Push a circular body out of every solid rectangle it overlaps.
// Returns true when something was pushed.
function pushOutCircle(body, radius) {
  for (const b of solids) {
    const nx = clamp(body.x, b.x, b.x + b.w);
    const ny = clamp(body.y, b.y, b.y + b.h);
    let dx = body.x - nx, dy = body.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 < 0.0001) {
        const left = body.x - b.x, right = b.x + b.w - body.x;
        const top = body.y - b.y, bottom = b.y + b.h - body.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) body.x = b.x - radius;
        else if (m === right) body.x = b.x + b.w + radius;
        else if (m === top) body.y = b.y - radius;
        else body.y = b.y + b.h + radius;
      } else {
        const d = Math.sqrt(d2);
        body.x = nx + (dx / d) * radius;
        body.y = ny + (dy / d) * radius;
      }
      return true;
    }
  }
  return false;
}

function lineOfSightBlocked(x1, y1, x2, y2) {
  for (const b of solids) {
    if (segHitsRect(x1, y1, x2, y2, b)) return true;
  }
  return false;
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// --- Districts --------------------------------------------------------------
// The city is a 4-by-2 grid of districts. Each has its own ground tint and
// accent colour so the map reads at a glance, day or night.
const DISTRICTS = [
  { name: 'Hillside',   tint: '#20291d', accent: '#7fae62', note: 'Quiet streets above the bay' },
  { name: 'Downtown',   tint: '#1c2632', accent: '#5fa8d3', note: 'Glass towers and neon' },
  { name: 'Old Quarter', tint: '#2d2520', accent: '#d08a4a', note: 'Brick lanes and old money' },
  { name: 'Airport',    tint: '#252932', accent: '#9aa7b8', note: 'Transit hub and runways' },
  { name: 'Harbor',     tint: '#152329', accent: '#4a90a8', note: 'Docks, cranes and fog' },
  { name: 'Market',     tint: '#2a2118', accent: '#e0a83c', note: 'Stalls, spice and noise' },
  { name: 'Southside',  tint: '#231c25', accent: '#b06a8a', note: 'Row houses and garages' },
  { name: 'Industrial', tint: '#25211b', accent: '#c07a3a', note: 'Ironworks and warehouses' },
];

function districtAt(x, y) {
  const col = clamp(Math.floor(x / 900), 0, 3);
  const row = clamp(Math.floor(y / 1350), 0, 1);
  return DISTRICTS[row * 4 + col];
}

// --- Roads ------------------------------------------------------------------
const ROADS_V = [];
const ROADS_H = [];
for (let i = 0; i < 12; i++) ROADS_V.push(150 + i * ROAD_GAP);
for (let j = 0; j < 9; j++) ROADS_H.push(150 + j * ROAD_GAP);

function nearestRoadV(x) {
  let best = ROADS_V[0];
  for (const rx of ROADS_V) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}
function nearestRoadH(y) {
  let best = ROADS_H[0];
  for (const ry of ROADS_H) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

// --- Landmarks --------------------------------------------------------------
const LANDMARKS = [
  { name: 'Sunset Overlook',   x: 450,  y: 675,  w: 180, h: 120, kind: 'overlook' },
  { name: 'Vespera Tower',     x: 1350, y: 675,  w: 200, h: 200, kind: 'tower' },
  { name: 'Crown Hotel',       x: 2250, y: 675,  w: 200, h: 150, kind: 'hotel' },
  { name: 'Meridian Bridge',   x: 3150, y: 675,  w: 200, h: 120, kind: 'bridge' },
  { name: 'Central Station',   x: 1350, y: 1200, w: 220, h: 140, kind: 'station' },
  { name: 'Old Quarter Market', x: 2250, y: 1200, w: 200, h: 130, kind: 'market' },
  { name: 'Blackwater Harbor', x: 180,  y: 2025, w: 220, h: 160, kind: 'harbor' },
  { name: 'Neon Arcade',       x: 1350, y: 2025, w: 200, h: 140, kind: 'arcade' },
  { name: 'Ironworks Factory', x: 3150, y: 2025, w: 240, h: 160, kind: 'factory' },
];

// --- World generation -------------------------------------------------------
// Buildings fill the blocks between roads. Landmark blocks are kept clear so
// the landmark itself is the only structure there. Every building gets a few
// pre-rolled lit windows so night rendering stays cheap.
const buildings = [];
const solids = [];
const BUILDING_COLORS = ['#2c3542', '#33302c', '#2a2f38', '#3a2f2a', '#26333a', '#34302e'];

function landmarkInBlock(bx, by) {
  const x0 = 150 + bx * ROAD_GAP, y0 = 150 + by * ROAD_GAP;
  for (const lm of LANDMARKS) {
    if (lm.x >= x0 && lm.x < x0 + ROAD_GAP && lm.y >= y0 && lm.y < y0 + ROAD_GAP) return true;
  }
  return false;
}

for (let bx = 0; bx < 11; bx++) {
  for (let by = 0; by < 8; by++) {
    if (landmarkInBlock(bx, by)) continue;
    const bx0 = 150 + bx * ROAD_GAP + 48;
    const by0 = 150 + by * ROAD_GAP + 48;
    const count = randInt(1, 3);
    for (let k = 0; k < count; k++) {
      const w = rand(70, 150);
      const h = rand(60, 130);
      const x = bx0 + rand(0, Math.max(1, 204 - w));
      const y = by0 + rand(0, Math.max(1, 204 - h));
      const lit = [];
      const winCount = randInt(2, 6);
      for (let wi = 0; wi < winCount; wi++) {
        lit.push({ dx: rand(8, Math.max(9, w - 14)), dy: rand(8, Math.max(9, h - 14)) });
      }
      buildings.push({
        x, y, w, h,
        color: pickOne(BUILDING_COLORS),
        lit,
      });
    }
  }
}
// Landmarks are solid too, so the player, cars and line of sight respect them.
for (const lm of LANDMARKS) {
  buildings.push({ x: lm.x - lm.w / 2, y: lm.y - lm.h / 2, w: lm.w, h: lm.h, color: '#2e3440', lit: [], landmark: lm.kind });
}
for (const b of buildings) solids.push(b);

// --- Parked cars ------------------------------------------------------------
const parkedCars = [];
const PARKED_SPOTS = [];
for (let i = 0; i < 26; i++) {
  const vertical = rng() < 0.5;
  let x, y, angle;
  if (vertical) {
    x = pickOne(ROADS_V) + (rng() < 0.5 ? -46 : 46);
    y = rand(220, WORLD_H - 220);
    angle = rng() < 0.5 ? 0 : Math.PI;
  } else {
    x = rand(220, WORLD_W - 220);
    y = pickOne(ROADS_H) + (rng() < 0.5 ? -46 : 46);
    angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  }
  // Keep parked cars out of buildings.
  let clear = true;
  for (const b of solids) {
    if (circleHitsRect(x, y, 24, b)) { clear = false; break; }
  }
  if (!clear) continue;
  parkedCars.push({ x, y, angle, vIdx: randInt(0, 6), hp: 100, taken: false });
  PARKED_SPOTS.push({ x, y });
}

// --- Hidden collectibles: Rook's caches -------------------------------------
const caches = [];
for (let i = 0; i < 8; i++) {
  let x = 0, y = 0, ok = false, tries = 0;
  while (!ok && tries < 40) {
    tries++;
    x = rand(200, WORLD_W - 200);
    y = rand(200, WORLD_H - 200);
    ok = true;
    for (const b of solids) {
      if (circleHitsRect(x, y, 40, b)) { ok = false; break; }
    }
  }
  caches.push({ id: i, x, y, taken: false });
}

// --- Vehicle catalogue ------------------------------------------------------
// Nine rides, all fictional makes. top = top speed (world units per second),
// accel = how fast it gets there, turn = steering rate, hp = durability.
const VEHICLES = [
  { name: 'Arclight Velo',    kind: 'compact', top: 150, accel: 62, turn: 2.7, hp: 80,  len: 34, wid: 18, color: '#c94f4f' },
  { name: 'Meridian Atlas',   kind: 'sedan',   top: 168, accel: 56, turn: 2.4, hp: 100, len: 40, wid: 19, color: '#4f7ec9' },
  { name: 'Kestrel S9',       kind: 'sports',  top: 212, accel: 88, turn: 3.1, hp: 70,  len: 38, wid: 18, color: '#e0b13c' },
  { name: 'Rook GT',          kind: 'muscle',  top: 192, accel: 76, turn: 2.5, hp: 110, len: 42, wid: 20, color: '#8a4fc9' },
  { name: 'Halcyon XR',       kind: 'suv',     top: 162, accel: 51, turn: 2.2, hp: 130, len: 44, wid: 21, color: '#4fc98a' },
  { name: 'Titan Utility',    kind: 'pickup',  top: 156, accel: 49, turn: 2.1, hp: 140, len: 46, wid: 21, color: '#c97a4f' },
  { name: 'Ironworks Hauler', kind: 'van',     top: 142, accel: 41, turn: 1.9, hp: 160, len: 48, wid: 22, color: '#7a8a99' },
  { name: 'Swiftmoth 250',    kind: 'moto',    top: 202, accel: 92, turn: 3.5, hp: 50,  len: 30, wid: 12, color: '#d34f9a' },
  { name: 'VCPD Interceptor', kind: 'police',  top: 196, accel: 82, turn: 2.9, hp: 120, len: 40, wid: 19, color: '#2b3a55' },
];

// --- Weapon catalogue -------------------------------------------------------
const WEAPONS = [
  { name: 'Vesper P9',         kind: 'pistol',  dmg: 18, rate: 0.22, spread: 0.05, mag: 17, reserve: 68,  range: 430, pellets: 1, auto: false, price: 0,    color: '#d8d8d8' },
  { name: 'Harbor Heavy .45',  kind: 'heavy',   dmg: 30, rate: 0.36, spread: 0.04, mag: 10, reserve: 40,  range: 470, pellets: 1, auto: false, price: 400,  color: '#c9a24f' },
  { name: 'Neon Repeater',     kind: 'smg',     dmg: 11, rate: 0.09, spread: 0.09, mag: 32, reserve: 128, range: 390, pellets: 1, auto: true,  price: 900,  color: '#4fc9c9' },
  { name: 'Ironworks 12',      kind: 'shotgun', dmg: 12, rate: 0.72, spread: 0.22, mag: 6,  reserve: 24,  range: 310, pellets: 6, auto: false, price: 1200, color: '#c94f4f' },
  { name: 'Meridian Longshot', kind: 'rifle',   dmg: 45, rate: 0.52, spread: 0.02, mag: 8,  reserve: 32,  range: 720, pellets: 1, auto: false, price: 1500, color: '#8ac94f' },
];

// --- Missions ---------------------------------------------------------------
// Each mission is a short chain of steps. Step kinds:
//   goto ..... reach the marker (within 70 units)
//   interact . press E at the marker, or hold E for `hold` seconds
//   enter .... get into a vehicle of kind `vehicle` (or any, when absent)
//   deliver .. arrive at the marker while driving the required vehicle
//   survive .. stay alive for `seconds`
//   defeat ... bring down `count` enemies (they spawn when the step starts)
//   escape ... get the wanted level back down to zero
const MISSIONS = [
  {
    title: 'BACK IN THE CITY', giver: 'Mara Venn', payout: 500, rep: 10,
    brief: 'Mara Venn is waiting at the Neon Arcade. She knew Rook. She knows what happened.',
    steps: [
      { kind: 'goto', x: 1350, y: 2025, label: 'Meet Mara Venn at the Neon Arcade' },
      { kind: 'interact', x: 1350, y: 2025, label: 'Talk to Mara Venn', hold: 1 },
    ],
  },
  {
    title: 'HOT CARGO', giver: 'Mara Venn', payout: 800, rep: 15,
    brief: 'A delivery van full of Rook\u2019s old stock is sitting in the Industrial district. Take it to the warehouse.',
    steps: [
      { kind: 'goto', x: 3050, y: 1950, label: 'Find the delivery van in Industrial' },
      { kind: 'enter', x: 3050, y: 1950, label: 'Get in the delivery van', vehicle: 'van' },
      { kind: 'deliver', x: 2700, y: 2250, label: 'Drive the van to the warehouse', vehicle: 'van' },
    ],
  },
  {
    title: 'NO QUESTIONS', giver: 'Mara Venn', payout: 1000, rep: 20,
    brief: 'A sealed package. No questions, no peeking. Deliver it to the Old Quarter and keep the police off your back.',
    steps: [
      { kind: 'interact', x: 1400, y: 2150, label: 'Pick up the package at the Market', hold: 1 },
      { kind: 'deliver', x: 2250, y: 1000, label: 'Deliver the package to the Old Quarter', vehicle: 'any' },
    ],
  },
  {
    title: 'NIGHT SHIFT', giver: 'Mara Venn', payout: 1200, rep: 25,
    brief: 'Rook hid evidence in the Ironworks warehouse. Get in, get the files, get out. The crew watching it will not be friendly.',
    steps: [
      { kind: 'goto', x: 3100, y: 2100, label: 'Reach the Ironworks warehouse' },
      { kind: 'interact', x: 3100, y: 2100, label: 'Search the warehouse for the evidence', hold: 3 },
      { kind: 'goto', x: 1350, y: 2025, label: 'Bring the evidence back to Mara' },
      { kind: 'interact', x: 1350, y: 2025, label: 'Hand over the evidence', hold: 1 },
    ],
  },
  {
    title: 'CROSSTOWN', giver: 'Dorian Vale', payout: 1500, rep: 30,
    brief: 'Vale wants a show of speed: cross the city to the Airport in ninety seconds while his rivals try to stop you.',
    steps: [
      { kind: 'enter', x: 1350, y: 900, label: 'Get in a car', vehicle: 'any' },
      { kind: 'goto', x: 3150, y: 450, label: 'Reach the Airport before the clock runs out', seconds: 90 },
    ],
  },
  {
    title: 'THE LEDGER', giver: 'Mara Venn', payout: 1800, rep: 35,
    brief: 'Victor Senn keeps a ledger of every payoff in the city. It is in his Crown Hotel office. Take it, then disappear.',
    steps: [
      { kind: 'goto', x: 2250, y: 675, label: 'Reach the Crown Hotel on foot' },
      { kind: 'interact', x: 2250, y: 675, label: 'Steal the ledger from the office', hold: 3 },
      { kind: 'escape', x: 2250, y: 675, label: 'Lose the police, then lay low' },
      { kind: 'goto', x: 1350, y: 2025, label: 'Bring the ledger to Mara' },
    ],
  },
  {
    title: 'OLD DEBTS', giver: 'Nia Cross', payout: 2000, rep: 40,
    brief: 'An old ally of Rook\u2019s is pinned down in the Harbor. Get them out and drive them to the safehouse in Southside.',
    steps: [
      { kind: 'goto', x: 600, y: 2100, label: 'Reach your ally in the Harbor' },
      { kind: 'interact', x: 600, y: 2100, label: 'Get your ally moving', hold: 1 },
      { kind: 'goto', x: 2400, y: 2250, label: 'Escort your ally to the Southside safehouse' },
    ],
  },
  {
    title: 'DISTRICT ZERO', giver: 'Mara Venn', payout: 5000, rep: 60,
    brief: 'Everything Rook built comes down to this. Take the Tower, settle the score, and drive out of the city alive.',
    steps: [
      { kind: 'goto', x: 1350, y: 675, label: 'Reach Vespera Tower' },
      { kind: 'defeat', x: 1350, y: 675, label: 'Clear the Tower plaza', count: 5 },
      { kind: 'escape', x: 1350, y: 675, label: 'Escape the city-wide response' },
    ],
  },
];

// --- Side activities and the garage -----------------------------------------
const GARAGE = { x: 2400, y: 2250, name: 'Nia\u2019s Garage' };
const RACE_START = { x: 3300, y: 400, name: 'Airport sprint' };
const RACE_GATES = [
  { x: 3150, y: 1200 },
  { x: 1800, y: 1350 },
  { x: 600, y: 675 },
];
const SHOP_ITEMS = [
  { key: '1', label: 'Body armor (full)', price: 300 },
  { key: '2', label: 'Ammo refill (current weapon)', price: 100 },
  { key: '3', label: 'Repair current vehicle', price: 200 },
  { key: '4', label: 'Engine tune (+10 top speed)', price: 800 },
  { key: '5', label: 'Buy next weapon', price: 0 },
];

// --- Game state -------------------------------------------------------------
const player = {
  x: 1350, y: 900, angle: 0, aimAngle: 0,
  speed: 0, health: 100, armor: 0,
  cash: 200, rep: 0,
  onFoot: true, vehicle: null,
  weapon: 0,
  owned: [true, false, false, false, false],
  ammo: [],
  fireCd: 0, reloadTimer: 0, reloadTotal: 0,
  crouch: false, hop: 0, hopCd: 0,
  speedTune: 0, // engine tunes bought at the garage
};
for (let i = 0; i < WEAPONS.length; i++) {
  player.ammo.push({ mag: WEAPONS[i].mag, reserve: i === 0 ? WEAPONS[i].reserve : 0 });
}

// Phases: title, playing, paused, map, journal, settings, controls, shop.
let phase = 'title';
let prevPhase = 'playing';
let menuIndex = 0;
let menuButtons = [];
let settingsSel = 0;
let settings = { muted: false, showMinimap: true, weatherAuto: true };

let timeOfDay = 18.0; // hours; 18:00 dusk, advances slowly while playing
let weather = 'clear'; // clear | cloudy | rain
let weatherTimer = 40;
let headlights = false;

let wanted = 0;
let lastSeenAt = -100;
let wantedDecayTimer = 0;

const cam = { x: player.x, y: player.y, zoom: 1 };

// Mission progress.
const missionStates = MISSIONS.map((m, i) => (i === 0 ? 'AVAILABLE' : 'LOCKED'));
let missionIndex = 0;
let missionStep = 0;
let missionTimer = 0;
let missionKills = 0;
let missionFailedNote = '';
let gameComplete = false;
let ally = null; // mission 7 escort target

// Side activities.
let race = null; // { gate: 0, timer: 120, active: true }
let courier = null; // { px, py, dx, dy, timer: 60, state: 'pickup' | 'deliver' }
let courierCooldown = 25;

// Dialogue and notifications.
const dialogue = []; // { who, text }
let dialogueTimer = 0;
const notes = []; // { text, t }
function notify(text) {
  notes.push({ text, t: 5 });
  if (notes.length > 5) notes.shift();
  if (statusEl) statusEl.textContent = text;
}
function say(who, text) {
  dialogue.push({ who, text });
  dialogueTimer = 5;
}

// World actors.
const traffic = [];
const peds = [];
const policeCars = [];
const policeFoot = [];
const enemies = [];
const bullets = [];
const parts = [];
const rainDrops = [];
for (let i = 0; i < 110; i++) rainDrops.push({ x: Math.random() * 1400, y: Math.random() * 900, s: rand(500, 800) });

// Traffic: 18 cars that drive the road grid, stop for the car ahead, and
// respawn near the player when they drift too far away.
function spawnTrafficCar(nearX, nearY) {
  const vertical = rng() < 0.5;
  let x, y, tx, ty;
  if (vertical) {
    x = pickOne(ROADS_V);
    y = nearY !== undefined ? clamp(nearY + rand(-500, 500), 200, WORLD_H - 200) : rand(200, WORLD_H - 200);
    tx = x;
    ty = pickOne(ROADS_H);
  } else {
    x = nearX !== undefined ? clamp(nearX + rand(-500, 500), 200, WORLD_W - 200) : rand(200, WORLD_W - 200);
    y = pickOne(ROADS_H);
    tx = pickOne(ROADS_V);
    ty = y;
  }
  return {
    x, y, angle: angleTo(x, y, tx, ty), speed: rand(45, 75),
    tx, ty, vIdx: randInt(0, 6), color: pickOne(['#8a94a6', '#b0b8c4', '#5a6a7a', '#a67a4f', '#6a8a5a', '#7a5a8a']),
    stopped: false,
  };
}
for (let i = 0; i < 18; i++) traffic.push(spawnTrafficCar());

// Pedestrians: 27 people walking the sidewalks, standing, or crossing.
const PED_COLORS = ['#c9a24f', '#7a9ac9', '#c97a8a', '#8ac97a', '#b0a090', '#9a7ac9', '#c9c9c9'];
for (let i = 0; i < 27; i++) {
  const onV = rng() < 0.5;
  const px = onV ? pickOne(ROADS_V) + (rng() < 0.5 ? -58 : 58) : rand(200, WORLD_W - 200);
  const py = onV ? rand(200, WORLD_H - 200) : pickOne(ROADS_H) + (rng() < 0.5 ? -58 : 58);
  peds.push({
    x: px, y: py, angle: rand(0, TAU), speed: rand(28, 55),
    state: rng() < 0.25 ? 'stand' : 'walk',
    tx: px, ty: py, pause: rand(0, 4), fleeT: 0,
    color: pickOne(PED_COLORS), size: rand(9, 12),
  });
}

// --- Save and load ----------------------------------------------------------
function saveGame() {
  try {
    const data = {
      cash: player.cash, rep: player.rep,
      missionStates, missionIndex, missionStep,
      px: player.x, py: player.y, health: player.health, armor: player.armor,
      weapon: player.weapon, owned: player.owned, ammo: player.ammo,
      speedTune: player.speedTune,
      cachesTaken: caches.map(c => c.taken),
      settings, timeOfDay, weather,
      gameComplete,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    notify('Game saved.');
  } catch (e) {
    notify('Save failed — storage is unavailable.');
  }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function hasSave() { return loadSave() !== null; }

function applySave(data) {
  player.cash = data.cash; player.rep = data.rep;
  for (let i = 0; i < MISSIONS.length; i++) missionStates[i] = data.missionStates[i];
  missionIndex = data.missionIndex; missionStep = data.missionStep;
  player.x = data.px; player.y = data.py;
  player.health = data.health; player.armor = data.armor;
  player.weapon = data.weapon; player.owned = data.owned; player.ammo = data.ammo;
  player.speedTune = data.speedTune || 0;
  for (let i = 0; i < caches.length; i++) caches[i].taken = !!data.cachesTaken[i];
  settings = data.settings || settings;
  timeOfDay = data.timeOfDay || 18;
  weather = data.weather || 'clear';
  gameComplete = !!data.gameComplete;
  player.onFoot = true; player.vehicle = null;
  wanted = 0;
  policeCars.length = 0; policeFoot.length = 0; enemies.length = 0;
}

// --- Input ------------------------------------------------------------------
const keys = {};
const mouse = { x: viewW / 2, y: viewH / 2, down: false, aim: false };

function isNight() { return timeOfDay >= 20 || timeOfDay < 6; }

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  ensureAudio();
  handleKeyPress(e.code);
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = e.clientX - r.left;
  mouse.y = e.clientY - r.top;
});
canvas.addEventListener('mousedown', (e) => {
  ensureAudio();
  if (e.button === 0) {
    mouse.down = true;
    if (phase !== 'playing') clickMenu(mouse.x, mouse.y);
    else advanceDialogue();
  }
  if (e.button === 2) mouse.aim = true;
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.down = false;
  if (e.button === 2) mouse.aim = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function advanceDialogue() {
  if (dialogue.length > 0) {
    dialogue.shift();
    dialogueTimer = dialogue.length > 0 ? 5 : 0;
  }
}

// Menu definitions, rebuilt per phase so keyboard and mouse share them.
function menuItems() {
  if (phase === 'title') {
    const items = [{ label: 'NEW GAME', act: 'new' }];
    if (hasSave()) items.push({ label: 'CONTINUE', act: 'continue' });
    items.push({ label: 'SETTINGS', act: 'settings' });
    items.push({ label: 'CONTROLS', act: 'controls' });
    return items;
  }
  if (phase === 'paused') {
    return [
      { label: 'RESUME', act: 'resume' },
      { label: 'CITY MAP', act: 'map' },
      { label: 'MISSIONS', act: 'journal' },
      { label: 'CONTROLS', act: 'controls' },
      { label: 'SETTINGS', act: 'settings' },
      { label: 'SAVE GAME', act: 'save' },
      { label: 'QUIT TO MENU', act: 'quit' },
    ];
  }
  return [];
}

function runMenuAction(act) {
  if (act === 'new') { startNewGame(); return; }
  if (act === 'continue') {
    const data = loadSave();
    if (data) { applySave(data); phase = 'playing'; notify('Welcome back, Jace.'); }
    return;
  }
  if (act === 'resume') { phase = 'playing'; return; }
  if (act === 'map') { prevPhase = phase; phase = 'map'; return; }
  if (act === 'journal') { prevPhase = phase; phase = 'journal'; return; }
  if (act === 'controls') { prevPhase = phase; phase = 'controls'; return; }
  if (act === 'settings') { prevPhase = phase; phase = 'settings'; return; }
  if (act === 'save') { saveGame(); return; }
  if (act === 'quit') { phase = 'title'; menuIndex = 0; return; }
}

function handleKeyPress(code) {
  // Global toggles that work in the playing phase.
  if (phase === 'playing') {
    if (code === 'Escape') { phase = 'paused'; menuIndex = 0; return; }
    if (code === 'KeyM') { prevPhase = 'playing'; phase = 'map'; return; }
    if (code === 'KeyJ') { prevPhase = 'playing'; phase = 'journal'; return; }
    if (code === 'KeyH') { headlights = !headlights; notify(headlights ? 'Headlights on.' : 'Headlights off.'); return; }
    if (code === 'Digit0') { settings.muted = !settings.muted; if (masterGain) masterGain.gain.value = settings.muted ? 0 : 0.5; notify(settings.muted ? 'Sound muted.' : 'Sound on.'); return; }
    if (code === 'KeyE') { tryInteract(); return; }
    if (code === 'KeyR') { startReload(); return; }
    if (code === 'KeyQ') { cycleWeapon(); return; }
    if (code.startsWith('Digit')) {
      const n = parseInt(code.slice(5), 10) - 1;
      if (n >= 0 && n < WEAPONS.length && player.owned[n]) { player.weapon = n; playBlip(520); }
      return;
    }
    return;
  }
  // Menu phases.
  if (phase === 'title' || phase === 'paused') {
    const items = menuItems();
    if (code === 'ArrowUp' || code === 'KeyW') menuIndex = (menuIndex - 1 + items.length) % items.length;
    if (code === 'ArrowDown' || code === 'KeyS') menuIndex = (menuIndex + 1) % items.length;
    if (code === 'Enter' || code === 'Space') runMenuAction(items[menuIndex].act);
    if (code === 'Escape' && phase === 'paused') phase = 'playing';
    return;
  }
  if (phase === 'map' || phase === 'journal' || phase === 'controls') {
    if (code === 'Escape' || code === 'KeyM' || code === 'KeyJ') phase = prevPhase === 'title' ? 'paused' : prevPhase;
    return;
  }
  if (phase === 'settings') {
    if (code === 'Escape') { phase = prevPhase === 'title' ? 'title' : 'paused'; return; }
    if (code === 'ArrowUp' || code === 'KeyW') settingsSel = (settingsSel - 1 + 3) % 3;
    if (code === 'ArrowDown' || code === 'KeyS') settingsSel = (settingsSel + 1) % 3;
    if (code === 'Enter' || code === 'Space' || code === 'ArrowLeft' || code === 'ArrowRight') {
      if (settingsSel === 0) { settings.muted = !settings.muted; if (masterGain) masterGain.gain.value = settings.muted ? 0 : 0.5; }
      if (settingsSel === 1) settings.showMinimap = !settings.showMinimap;
      if (settingsSel === 2) settings.weatherAuto = !settings.weatherAuto;
      playBlip(520);
    }
    return;
  }
  if (phase === 'shop') {
    if (code === 'Escape') { phase = 'playing'; return; }
    if (code === 'Digit1') buyShop(0);
    if (code === 'Digit2') buyShop(1);
    if (code === 'Digit3') buyShop(2);
    if (code === 'Digit4') buyShop(3);
    if (code === 'Digit5') buyShop(4);
    return;
  }
}

function clickMenu(mx, my) {
  for (const b of menuButtons) {
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
      runMenuAction(b.act);
      return;
    }
  }
}

function startNewGame() {
  player.x = 1350; player.y = 900; player.angle = 0;
  player.health = 100; player.armor = 0; player.cash = 200; player.rep = 0;
  player.onFoot = true; player.vehicle = null; player.weapon = 0;
  player.owned = [true, false, false, false, false];
  player.ammo = WEAPONS.map((w, i) => ({ mag: w.mag, reserve: i === 0 ? w.reserve : 0 }));
  player.speedTune = 0;
  for (let i = 0; i < MISSIONS.length; i++) missionStates[i] = i === 0 ? 'AVAILABLE' : 'LOCKED';
  missionIndex = 0; missionStep = 0; missionKills = 0; gameComplete = false;
  wanted = 0; policeCars.length = 0; policeFoot.length = 0; enemies.length = 0;
  for (const c of caches) c.taken = false;
  race = null; courier = null; ally = null;
  timeOfDay = 18.0; weather = 'clear';
  phase = 'playing';
  say('Mara Venn', 'Jace. You came back. Rook is gone, and every crew in Vespera wants what he left behind.');
  say('Mara Venn', 'Meet me at the Neon Arcade in the Market district. Bring a car if you can find one.');
  notify('Mission available: BACK IN THE CITY');
}

// --- Audio (all synthesized locally with WebAudio; no files, no network) -----
let audioCtx = null;
let masterGain = null;
let sirenNodes = null;
let engineNodes = null;
let musicTimer = null;
let musicStep = 0;

function ensureAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = settings.muted ? 0 : 0.5;
    masterGain.connect(audioCtx.destination);
    startSirenLoop();
    startEngineLoop();
    startMusicLoop();
  } catch (e) {
    audioCtx = null;
  }
}

function noiseBuffer(dur) {
  const len = Math.floor(audioCtx.sampleRate * dur);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playTone(freq, dur, type, vol, slideTo) {
  if (!audioCtx || settings.muted) return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.15, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(masterGain);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) { /* audio is best-effort */ }
}

function playNoise(dur, filterFreq, vol) {
  if (!audioCtx || settings.muted) return;
  try {
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const f = audioCtx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol || 0.25, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(masterGain);
    src.start();
  } catch (e) { /* audio is best-effort */ }
}

function playBlip(freq) { playTone(freq || 660, 0.08, 'square', 0.08); }
function playGunshot(kind) {
  if (kind === 'shotgun') playNoise(0.28, 900, 0.5);
  else if (kind === 'rifle') playNoise(0.22, 1600, 0.42);
  else if (kind === 'smg') playNoise(0.09, 1800, 0.28);
  else playNoise(0.14, 1400, 0.35);
  playTone(140, 0.08, 'square', 0.12, 60);
}
function playStinger() {
  playTone(523, 0.12, 'triangle', 0.16);
  setTimeout(() => playTone(659, 0.12, 'triangle', 0.16), 110);
  setTimeout(() => playTone(784, 0.3, 'triangle', 0.18), 220);
}
function playCrash() { playNoise(0.25, 500, 0.4); }

function startSirenLoop() {
  try {
    const o = audioCtx.createOscillator();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    const g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = 800;
    lfo.type = 'square'; lfo.frequency.value = 0.9;
    lfoGain.gain.value = 260;
    g.gain.value = 0;
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    o.connect(g); g.connect(masterGain);
    o.start(); lfo.start();
    sirenNodes = { gain: g };
  } catch (e) { sirenNodes = null; }
}

function startEngineLoop() {
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 55;
    g.gain.value = 0;
    const f = audioCtx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 320;
    o.connect(f); f.connect(g); g.connect(masterGain);
    o.start();
    engineNodes = { osc: o, gain: g };
  } catch (e) { engineNodes = null; }
}

// A quiet two-bar bass loop with a soft hat, scheduled on a timer.
const MUSIC_BASS = [55, 0, 55, 65.4, 0, 55, 49, 58.3, 55, 0, 55, 65.4, 73.4, 0, 65.4, 49];
function startMusicLoop() {
  if (musicTimer) return;
  musicTimer = setInterval(() => {
    if (!audioCtx || settings.muted || phase !== 'playing') return;
    const f = MUSIC_BASS[musicStep % MUSIC_BASS.length];
    if (f > 0) playTone(f, 0.22, 'triangle', 0.05);
    if (musicStep % 2 === 0) playNoise(0.03, 6000, 0.02);
    musicStep++;
  }, 240);
}

// --- Combat -----------------------------------------------------------------
let gameTime = 0;
let shootQueued = false;
let holdProgress = 0;
let scare = null; // { x, y, t } — gunshots and crashes send pedestrians fleeing

function mouseWorld() {
  return {
    x: cam.x + (mouse.x - viewW / 2) / cam.zoom,
    y: cam.y + (mouse.y - viewH / 2) / cam.zoom,
  };
}

function startReload() {
  const w = WEAPONS[player.weapon];
  const a = player.ammo[player.weapon];
  if (player.reloadTimer > 0 || a.mag >= w.mag || a.reserve <= 0) return;
  player.reloadTimer = 1.1;
  player.reloadTotal = 1.1;
  playTone(300, 0.08, 'square', 0.08);
}

function cycleWeapon() {
  for (let i = 1; i <= WEAPONS.length; i++) {
    const n = (player.weapon + i) % WEAPONS.length;
    if (player.owned[n]) { player.weapon = n; playBlip(520); return; }
  }
}

function fireWeapon() {
  const w = WEAPONS[player.weapon];
  const a = player.ammo[player.weapon];
  if (player.fireCd > 0 || player.reloadTimer > 0) return;
  if (a.mag <= 0) { playTone(180, 0.05, 'square', 0.06); startReload(); return; }
  player.fireCd = w.rate;
  a.mag--;
  const mx = player.x + Math.cos(player.aimAngle) * 22;
  const my = player.y + Math.sin(player.aimAngle) * 22;
  for (let i = 0; i < w.pellets; i++) {
    const spread = (Math.random() - 0.5) * 2 * w.spread;
    bullets.push({
      x: mx, y: my, angle: player.aimAngle + spread,
      speed: 950, dmg: w.dmg, range: w.range, from: 'player',
    });
  }
  parts.push({ x: mx, y: my, vx: 0, vy: 0, life: 0.08, max: 0.08, size: 14, color: '#ffd76a', kind: 'flash' });
  playGunshot(w.kind);
  scare = { x: player.x, y: player.y, t: 1.5 };
  if (wanted < 1) raiseWanted(1);
  if (a.mag === 0) player.reloadTimer = 0.4;
}

function damagePlayer(dmg) {
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, dmg * 0.6);
    player.armor -= absorbed;
    dmg -= absorbed;
  }
  player.health -= dmg;
  if (player.health <= 0) {
    player.health = 0;
    onPlayerDown();
  }
}

function onPlayerDown() {
  const lost = Math.floor(player.cash * 0.1);
  player.cash -= lost;
  player.health = 100;
  player.armor = 0;
  player.x = GARAGE.x; player.y = GARAGE.y + 60;
  if (player.vehicle) { player.vehicle = null; player.onFoot = true; }
  wanted = 0;
  policeCars.length = 0; policeFoot.length = 0; enemies.length = 0;
  failMission('You were taken down. Nia patched you up at the garage.');
  notify('You lost ' + fmtCash(lost) + ' to the hospital bill.');
  say('Nia Cross', 'Easy, Jace. You are alive. That is what counts. Get back out there.');
}

// --- Wanted -----------------------------------------------------------------
function raiseWanted(n) {
  const before = wanted;
  wanted = clamp(wanted + n, 0, 5);
  if (wanted > before) {
    wantedDecayTimer = 0;
    if (wanted >= 3) notify('Wanted level ' + wanted + ' — the whole city is looking for you.');
  }
}

// --- Interaction (E key) ----------------------------------------------------
function tryInteract() {
  if (dialogue.length > 0) { advanceDialogue(); return; }
  // Garage / shop.
  if (dist2d(player.x, player.y, GARAGE.x, GARAGE.y) < 90) { phase = 'shop'; playBlip(660); return; }
  // Street race.
  if (dist2d(player.x, player.y, RACE_START.x, RACE_START.y) < 80 && !race) {
    race = { gate: 0, timer: 120 };
    notify('Street race started — hit all 3 gates in 120 seconds.');
    playBlip(780);
    return;
  }
  // Courier pickup.
  if (courier && courier.state === 'pickup' && dist2d(player.x, player.y, courier.px, courier.py) < 80) {
    courier.state = 'deliver';
    courier.timer = 60;
    notify('Package collected — deliver it before the clock runs out.');
    return;
  }
  // Start the available mission by reaching its first marker.
  const mState = missionStates[missionIndex];
  if (mState === 'AVAILABLE') {
    const first = MISSIONS[missionIndex].steps[0];
    if (dist2d(player.x, player.y, first.x, first.y) < 95) {
      startMission(missionIndex);
      return;
    }
  }
  // Enter or exit a vehicle.
  if (player.onFoot) {
    let best = null, bestD = 60;
    for (const p of parkedCars) {
      const d = dist2d(player.x, player.y, p.x, p.y);
      if (d < bestD) { best = p; bestD = d; }
    }
    if (best) { enterParkedCar(best); return; }
    for (const t of traffic) {
      const d = dist2d(player.x, player.y, t.x, t.y);
      if (d < 55) { stealTrafficCar(t); return; }
    }
    for (const pc of policeCars) {
      const d = dist2d(player.x, player.y, pc.x, pc.y);
      if (d < 55) { stealPoliceCar(pc); return; }
    }
  } else {
    exitVehicle();
  }
}

function enterParkedCar(p) {
  const idx = parkedCars.indexOf(p);
  if (idx >= 0) parkedCars.splice(idx, 1);
  player.vehicle = { vIdx: p.vIdx, x: p.x, y: p.y, angle: p.angle, speed: 0, hp: p.hp, missionVan: !!p.missionVan };
  player.onFoot = false;
  playTone(220, 0.1, 'square', 0.08, 160);
  notify('Driving the ' + VEHICLES[p.vIdx].name + '.');
}

function stealTrafficCar(t) {
  const idx = traffic.indexOf(t);
  if (idx >= 0) traffic.splice(idx, 1);
  player.vehicle = { vIdx: t.vIdx, x: t.x, y: t.y, angle: t.angle, speed: 0, hp: 100, missionVan: false };
  player.onFoot = false;
  raiseWanted(1);
  notify('Vehicle stolen — someone called the police.');
  playTone(180, 0.2, 'sawtooth', 0.1, 90);
}

function stealPoliceCar(pc) {
  const idx = policeCars.indexOf(pc);
  if (idx >= 0) policeCars.splice(idx, 1);
  player.vehicle = { vIdx: 8, x: pc.x, y: pc.y, angle: pc.angle, speed: 0, hp: pc.hp, missionVan: false };
  player.onFoot = false;
  raiseWanted(2);
  notify('You stole a police cruiser. That was bold.');
}

function exitVehicle() {
  if (!player.vehicle) return;
  const v = player.vehicle;
  player.x = v.x + Math.cos(v.angle + Math.PI / 2) * 30;
  player.y = v.y + Math.sin(v.angle + Math.PI / 2) * 30;
  player.angle = v.angle;
  parkedCars.push({ x: v.x, y: v.y, angle: v.angle, vIdx: v.vIdx, hp: v.hp, missionVan: !!v.missionVan });
  player.vehicle = null;
  player.onFoot = true;
  player.speed = 0;
}

// --- Missions engine --------------------------------------------------------
function currentMission() { return MISSIONS[missionIndex]; }
function currentStep() {
  const m = currentMission();
  if (!m || missionStep >= m.steps.length) return null;
  return m.steps[missionStep];
}

function startMission(i) {
  missionIndex = i;
  missionStep = 0;
  missionKills = 0;
  missionTimer = 0;
  holdProgress = 0;
  missionStates[i] = 'ACTIVE';
  const m = MISSIONS[i];
  say(m.giver, m.brief);
  notify('Mission started: ' + m.title);
  playBlip(700);
  setupStep(currentStep());
}

function setupStep(step) {
  if (!step) return;
  if (step.kind === 'goto' && step.seconds) missionTimer = step.seconds;
  if (step.kind === 'defeat') {
    for (let k = 0; k < step.count; k++) {
      spawnEnemy(step.x + rand(-160, 160), step.y + rand(-160, 160));
    }
  }
  if (step.kind === 'escape') raiseWanted(Math.max(0, 3 - wanted));
  // NIGHT SHIFT: the warehouse is guarded while you search it.
  if (missionIndex === 3 && step.kind === 'interact') {
    spawnEnemy(step.x + 120, step.y - 60);
    spawnEnemy(step.x - 120, step.y + 80);
  }
  // OLD DEBTS: rivals move in once the escort begins.
  if (missionIndex === 6 && step.kind === 'goto' && missionStep === 2) {
    for (let k = 0; k < 3; k++) spawnEnemy(player.x + rand(-220, 220), player.y + rand(-220, 220));
  }
  // DISTRICT ZERO finale: the plaza is held.
  if (missionIndex === 7 && step.kind === 'defeat') {
    for (let k = 0; k < 2; k++) spawnEnemy(step.x + rand(-200, 200), step.y + rand(-200, 200));
  }
}

function advanceStep() {
  missionStep++;
  missionKills = 0;
  holdProgress = 0;
  const m = currentMission();
  if (missionStep >= m.steps.length) completeMission();
  else setupStep(currentStep());
}

function completeMission() {
  const m = currentMission();
  let payout = m.payout;
  if (missionIndex === 2 && wanted > 0) {
    payout = Math.floor(payout / 2);
    notify('Delivered hot — the police were on you. Payout halved.');
  }
  player.cash += payout;
  player.rep += m.rep;
  missionStates[missionIndex] = 'COMPLETED';
  playStinger();
  notify('Mission complete: ' + m.title + ' — +' + fmtCash(payout) + ', +' + m.rep + ' rep.');
  say(m.giver, missionIndex === 7
    ? 'It is done, Jace. District Zero is yours. Rook would be proud.'
    : 'Good work. That is one more piece of Rook\u2019s trail in our hands.');
  if (missionIndex + 1 < MISSIONS.length) {
    missionIndex++;
    missionStates[missionIndex] = 'AVAILABLE';
    missionStep = 0;
    notify('New mission available: ' + MISSIONS[missionIndex].title);
  } else {
    gameComplete = true;
    notify('DISTRICT ZERO — the city is yours.');
  }
}

function failMission(reason) {
  const m = currentMission();
  if (missionStates[missionIndex] === 'ACTIVE') {
    missionStates[missionIndex] = 'AVAILABLE';
    missionStep = 0;
    missionKills = 0;
    holdProgress = 0;
    missionFailedNote = reason;
    notify('Mission failed: ' + m.title + ' — ' + reason + ' (you can retry it).');
  }
}

function spawnEnemy(x, y) {
  enemies.push({
    x: clamp(x, 60, WORLD_W - 60), y: clamp(y, 60, WORLD_H - 60),
    angle: rand(0, TAU), hp: 60, state: 'patrol',
    shootCd: rand(0.6, 1.4), tx: x, ty: y, speed: 100, pause: 0,
  });
}

function updateMissions(dt) {
  if (missionStates[missionIndex] !== 'ACTIVE') return;
  const step = currentStep();
  if (!step) return;
  const d = dist2d(player.x, player.y, step.x, step.y);
  if (step.kind === 'goto') {
    if (step.seconds) {
      missionTimer -= dt;
      if (missionTimer <= 0) { failMission('Out of time.'); return; }
    }
    if (d < 70) advanceStep();
  } else if (step.kind === 'interact') {
    if (d < 85 && keys['KeyE']) {
      holdProgress += dt;
      if (holdProgress >= (step.hold || 1)) {
        if (missionIndex === 6 && missionStep === 1 && !ally) {
          ally = { x: step.x + 30, y: step.y + 30, hp: 100 };
          say('Ally', 'You came. Let us move — they are already looking for us.');
        }
        advanceStep();
      }
    } else {
      holdProgress = Math.max(0, holdProgress - dt * 2);
    }
  } else if (step.kind === 'enter') {
    if (!player.onFoot && player.vehicle) {
      // Any vehicle of the required kind counts; for the cargo run any van
      // will do, and the marker van is the obvious one to take.
      if (!step.vehicle || step.vehicle === 'any' || VEHICLES[player.vehicle.vIdx].kind === step.vehicle) {
        advanceStep();
      }
    }
  } else if (step.kind === 'deliver') {
    if (!player.onFoot && player.vehicle && d < 85) {
      if (!step.vehicle || step.vehicle === 'any' || VEHICLES[player.vehicle.vIdx].kind === step.vehicle) advanceStep();
    }
  } else if (step.kind === 'survive') {
    missionTimer -= dt;
    if (missionTimer <= 0) advanceStep();
  } else if (step.kind === 'defeat') {
    if (missionKills >= step.count) advanceStep();
  } else if (step.kind === 'escape') {
    if (wanted === 0) advanceStep();
  }
}

// --- Garage shop ------------------------------------------------------------
function buyShop(i) {
  if (i === 4) {
    const next = WEAPONS.findIndex((w, idx) => !player.owned[idx]);
    if (next < 0) { notify('You own every weapon.'); return; }
    const price = WEAPONS[next].price;
    if (player.cash < price) { notify('Not enough cash for the ' + WEAPONS[next].name + '.'); return; }
    player.cash -= price;
    player.owned[next] = true;
    player.ammo[next].reserve = WEAPONS[next].reserve;
    notify('Bought the ' + WEAPONS[next].name + '. Press ' + (next + 1) + ' to use it.');
    playBlip(760);
    return;
  }
  const item = SHOP_ITEMS[i];
  if (!item) return;
  if (player.cash < item.price) { notify('Not enough cash.'); return; }
  if (i === 0) {
    if (player.armor >= 100) { notify('Armor is already full.'); return; }
    player.cash -= item.price; player.armor = 100;
    notify('Armor fitted. You are covered.');
  } else if (i === 1) {
    const w = WEAPONS[player.weapon];
    const a = player.ammo[player.weapon];
    if (a.reserve >= w.reserve) { notify('Ammo is already full.'); return; }
    player.cash -= item.price; a.reserve = w.reserve;
    notify('Ammo restocked for the ' + w.name + '.');
  } else if (i === 2) {
    if (!player.vehicle) { notify('You need to be in a vehicle to repair it.'); return; }
    if (player.vehicle.hp >= VEHICLES[player.vehicle.vIdx].hp) { notify('The vehicle is already in good shape.'); return; }
    player.cash -= item.price; player.vehicle.hp = VEHICLES[player.vehicle.vIdx].hp;
    notify('Vehicle repaired.');
  } else if (i === 3) {
    if (player.speedTune >= 3) { notify('The engine is already maxed out.'); return; }
    player.cash -= item.price; player.speedTune++;
    notify('Engine tuned. Top speed up.');
  }
  playBlip(700);
}

// --- Per-frame updates ------------------------------------------------------
function updatePlayer(dt) {
  player.fireCd = Math.max(0, player.fireCd - dt);
  player.hopCd = Math.max(0, player.hopCd - dt);
  if (player.hop > 0) player.hop = Math.max(0, player.hop - dt);
  if (player.reloadTimer > 0) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) {
      const w = WEAPONS[player.weapon];
      const a = player.ammo[player.weapon];
      const need = w.mag - a.mag;
      const take = Math.min(need, a.reserve);
      a.mag += take; a.reserve -= take;
      playTone(420, 0.07, 'square', 0.07);
    }
  }
  const mw = mouseWorld();
  player.aimAngle = angleTo(player.x, player.y, mw.x, mw.y);

  if (player.onFoot) {
    player.angle = player.aimAngle;
    let ix = 0, iy = 0;
    if (keys['KeyW'] || keys['ArrowUp']) iy -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) iy += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) ix += 1;
    const len = Math.hypot(ix, iy);
    if (len > 0) { ix /= len; iy /= len; }
    let spd = player.crouch ? 55 : 95;
    if (keys['ShiftLeft'] || keys['ShiftRight']) spd = 165;
    if (mouse.aim) spd *= 0.6;
    if (keys['Space'] && player.hopCd <= 0) {
      player.hop = 0.35; player.hopCd = 0.9; spd = 320;
      parts.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: 16, color: '#9ab0c9', kind: 'puff' });
    }
    player.crouch = !!keys['KeyC'];
    player.x += ix * spd * dt;
    player.y += iy * spd * dt;
    player.x = clamp(player.x, 24, WORLD_W - 24);
    player.y = clamp(player.y, 24, WORLD_H - 24);
    pushOutCircle(player, 12);
    if (shootQueued || (mouse.down && WEAPONS[player.weapon].auto)) fireWeapon();
    shootQueued = false;
  } else {
    const v = player.vehicle;
    const spec = VEHICLES[v.vIdx];
    const boost = (keys['ShiftLeft'] || keys['ShiftRight']) ? 1.35 : 1;
    const top = (spec.top + player.speedTune * 10) * boost;
    if (keys['KeyW'] || keys['ArrowUp']) v.speed += spec.accel * boost * dt * 2.2;
    else if (keys['KeyS'] || keys['ArrowDown']) v.speed -= spec.accel * dt * 2.6;
    else v.speed *= Math.max(0, 1 - 0.5 * dt);
    if (Math.abs(v.speed) < 2 && !(keys['KeyW'] || keys['KeyS'])) v.speed = 0;
    v.speed = clamp(v.speed, -top * 0.4, top);
    let steer = 0;
    if (keys['KeyA'] || keys['ArrowLeft']) steer -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) steer += 1;
    const steerAuthority = clamp(Math.abs(v.speed) / 70, 0, 1) * (v.speed >= 0 ? 1 : -1);
    v.angle += steer * spec.turn * steerAuthority * dt;
    const prevX = v.x, prevY = v.y;
    v.x += Math.cos(v.angle) * v.speed * dt;
    v.y += Math.sin(v.angle) * v.speed * dt;
    v.x = clamp(v.x, 24, WORLD_W - 24);
    v.y = clamp(v.y, 24, WORLD_H - 24);
    if (pushOutCircle(v, 17)) {
      if (Math.abs(v.speed) > 110) {
        v.hp -= 8;
        scare = { x: v.x, y: v.y, t: 1.2 };
        playCrash();
        for (let i = 0; i < 8; i++) parts.push({ x: v.x, y: v.y, vx: rand(-90, 90), vy: rand(-90, 90), life: 0.4, max: 0.4, size: 3, color: '#ffcf5a', kind: 'spark' });
      }
      v.speed *= 0.45;
    }
    // Nudge traffic cars out of the way.
    for (const t of traffic) {
      const d = dist2d(v.x, v.y, t.x, t.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const nx = (t.x - v.x) / d, ny = (t.y - v.y) / d;
        t.x += nx * push; t.y += ny * push;
        v.speed *= 0.85;
        if (Math.abs(v.speed) > 90) playCrash();
      }
    }
    player.x = v.x; player.y = v.y; player.angle = v.angle;
    player.speed = v.speed;
    if (shootQueued || (mouse.down && WEAPONS[player.weapon].auto)) fireWeapon();
    shootQueued = false;
    if (v.hp <= 0) {
      notify('Your ' + spec.name + ' is wrecked.');
      parkedCars.push({ x: v.x, y: v.y, angle: v.angle, vIdx: v.vIdx, hp: 0, taken: true });
      player.vehicle = null;
      player.onFoot = true;
      player.x = v.x + 30; player.y = v.y + 30;
      for (let i = 0; i < 14; i++) parts.push({ x: v.x, y: v.y, vx: rand(-120, 120), vy: rand(-120, 120), life: 0.7, max: 0.7, size: 5, color: '#5a5a5a', kind: 'smoke' });
    }
  }
  // Collectibles are picked up by walking or driving over them.
  for (const c of caches) {
    if (!c.taken && dist2d(player.x, player.y, c.x, c.y) < 32) {
      c.taken = true;
      player.cash += 250;
      notify('Found one of Rook\u2019s caches — +' + fmtCash(250) + '.');
      playBlip(880);
    }
  }
}

function carAheadOf(c) {
  const fx = Math.cos(c.angle), fy = Math.sin(c.angle);
  for (const o of traffic) {
    if (o === c) continue;
    const dx = o.x - c.x, dy = o.y - c.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < 72 && side < 26) return true;
  }
  if (!player.onFoot && player.vehicle) {
    const dx = player.vehicle.x - c.x, dy = player.vehicle.y - c.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < 72 && side < 26) return true;
  }
  return false;
}

function updateTraffic(dt) {
  for (let i = traffic.length - 1; i >= 0; i--) {
    const c = traffic[i];
    // Too far from the player: recycle it onto a road nearby.
    if (dist2d(c.x, c.y, player.x, player.y) > 1350) {
      traffic[i] = spawnTrafficCar(player.x, player.y);
      continue;
    }
    const want = carAheadOf(c) ? 0 : 62;
    c.speed = lerp(c.speed, want, Math.min(1, dt * 1.5));
    const targetAngle = angleTo(c.x, c.y, c.tx, c.ty);
    c.angle += clamp(angleDiff(c.angle, targetAngle), -2.2 * dt, 2.2 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    pushOutCircle(c, 15);
    if (dist2d(c.x, c.y, c.tx, c.ty) < 14) {
      // Arrived at an intersection: pick a neighbouring one.
      const options = [];
      if (c.tx + ROAD_GAP <= ROADS_V[ROADS_V.length - 1]) options.push([c.tx + ROAD_GAP, c.ty]);
      if (c.tx - ROAD_GAP >= ROADS_V[0]) options.push([c.tx - ROAD_GAP, c.ty]);
      if (c.ty + ROAD_GAP <= ROADS_H[ROADS_H.length - 1]) options.push([c.tx, c.ty + ROAD_GAP]);
      if (c.ty - ROAD_GAP >= ROADS_H[0]) options.push([c.tx, c.ty - ROAD_GAP]);
      if (options.length > 0) {
        const next = pickOne(options);
        c.tx = next[0]; c.ty = next[1];
      }
    }
  }
}

function updatePeds(dt) {
  for (const p of peds) {
    if (p.fleeT > 0) {
      p.fleeT -= dt;
      if (scare) {
        const a = angleTo(scare.x, scare.y, p.x, p.y);
        p.x += Math.cos(a) * 150 * dt;
        p.y += Math.sin(a) * 150 * dt;
      }
    } else if (p.state === 'walk') {
      const a = angleTo(p.x, p.y, p.tx, p.ty);
      p.angle = a;
      p.x += Math.cos(a) * p.speed * dt;
      p.y += Math.sin(a) * p.speed * dt;
      if (dist2d(p.x, p.y, p.tx, p.ty) < 12) {
        p.state = 'stand';
        p.pause = rand(2, 6);
      }
    } else {
      p.pause -= dt;
      if (p.pause <= 0) {
        const onV = rng() < 0.5;
        p.tx = onV ? pickOne(ROADS_V) + (rng() < 0.5 ? -58 : 58) : clamp(p.x + rand(-320, 320), 120, WORLD_W - 120);
        p.ty = onV ? clamp(p.y + rand(-320, 320), 120, WORLD_H - 120) : pickOne(ROADS_H) + (rng() < 0.5 ? -58 : 58);
        p.state = 'walk';
      }
    }
    p.x = clamp(p.x, 24, WORLD_W - 24);
    p.y = clamp(p.y, 24, WORLD_H - 24);
    pushOutCircle(p, p.size);
    if (scare && scare.t > 0 && dist2d(p.x, p.y, scare.x, scare.y) < 340 && p.fleeT <= 0) {
      p.fleeT = 2;
    }
  }
  if (scare) scare.t -= dt;
}

function spawnPoliceCar() {
  const a = Math.random() * TAU;
  const d = rand(360, 520);
  let x = clamp(player.x + Math.cos(a) * d, 120, WORLD_W - 120);
  let y = clamp(player.y + Math.sin(a) * d, 120, WORLD_H - 120);
  const nv = nearestRoadV(x), nh = nearestRoadH(y);
  if (Math.abs(x - nv) < Math.abs(y - nh)) x = nv; else y = nh;
  policeCars.push({ x, y, angle: angleTo(x, y, player.x, player.y), speed: 0, vIdx: 8, hp: 120 });
}

function spawnPoliceFoot() {
  const a = Math.random() * TAU;
  const d = rand(200, 320);
  policeFoot.push({
    x: clamp(player.x + Math.cos(a) * d, 60, WORLD_W - 60),
    y: clamp(player.y + Math.sin(a) * d, 60, WORLD_H - 60),
    angle: 0, hp: 50, shootCd: rand(0.8, 1.4),
  });
}

function updatePolice(dt) {
  const wantCars = Math.min(wanted, 5);
  const wantFoot = wanted >= 2 ? Math.min(wanted - 1, 3) : 0;
  while (policeCars.length < wantCars) spawnPoliceCar();
  while (policeFoot.length < wantFoot) spawnPoliceFoot();
  while (policeCars.length > wantCars) policeCars.pop();
  while (policeFoot.length > wantFoot) policeFoot.pop();

  for (const pc of policeCars) {
    const spec = VEHICLES[pc.vIdx];
    const desired = angleTo(pc.x, pc.y, player.x, player.y);
    pc.angle += clamp(angleDiff(pc.angle, desired), -2.6 * dt, 2.6 * dt);
    const targetSpeed = Math.min(spec.top * 0.94, dist2d(pc.x, pc.y, player.x, player.y) * 0.9 + 60);
    pc.speed = lerp(pc.speed, targetSpeed, Math.min(1, dt * 0.8));
    pc.x += Math.cos(pc.angle) * pc.speed * dt;
    pc.y += Math.sin(pc.angle) * pc.speed * dt;
    pc.x = clamp(pc.x, 24, WORLD_W - 24);
    pc.y = clamp(pc.y, 24, WORLD_H - 24);
    pushOutCircle(pc, 16);
    const d = dist2d(pc.x, pc.y, player.x, player.y);
    if (d < 46) {
      pc.speed *= 0.6;
      if (!player.onFoot && player.vehicle) {
        player.vehicle.hp -= 4;
        if (Math.random() < 0.3) playCrash();
      } else {
        damagePlayer(4);
      }
      for (let i = 0; i < 4; i++) parts.push({ x: player.x, y: player.y, vx: rand(-80, 80), vy: rand(-80, 80), life: 0.3, max: 0.3, size: 3, color: '#ffcf5a', kind: 'spark' });
    }
    if (d < 560 && !lineOfSightBlocked(pc.x, pc.y, player.x, player.y)) lastSeenAt = gameTime;
  }

  for (const pf of policeFoot) {
    const d = dist2d(pf.x, pf.y, player.x, player.y);
    if (d < 560 && !lineOfSightBlocked(pf.x, pf.y, player.x, player.y)) lastSeenAt = gameTime;
    if (d > 620) continue;
    const desired = angleTo(pf.x, pf.y, player.x, player.y);
    pf.angle = desired;
    if (d > 300) {
      pf.x += Math.cos(desired) * 122 * dt;
      pf.y += Math.sin(desired) * 122 * dt;
      pushOutCircle(pf, 11);
    } else {
      pf.shootCd -= dt;
      if (pf.shootCd <= 0 && !lineOfSightBlocked(pf.x, pf.y, player.x, player.y)) {
        pf.shootCd = rand(0.9, 1.4);
        const spread = (Math.random() - 0.5) * 0.28;
        bullets.push({ x: pf.x, y: pf.y, angle: desired + spread, speed: 820, dmg: 7, range: 420, from: 'police' });
        playGunshot('pistol');
      }
    }
  }
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.hp <= 0) {
      for (let k = 0; k < 10; k++) parts.push({ x: e.x, y: e.y, vx: rand(-110, 110), vy: rand(-110, 110), life: 0.5, max: 0.5, size: 4, color: '#b03030', kind: 'blood' });
      enemies.splice(i, 1);
      missionKills++;
      player.cash += 25;
      continue;
    }
    // Rivals go for the player, or for the escorted ally when closer.
    let tx = player.x, ty = player.y;
    if (ally && dist2d(e.x, e.y, ally.x, ally.y) < dist2d(e.x, e.y, player.x, player.y)) { tx = ally.x; ty = ally.y; }
    const d = dist2d(e.x, e.y, tx, ty);
    if (d < 480) {
      e.state = 'chase';
      if (d > 300) {
        const a = angleTo(e.x, e.y, tx, ty);
        e.angle = a;
        e.x += Math.cos(a) * e.speed * dt;
        e.y += Math.sin(a) * e.speed * dt;
        pushOutCircle(e, 11);
      } else {
        e.state = 'attack';
        e.angle = angleTo(e.x, e.y, tx, ty);
        e.shootCd -= dt;
        if (e.shootCd <= 0 && !lineOfSightBlocked(e.x, e.y, tx, ty)) {
          e.shootCd = rand(0.9, 1.5);
          const spread = (Math.random() - 0.5) * 0.26;
          bullets.push({ x: e.x, y: e.y, angle: e.angle + spread, speed: 800, dmg: 6, range: 400, from: 'enemy' });
          playGunshot('pistol');
        }
      }
    } else {
      e.state = 'patrol';
      e.pause -= dt;
      if (e.pause <= 0) {
        e.tx = clamp(e.x + rand(-260, 260), 80, WORLD_W - 80);
        e.ty = clamp(e.y + rand(-260, 260), 80, WORLD_H - 80);
        e.pause = rand(3, 6);
      }
      const a = angleTo(e.x, e.y, e.tx, e.ty);
      e.angle = a;
      e.x += Math.cos(a) * 55 * dt;
      e.y += Math.sin(a) * 55 * dt;
      pushOutCircle(e, 11);
    }
  }
  // The escorted ally trails the player.
  if (ally) {
    const d = dist2d(ally.x, ally.y, player.x, player.y);
    if (d > 70) {
      const a = angleTo(ally.x, ally.y, player.x, player.y);
      ally.x += Math.cos(a) * 145 * dt;
      ally.y += Math.sin(a) * 145 * dt;
      pushOutCircle(ally, 11);
    }
    if (ally.hp <= 0) {
      ally = null;
      failMission('Your ally did not make it.');
    }
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.range -= b.speed * dt;
    let dead = b.range <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H;
    if (!dead) {
      for (const s of solids) {
        if (pointInRect(b.x, b.y, s)) {
          dead = true;
          parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.15, max: 0.15, size: 4, color: '#ffcf5a', kind: 'spark' });
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (dist2d(b.x, b.y, e.x, e.y) < 15) {
          e.hp -= b.dmg;
          dead = true;
          parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: 4, color: '#b03030', kind: 'blood' });
          break;
        }
      }
      if (!dead) for (let pi = policeFoot.length - 1; pi >= 0; pi--) {
        const pf = policeFoot[pi];
        if (dist2d(b.x, b.y, pf.x, pf.y) < 15) {
          pf.hp -= b.dmg;
          dead = true;
          if (pf.hp <= 0) {
            policeFoot.splice(pi, 1);
            raiseWanted(1);
            notify('An officer is down — the heat just went up.');
          }
          break;
        }
      }
      if (!dead) for (let ci = policeCars.length - 1; ci >= 0; ci--) {
        const pc = policeCars[ci];
        if (dist2d(b.x, b.y, pc.x, pc.y) < 21) {
          pc.hp -= b.dmg;
          dead = true;
          parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, max: 0.2, size: 4, color: '#ffcf5a', kind: 'spark' });
          if (pc.hp <= 0) {
            for (let k = 0; k < 16; k++) parts.push({ x: pc.x, y: pc.y, vx: rand(-140, 140), vy: rand(-140, 140), life: 0.8, max: 0.8, size: 6, color: '#3a3a3a', kind: 'smoke' });
            policeCars.splice(ci, 1);
            raiseWanted(1);
          }
          break;
        }
      }
      if (!dead) for (const t of traffic) {
        if (dist2d(b.x, b.y, t.x, t.y) < 21) {
          dead = true;
          t.speed = 0;
          parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, max: 0.2, size: 4, color: '#ffcf5a', kind: 'spark' });
          break;
        }
      }
    }
    if (!dead && (b.from === 'enemy' || b.from === 'police')) {
      const pr = player.onFoot ? 13 : 20;
      if (dist2d(b.x, b.y, player.x, player.y) < pr) {
        dead = true;
        if (!player.onFoot && player.vehicle) {
          player.vehicle.hp -= b.dmg;
        } else {
          damagePlayer(b.dmg);
        }
      }
      if (!dead && ally && dist2d(b.x, b.y, ally.x, ally.y) < 13) {
        dead = true;
        ally.hp -= b.dmg;
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

function updateWanted(dt) {
  if (wanted <= 0) { wantedDecayTimer = 0; return; }
  if (gameTime - lastSeenAt > 5) {
    wantedDecayTimer += dt;
    if (wantedDecayTimer >= 5) {
      wanted--;
      wantedDecayTimer = 0;
      if (wanted > 0) notify('Wanted level falling — stay out of sight.');
      else notify('You lost them. The city moves on.');
    }
  } else {
    wantedDecayTimer = 0;
  }
}

function updateTasks(dt) {
  // Street race.
  if (race) {
    race.timer -= dt;
    const gate = RACE_GATES[race.gate];
    if (gate && dist2d(player.x, player.y, gate.x, gate.y) < 70) {
      race.gate++;
      playBlip(880);
      notify(race.gate >= RACE_GATES.length ? 'Final gate!' : 'Gate ' + race.gate + ' of 3 — keep going.');
    }
    if (race.gate >= RACE_GATES.length) {
      player.cash += 1000;
      notify('Race won — +' + fmtCash(1000) + '.');
      playStinger();
      race = null;
    } else if (race.timer <= 0) {
      notify('Race over — the clock beat you.');
      race = null;
    }
  }
  // Courier jobs appear once the player has proven reliable.
  if (!courier) {
    courierCooldown -= dt;
    if (courierCooldown <= 0 && missionIndex >= 1) {
      const px = pickOne(ROADS_V), py = pickOne(ROADS_H);
      const dx = pickOne(ROADS_V), dy = pickOne(ROADS_H);
      courier = { px, py, dx, dy, timer: 60, state: 'pickup' };
      notify('Courier job available — pick up the parcel (gold marker).');
    }
  } else if (courier.state === 'deliver') {
    courier.timer -= dt;
    if (dist2d(player.x, player.y, courier.dx, courier.dy) < 80) {
      player.cash += 300;
      notify('Parcel delivered — +' + fmtCash(300) + '.');
      playBlip(880);
      courier = null;
      courierCooldown = 30;
    } else if (courier.timer <= 0) {
      notify('Courier job failed — the parcel went to someone else.');
      courier = null;
      courierCooldown = 30;
    }
  }
}

function updateCamera(dt) {
  const targetZoom = clamp(Math.min(viewW, viewH) / 850, 0.55, 1.25);
  cam.zoom = lerp(cam.zoom, targetZoom, Math.min(1, dt * 3));
  if (phase === 'title') {
    cam.x += 26 * dt;
    if (cam.x > WORLD_W - 400) cam.x = 400;
    cam.y = 700;
  } else {
    const k = 1 - Math.pow(0.002, dt);
    cam.x = lerp(cam.x, player.x, k);
    cam.y = lerp(cam.y, player.y, k);
  }
  const halfW = viewW / 2 / cam.zoom, halfH = viewH / 2 / cam.zoom;
  cam.x = clamp(cam.x, halfW - 200, WORLD_W - halfW + 200);
  cam.y = clamp(cam.y, halfH - 200, WORLD_H - halfH + 200);
}

function updateClock(dt) {
  if (phase !== 'playing') return;
  timeOfDay += dt / 75;
  if (timeOfDay >= 24) timeOfDay -= 24;
  weatherTimer -= dt;
  if (weatherTimer <= 0) {
    weatherTimer = rand(35, 60);
    if (settings.weatherAuto) {
      const r = Math.random();
      weather = r < 0.5 ? 'clear' : (r < 0.8 ? 'cloudy' : 'rain');
    }
  }
  for (const drop of rainDrops) {
    drop.y += drop.s * dt;
    drop.x -= drop.s * 0.25 * dt;
    if (drop.y > viewH + 20) { drop.y = -20; drop.x = Math.random() * (viewW + 300); }
    if (drop.x < -20) drop.x = viewW + 20;
  }
  for (let i = notes.length - 1; i >= 0; i--) {
    notes[i].t -= dt;
    if (notes[i].t <= 0) notes.splice(i, 1);
  }
  if (dialogue.length > 0) {
    dialogueTimer -= dt;
    if (dialogueTimer <= 0) advanceDialogue();
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || 0) * dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
  // Siren and engine hum follow the action.
  if (sirenNodes) {
    let nearest = Infinity;
    for (const pc of policeCars) nearest = Math.min(nearest, dist2d(pc.x, pc.y, player.x, player.y));
    for (const pf of policeFoot) nearest = Math.min(nearest, dist2d(pf.x, pf.y, player.x, player.y));
    const vol = nearest === Infinity ? 0 : clamp(1 - nearest / 700, 0, 1) * 0.05;
    sirenNodes.gain.gain.value = settings.muted ? 0 : vol;
  }
  if (engineNodes) {
    const driving = !player.onFoot && player.vehicle;
    const spd = driving ? Math.abs(player.vehicle.speed) : 0;
    engineNodes.osc.frequency.value = 55 + spd * 0.55;
    engineNodes.gain.gain.value = settings.muted ? 0 : (driving ? 0.035 + spd / 6000 : 0);
  }
}

// --- Rendering --------------------------------------------------------------
function rr(x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function worldVisible(x, y, margin) {
  const m = margin || 80;
  const halfW = viewW / 2 / cam.zoom + m, halfH = viewH / 2 / cam.zoom + m;
  return x > cam.x - halfW && x < cam.x + halfW && y > cam.y - halfH && y < cam.y + halfH;
}

function drawWorld() {
  // District ground.
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 2; row++) {
      const d = DISTRICTS[row * 4 + col];
      ctx.fillStyle = d.tint;
      ctx.fillRect(col * 900, row * 1350, 900, 1350);
    }
  }
  // Blackwater Harbor: open water along the south-west edge.
  ctx.fillStyle = '#0e2431';
  ctx.fillRect(0, 1350, 150, 1350);
  ctx.strokeStyle = '#1d4256';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(150, 1350); ctx.lineTo(150, 2700);
  ctx.stroke();
  ctx.fillStyle = '#274b5e';
  for (let i = 0; i < 5; i++) ctx.fillRect(60, 1500 + i * 220, 90, 14);

  // Roads.
  ctx.fillStyle = '#171c24';
  for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const ry of ROADS_H) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = '#3d4a5c';
  for (const rx of ROADS_V) {
    for (let y = 0; y < WORLD_H; y += 60) ctx.fillRect(rx - 2, y, 4, 28);
  }
  for (const ry of ROADS_H) {
    for (let x = 0; x < WORLD_W; x += 60) ctx.fillRect(x, ry - 2, 28, 4);
  }
  // Sidewalks.
  ctx.strokeStyle = '#232a36';
  ctx.lineWidth = 8;
  for (const rx of ROADS_V) {
    ctx.beginPath(); ctx.moveTo(rx - ROAD_W / 2 - 4, 0); ctx.lineTo(rx - ROAD_W / 2 - 4, WORLD_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + ROAD_W / 2 + 4, 0); ctx.lineTo(rx + ROAD_W / 2 + 4, WORLD_H); ctx.stroke();
  }

  // Buildings.
  for (const b of buildings) {
    if (!worldVisible(b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(b.x, b.y, b.w, 5);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    if (isNight()) {
      ctx.fillStyle = '#ffd76a';
      for (const win of b.lit) ctx.fillRect(b.x + win.dx, b.y + win.dy, 6, 8);
    }
  }

  // Landmarks, drawn with their own silhouettes and labels.
  for (const lm of LANDMARKS) {
    if (!worldVisible(lm.x, lm.y, 200)) continue;
    const x = lm.x - lm.w / 2, y = lm.y - lm.h / 2;
    ctx.fillStyle = '#39445a';
    ctx.fillRect(x, y, lm.w, lm.h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, lm.w, 6);
    if (lm.kind === 'tower') {
      ctx.fillStyle = '#4a5a78';
      ctx.fillRect(x + lm.w / 2 - 14, y - 70, 28, 70);
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath(); ctx.arc(x + lm.w / 2, y - 74, 5, 0, TAU); ctx.fill();
      if (isNight()) {
        ctx.fillStyle = '#ffe9a8';
        for (let wy = y + 14; wy < y + lm.h - 10; wy += 22) {
          for (let wx = x + 12; wx < x + lm.w - 10; wx += 20) ctx.fillRect(wx, wy, 7, 9);
        }
      }
    }
    if (lm.kind === 'arcade' || lm.kind === 'market') {
      ctx.fillStyle = isNight() ? '#ff5ad0' : '#c94f9a';
      ctx.fillRect(x + 10, y + 8, lm.w - 20, 10);
      ctx.fillStyle = '#e0b13c';
      for (let sx = x + 16; sx < x + lm.w - 14; sx += 26) ctx.fillRect(sx, y + lm.h - 22, 12, 12);
    }
    if (lm.kind === 'factory') {
      ctx.fillStyle = '#4a3a30';
      ctx.fillRect(x + 16, y - 46, 18, 46);
      ctx.fillRect(x + 52, y - 60, 18, 60);
      ctx.fillStyle = 'rgba(200,200,200,0.25)';
      ctx.beginPath(); ctx.arc(x + 25, y - 58, 14, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 61, y - 74, 18, 0, TAU); ctx.fill();
    }
    if (lm.kind === 'harbor') {
      ctx.fillStyle = '#3a6a80';
      ctx.fillRect(x, y + lm.h - 18, lm.w, 18);
      ctx.fillStyle = '#c9a24f';
      ctx.fillRect(x + 20, y + 20, 30, 60);
      ctx.fillRect(x + 70, y + 20, 30, 60);
    }
    ctx.fillStyle = 'rgba(237,245,250,0.85)';
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lm.name.toUpperCase(), lm.x, y + lm.h + 18);
  }
}

function drawVehicleShape(x, y, angle, spec, color, lightsOn) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(-spec.len / 2 + 2, -spec.wid / 2 + 3, spec.len, spec.wid, 6);
  ctx.fill();
  ctx.fillStyle = '#101418';
  rr(-spec.len / 2 - 2, -spec.wid / 2 - 3, 10, 6, 2); ctx.fill();
  rr(-spec.len / 2 - 2, spec.wid / 2 - 3, 10, 6, 2); ctx.fill();
  rr(spec.len / 2 - 8, -spec.wid / 2 - 3, 10, 6, 2); ctx.fill();
  rr(spec.len / 2 - 8, spec.wid / 2 - 3, 10, 6, 2); ctx.fill();
  ctx.fillStyle = color;
  rr(-spec.len / 2, -spec.wid / 2, spec.len, spec.wid, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,44,0.9)';
  rr(-spec.len / 6, -spec.wid / 2 + 4, spec.len / 3, spec.wid - 8, 4);
  ctx.fill();
  if (spec.kind === 'police') {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-spec.len / 2 + 4, -spec.wid / 2, spec.len - 8, 5);
    ctx.fillStyle = '#2f6fd0';
    ctx.fillRect(-4, -spec.wid / 2 + 2, 8, 5);
    ctx.fillStyle = '#d03030';
    ctx.fillRect(-4, spec.wid / 2 - 7, 8, 5);
  }
  if (lightsOn) {
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(spec.len / 2 + 2, -spec.wid / 2 + 5, 3.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(spec.len / 2 + 2, spec.wid / 2 - 5, 3.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawEntities() {
  // Rook's caches.
  for (const c of caches) {
    if (c.taken || !worldVisible(c.x, c.y, 60)) continue;
    const pulse = 0.6 + 0.4 * Math.sin(gameTime * 3 + c.id);
    ctx.fillStyle = 'rgba(232,177,60,' + (0.25 + 0.2 * pulse) + ')';
    ctx.beginPath(); ctx.arc(c.x, c.y, 20 + 4 * pulse, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a6a2a';
    ctx.fillRect(c.x - 9, c.y - 7, 18, 14);
    ctx.fillStyle = '#e0b13c';
    ctx.fillRect(c.x - 9, c.y - 2, 18, 3);
  }
  // Parked cars.
  for (const p of parkedCars) {
    if (p.taken || !worldVisible(p.x, p.y, 60)) continue;
    drawVehicleShape(p.x, p.y, p.angle, VEHICLES[p.vIdx], VEHICLES[p.vIdx].color, false);
  }
  // Traffic.
  for (const t of traffic) {
    if (!worldVisible(t.x, t.y, 60)) continue;
    drawVehicleShape(t.x, t.y, t.angle, VEHICLES[t.vIdx], t.color, isNight());
  }
  // Pedestrians.
  for (const p of peds) {
    if (!worldVisible(p.x, p.y, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, p.size, p.size * 0.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, p.size * 0.45, 0, TAU); ctx.fill();
  }
  // Police cars and officers.
  for (const pc of policeCars) {
    if (!worldVisible(pc.x, pc.y, 60)) continue;
    drawVehicleShape(pc.x, pc.y, pc.angle, VEHICLES[pc.vIdx], VEHICLES[pc.vIdx].color, true);
    ctx.fillStyle = (Math.floor(gameTime * 2) % 2 === 0) ? '#3a7de0' : '#e03a3a';
    ctx.beginPath(); ctx.arc(pc.x, pc.y, 5, 0, TAU); ctx.fill();
  }
  for (const pf of policeFoot) {
    if (!worldVisible(pf.x, pf.y, 40)) continue;
    ctx.fillStyle = '#2b3a55';
    ctx.beginPath(); ctx.arc(pf.x, pf.y, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d8e2f0';
    ctx.beginPath(); ctx.arc(pf.x, pf.y, 5, 0, TAU); ctx.fill();
  }
  // Rival gang members.
  for (const e of enemies) {
    if (!worldVisible(e.x, e.y, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 4, 12, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a2f2f';
    ctx.beginPath(); ctx.arc(e.x, e.y, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8b13c';
    ctx.beginPath(); ctx.arc(e.x + Math.cos(e.angle) * 5, e.y + Math.sin(e.angle) * 5, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.fillRect(e.x - 12, e.y - 20, 24, 4);
    ctx.fillStyle = '#c03030';
    ctx.fillRect(e.x - 12, e.y - 20, 24 * clamp(e.hp / 60, 0, 1), 4);
  }
  // The escorted ally.
  if (ally) {
    ctx.fillStyle = '#2f8a4f';
    ctx.beginPath(); ctx.arc(ally.x, ally.y, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8f5e9';
    ctx.beginPath(); ctx.arc(ally.x, ally.y, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e0b13c';
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ALLY', ally.x, ally.y - 18);
  }
  // The player: on foot a figure with a facing tick, in a car the car itself.
  if (player.onFoot) {
    const hopLift = player.hop > 0 ? Math.sin((player.hop / 0.35) * Math.PI) * 8 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(player.x, player.y + 5, 12, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8b13c';
    ctx.beginPath(); ctx.arc(player.x, player.y - hopLift, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.beginPath(); ctx.arc(player.x + Math.cos(player.angle) * 5, player.y - hopLift + Math.sin(player.angle) * 5, 5, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e8b13c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(player.aimAngle) * 14, player.y - hopLift + Math.sin(player.aimAngle) * 14);
    ctx.lineTo(player.x + Math.cos(player.aimAngle) * 24, player.y - hopLift + Math.sin(player.aimAngle) * 24);
    ctx.stroke();
    // Health ring while hurt.
    if (player.health < 100) {
      ctx.strokeStyle = '#c03030';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(player.x, player.y - hopLift, 17, -Math.PI / 2, -Math.PI / 2 + TAU * (player.health / 100)); ctx.stroke();
    }
  } else if (player.vehicle) {
    const spec = VEHICLES[player.vehicle.vIdx];
    drawVehicleShape(player.vehicle.x, player.vehicle.y, player.vehicle.angle, spec, spec.color, isNight() || headlights);
    if (isNight() || headlights) {
      ctx.save();
      ctx.translate(player.vehicle.x, player.vehicle.y);
      ctx.rotate(player.vehicle.angle);
      const grad = ctx.createRadialGradient(spec.len / 2, 0, 4, spec.len / 2 + 90, 0, 130);
      grad.addColorStop(0, 'rgba(255,233,168,0.20)');
      grad.addColorStop(1, 'rgba(255,233,168,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(spec.len / 2, -14);
      ctx.lineTo(spec.len / 2 + 190, -70);
      ctx.lineTo(spec.len / 2 + 190, 70);
      ctx.lineTo(spec.len / 2, 14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (player.vehicle.hp < VEHICLES[player.vehicle.vIdx].hp * 0.5) {
      parts.push({ x: player.vehicle.x, y: player.vehicle.y, vx: rand(-8, 8), vy: rand(-30, -10), life: 0.5, max: 0.5, size: 6, color: '#5a5a5a', kind: 'smoke' });
    }
  }
  // Bullets.
  ctx.fillStyle = '#ffe9a8';
  for (const b of bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, TAU); ctx.fill();
  }
  // Particles.
  for (const p of parts) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    if (p.kind === 'flash') {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 4, 0, TAU); ctx.fill();
    } else if (p.kind === 'smoke' || p.kind === 'puff') {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - a), 0, TAU); ctx.fill();
    } else {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
}

// --- Markers, lighting, weather ---------------------------------------------
function drawMarkers() {
  const pulse = 0.6 + 0.4 * Math.sin(gameTime * 3.2);
  // Mission marker.
  const step = currentStep();
  if (missionStates[missionIndex] === 'ACTIVE' && step) {
    ctx.fillStyle = 'rgba(224,177,60,' + (0.25 + 0.25 * pulse) + ')';
    ctx.beginPath(); ctx.arc(step.x, step.y, 46 + 8 * pulse, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e0b13c';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(step.x, step.y, 26, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#e0b13c';
    ctx.beginPath();
    ctx.moveTo(step.x, step.y - 12);
    ctx.lineTo(step.x + 10, step.y + 8);
    ctx.lineTo(step.x - 10, step.y + 8);
    ctx.closePath();
    ctx.fill();
    // A guiding line from the player to the objective.
    ctx.strokeStyle = 'rgba(224,177,60,0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(step.x, step.y);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (missionStates[missionIndex] === 'AVAILABLE') {
    const first = MISSIONS[missionIndex].steps[0];
    ctx.strokeStyle = 'rgba(224,177,60,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(first.x, first.y, 30 + 6 * pulse, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#e0b13c';
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEW MISSION — press E', first.x, first.y - 40);
  }
  // Garage.
  ctx.fillStyle = '#4fc98a';
  ctx.beginPath(); ctx.arc(GARAGE.x, GARAGE.y, 8, 0, TAU); ctx.fill();
  ctx.font = '600 12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GARAGE', GARAGE.x, GARAGE.y - 16);
  // Race gates.
  if (race) {
    RACE_GATES.forEach((g, i) => {
      const done = i < race.gate;
      ctx.strokeStyle = done ? '#4fc98a' : (i === race.gate ? '#e0b13c' : '#5a6a7a');
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(g.x, g.y, 34, 0, TAU); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText('GATE ' + (i + 1), g.x, g.y - 42);
    });
  } else {
    ctx.strokeStyle = 'rgba(224,177,60,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(RACE_START.x, RACE_START.y, 26, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#e0b13c';
    ctx.fillText('RACE', RACE_START.x, RACE_START.y - 34);
  }
  // Courier.
  if (courier) {
    const cx = courier.state === 'pickup' ? courier.px : courier.dx;
    const cy = courier.state === 'pickup' ? courier.py : courier.dy;
    ctx.fillStyle = '#e0b13c';
    ctx.beginPath(); ctx.arc(cx, cy, 10 + 3 * pulse, 0, TAU); ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.fillText(courier.state === 'pickup' ? 'PICKUP' : 'DROP', cx, cy - 20);
  }
}

function drawNightAndWeather() {
  if (isNight()) {
    ctx.fillStyle = 'rgba(3,7,18,0.52)';
    ctx.fillRect(cam.x - viewW / 2 / cam.zoom - 40, cam.y - viewH / 2 / cam.zoom - 40, viewW / cam.zoom + 80, viewH / cam.zoom + 80);
    // Streetlights glow along the roads near the camera.
    ctx.fillStyle = 'rgba(255,214,120,0.16)';
    const step = 300;
    const x0 = Math.floor((cam.x - viewW / 2 / cam.zoom) / step) * step;
    const x1 = cam.x + viewW / 2 / cam.zoom;
    const y0 = Math.floor((cam.y - viewH / 2 / cam.zoom) / step) * step;
    const y1 = cam.y + viewH / 2 / cam.zoom;
    for (let gx = x0; gx <= x1; gx += step) {
      for (let gy = y0; gy <= y1; gy += step) {
        ctx.beginPath(); ctx.arc(gx, gy, 46, 0, TAU); ctx.fill();
      }
    }
  }
  // Cloudy skies and rain are drawn in screen space by drawWeatherOverlay.
}

// --- HUD and minimap ----------------------------------------------------------
function drawMinimap(px, py, size) {
  const s = size / WORLD_W;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, size, size * (WORLD_H / WORLD_W));
  ctx.clip();
  ctx.fillStyle = '#0a1220';
  ctx.fillRect(px, py, size, size * (WORLD_H / WORLD_W));
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 2; row++) {
      ctx.fillStyle = DISTRICTS[row * 4 + col].tint;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(px + col * 900 * s, py + row * 1350 * s, 900 * s, 1350 * s);
      ctx.globalAlpha = 1;
    }
  }
  ctx.fillStyle = '#0e2431';
  ctx.fillRect(px, py + 1350 * s, 150 * s, 1350 * s);
  ctx.strokeStyle = '#3a4a63';
  ctx.lineWidth = 1;
  for (const rx of ROADS_V) {
    ctx.beginPath(); ctx.moveTo(px + rx * s, py); ctx.lineTo(px + rx * s, py + WORLD_H * s); ctx.stroke();
  }
  for (const ry of ROADS_H) {
    ctx.beginPath(); ctx.moveTo(px, py + ry * s); ctx.lineTo(px + WORLD_W * s, py + ry * s); ctx.stroke();
  }
  for (const lm of LANDMARKS) {
    ctx.fillStyle = '#e0b13c';
    ctx.fillRect(px + lm.x * s - 1.5, py + lm.y * s - 1.5, 3, 3);
  }
  for (const c of caches) {
    if (c.taken) continue;
    if (dist2d(player.x, player.y, c.x, c.y) > 650) continue;
    ctx.fillStyle = '#4fc98a';
    ctx.beginPath(); ctx.arc(px + c.x * s, py + c.y * s, 2.5, 0, TAU); ctx.fill();
  }
  const step = currentStep();
  if (missionStates[missionIndex] === 'ACTIVE' && step) {
    ctx.fillStyle = '#e0b13c';
    ctx.beginPath(); ctx.arc(px + step.x * s, py + step.y * s, 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e0b13c';
    ctx.beginPath(); ctx.arc(px + step.x * s, py + step.y * s, 7, 0, TAU); ctx.stroke();
  }
  for (const pc of policeCars) {
    ctx.fillStyle = '#e03a3a';
    ctx.beginPath(); ctx.arc(px + pc.x * s, py + pc.y * s, 3, 0, TAU); ctx.fill();
  }
  // Player arrow.
  ctx.save();
  ctx.translate(px + player.x * s, py + player.y * s);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -4.5); ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(237,245,250,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, size, size * (WORLD_H / WORLD_W));
}

function drawHud() {
  if (!settings.showMinimap && phase === 'playing') {
    // Minimap hidden by settings: still show the rest of the HUD.
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Top-left: vitals, cash, reputation.
  ctx.fillStyle = 'rgba(8,13,22,0.72)';
  rr(14, 14, 250, 86, 8);
  ctx.fill();
  ctx.fillStyle = '#edf5fa';
  ctx.font = '700 15px Inter, system-ui, sans-serif';
  ctx.fillText('JACE MERCER', 26, 36);
  ctx.font = '500 12px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#9ab0c9';
  ctx.fillText(districtAt(player.x, player.y).name.toUpperCase() + '  ·  ' + formatClockTime(timeOfDay), 26, 54);
  // Health and armor bars.
  ctx.fillStyle = '#20242c';
  ctx.fillRect(26, 62, 120, 8);
  ctx.fillStyle = '#c03030';
  ctx.fillRect(26, 62, 120 * clamp(player.health / 100, 0, 1), 8);
  ctx.fillStyle = '#20242c';
  ctx.fillRect(26, 74, 120, 8);
  ctx.fillStyle = '#3a7de0';
  ctx.fillRect(26, 74, 120 * clamp(player.armor / 100, 0, 1), 8);
  ctx.fillStyle = '#e0b13c';
  ctx.font = '700 15px Inter, system-ui, sans-serif';
  ctx.fillText(fmtCash(player.cash), 158, 72);
  ctx.fillStyle = '#9ab0c9';
  ctx.font = '500 12px Inter, system-ui, sans-serif';
  ctx.fillText('REP ' + player.rep, 158, 88);

  // Top-right: wanted stars, then the minimap in its own clean panel.
  const panelW = 196, panelH = 196;
  const px = viewW - panelW - 14, py = 14;
  ctx.fillStyle = 'rgba(8,13,22,0.72)';
  rr(px, py, panelW, panelH, 8);
  ctx.fill();
  ctx.fillStyle = '#edf5fa';
  ctx.font = '700 13px Inter, system-ui, sans-serif';
  ctx.fillText('WANTED', px + 14, py + 22);
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < wanted ? '★' : '☆';
  ctx.fillStyle = wanted > 0 ? '#ffcf5a' : '#5a6a7a';
  ctx.font = '700 18px Inter, system-ui, sans-serif';
  ctx.fillText(stars, px + 84, py + 24);
  if (wanted > 0 && gameTime - lastSeenAt > 3) {
    ctx.fillStyle = '#7fae62';
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.fillText('HIDDEN — POLICE SEARCHING', px + 14, py + 42);
  }
  if (settings.showMinimap) {
    ctx.fillStyle = '#9ab0c9';
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.fillText('VESPERA — MAP', px + 14, py + 58);
    drawMinimap(px + 14, py + 64, 168);
  }

  // Bottom-left: weapon and ammo.
  const w = WEAPONS[player.weapon];
  const a = player.ammo[player.weapon];
  ctx.fillStyle = 'rgba(8,13,22,0.72)';
  rr(14, viewH - 64, 230, 50, 8);
  ctx.fill();
  ctx.fillStyle = '#edf5fa';
  ctx.font = '700 14px Inter, system-ui, sans-serif';
  ctx.fillText(w.name.toUpperCase(), 26, viewH - 42);
  ctx.font = '500 13px Inter, system-ui, sans-serif';
  ctx.fillStyle = player.reloadTimer > 0 ? '#e0b13c' : '#9ab0c9';
  ctx.fillText(player.reloadTimer > 0 ? 'RELOADING…' : (a.mag + ' / ' + a.reserve), 26, viewH - 24);
  ctx.fillStyle = '#5a6a7a';
  ctx.font = '500 11px Inter, system-ui, sans-serif';
  ctx.fillText('Q switch · R reload · 1-5 weapons', 130, viewH - 24);

  // Bottom-right: speed and vehicle.
  if (!player.onFoot && player.vehicle) {
    const spec = VEHICLES[player.vehicle.vIdx];
    ctx.fillStyle = 'rgba(8,13,22,0.72)';
    rr(viewW - 214, viewH - 64, 200, 50, 8);
    ctx.fill();
    ctx.fillStyle = '#edf5fa';
    ctx.font = '700 20px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(Math.abs(player.vehicle.speed) * 1.6) + ' km/h', viewW - 28, viewH - 38);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9ab0c9';
    ctx.font = '500 12px Inter, system-ui, sans-serif';
    ctx.fillText(spec.name.toUpperCase(), viewW - 200, viewH - 24);
    ctx.fillStyle = '#c03030';
    ctx.fillRect(viewW - 200, viewH - 56, 60 * clamp(player.vehicle.hp / spec.hp, 0, 1), 4);
  }

  // Bottom-centre: current objective.
  const step = currentStep();
  if (missionStates[missionIndex] === 'ACTIVE' && step) {
    ctx.font = '600 14px Inter, system-ui, sans-serif';
    const label = currentMission().title + ' — ' + step.label;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(8,13,22,0.72)';
    rr(viewW / 2 - tw / 2 - 16, viewH - 108, tw + 32, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#e0b13c';
    ctx.textAlign = 'center';
    ctx.fillText(label, viewW / 2, viewH - 88);
    ctx.textAlign = 'left';
    if (step.kind === 'goto' && step.seconds) {
      ctx.fillStyle = missionTimer < 20 ? '#ff6a5a' : '#edf5fa';
      ctx.font = '700 16px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(missionTimer) + 's', viewW / 2, viewH - 122);
      ctx.textAlign = 'left';
    }
    if (step.kind === 'interact' && holdProgress > 0) {
      const bw = 180;
      ctx.fillStyle = '#20242c';
      ctx.fillRect(viewW / 2 - bw / 2, viewH - 132, bw, 8);
      ctx.fillStyle = '#e0b13c';
      ctx.fillRect(viewW / 2 - bw / 2, viewH - 132, bw * clamp(holdProgress / (step.hold || 1), 0, 1), 8);
    }
    if (step.kind === 'defeat') {
      ctx.fillStyle = '#edf5fa';
      ctx.font = '600 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Down: ' + missionKills + ' / ' + step.count, viewW / 2, viewH - 122);
      ctx.textAlign = 'left';
    }
  }
  if (missionStates[missionIndex] === 'AVAILABLE') {
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    const label = 'New mission: ' + MISSIONS[missionIndex].title + ' — reach the gold marker, press E';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(8,13,22,0.72)';
    rr(viewW / 2 - tw / 2 - 16, viewH - 108, tw + 32, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#e0b13c';
    ctx.textAlign = 'center';
    ctx.fillText(label, viewW / 2, viewH - 88);
    ctx.textAlign = 'left';
  }

  // Interaction prompt.
  const prompt = interactionPrompt();
  if (prompt) {
    ctx.font = '600 14px Inter, system-ui, sans-serif';
    const tw = ctx.measureText(prompt).width;
    ctx.fillStyle = 'rgba(224,177,60,0.92)';
    rr(viewW / 2 - tw / 2 - 14, viewH - 152, tw + 28, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.textAlign = 'center';
    ctx.fillText(prompt, viewW / 2, viewH - 133);
    ctx.textAlign = 'left';
  }

  // Notifications, top-centre.
  ctx.textAlign = 'center';
  notes.forEach((n, i) => {
    ctx.globalAlpha = clamp(n.t, 0, 1);
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    const tw = ctx.measureText(n.text).width;
    ctx.fillStyle = 'rgba(8,13,22,0.78)';
    rr(viewW / 2 - tw / 2 - 12, 18 + i * 30, tw + 24, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#edf5fa';
    ctx.fillText(n.text, viewW / 2, 35 + i * 30);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  // Dialogue box.
  if (dialogue.length > 0) {
    const d = dialogue[0];
    const bw = Math.min(680, viewW - 80);
    ctx.fillStyle = 'rgba(8,13,22,0.88)';
    rr(viewW / 2 - bw / 2, viewH - 216, bw, 56, 8);
    ctx.fill();
    ctx.fillStyle = '#e0b13c';
    ctx.font = '700 13px Inter, system-ui, sans-serif';
    ctx.fillText(d.who.toUpperCase(), viewW / 2 - bw / 2 + 16, viewH - 194);
    ctx.fillStyle = '#edf5fa';
    ctx.font = '500 14px Inter, system-ui, sans-serif';
    wrapText(d.text, viewW / 2 - bw / 2 + 16, viewH - 174, bw - 32, 18);
    ctx.fillStyle = '#9ab0c9';
    ctx.font = '500 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('E — continue', viewW / 2 + bw / 2 - 12, viewH - 194);
    ctx.textAlign = 'left';
  }

  // Mission timer for the race and the finale banner.
  if (race) {
    ctx.fillStyle = '#edf5fa';
    ctx.font = '700 18px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RACE — gate ' + (race.gate + 1) + ' of 3 · ' + Math.ceil(race.timer) + 's', viewW / 2, 52);
    ctx.textAlign = 'left';
  }
  if (gameComplete) {
    ctx.fillStyle = 'rgba(8,13,22,0.8)';
    ctx.fillRect(0, viewH / 2 - 60, viewW, 120);
    ctx.fillStyle = '#e0b13c';
    ctx.font = '700 34px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DISTRICT ZERO', viewW / 2, viewH / 2 - 8);
    ctx.fillStyle = '#edf5fa';
    ctx.font = '500 16px Inter, system-ui, sans-serif';
    ctx.fillText('The city is yours, Jace. Rook would be proud.', viewW / 2, viewH / 2 + 26);
    ctx.textAlign = 'left';
  }
  // Off-screen mission arrow.
  const step2 = currentStep();
  if (missionStates[missionIndex] === 'ACTIVE' && step2) {
    const sx = (step2.x - cam.x) * cam.zoom + viewW / 2;
    const sy = (step2.y - cam.y) * cam.zoom + viewH / 2;
    if (sx < 60 || sx > viewW - 60 || sy < 60 || sy > viewH - 60) {
      const cx = clamp(sx, 60, viewW - 60), cy = clamp(sy, 60, viewH - 60);
      const a = angleTo(cx, cy, sx, sy);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#e0b13c';
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#e0b13c';
      ctx.font = '600 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(dist2d(player.x, player.y, step2.x, step2.y)) + 'm', cx, cy + 26);
      ctx.textAlign = 'left';
    }
  }
}

function wrapText(text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function interactionPrompt() {
  if (dialogue.length > 0) return 'Press E — continue';
  if (dist2d(player.x, player.y, GARAGE.x, GARAGE.y) < 90) return 'Press E — Nia\u2019s Garage (shop)';
  if (dist2d(player.x, player.y, RACE_START.x, RACE_START.y) < 80 && !race) return 'Press E — start the street race';
  if (courier && courier.state === 'pickup' && dist2d(player.x, player.y, courier.px, courier.py) < 80) return 'Press E — collect the parcel';
  const mState = missionStates[missionIndex];
  if (mState === 'AVAILABLE') {
    const first = MISSIONS[missionIndex].steps[0];
    if (dist2d(player.x, player.y, first.x, first.y) < 95) return 'Press E — start: ' + MISSIONS[missionIndex].title;
  }
  if (mState === 'ACTIVE') {
    const step = currentStep();
    if (step && step.kind === 'interact' && dist2d(player.x, player.y, step.x, step.y) < 85) return 'Hold E — ' + step.label;
  }
  if (player.onFoot) {
    for (const p of parkedCars) {
      if (dist2d(player.x, player.y, p.x, p.y) < 60) return 'Press E — drive the ' + VEHICLES[p.vIdx].name;
    }
    for (const t of traffic) {
      if (dist2d(player.x, player.y, t.x, t.y) < 55) return 'Press E — steal this car (wanted +1)';
    }
    for (const pc of policeCars) {
      if (dist2d(player.x, player.y, pc.x, pc.y) < 55) return 'Press E — steal the cruiser (wanted +2)';
    }
  } else {
    return 'Press E — exit vehicle';
  }
  return null;
}

// --- Menus and overlays -----------------------------------------------------
function drawTitle() {
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, 'rgba(8,13,22,0.35)');
  grad.addColorStop(1, 'rgba(8,13,22,0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e0b13c';
  ctx.font = '700 20px Inter, system-ui, sans-serif';
  ctx.fillText('VESPERA CITY', viewW / 2, viewH * 0.18);
  ctx.fillStyle = '#edf5fa';
  ctx.font = '700 64px Inter, system-ui, sans-serif';
  ctx.fillText('NIGHTFALL', viewW / 2, viewH * 0.18 + 66);
  ctx.fillStyle = '#e0b13c';
  ctx.font = '700 28px Inter, system-ui, sans-serif';
  ctx.fillText('DISTRICT ZERO', viewW / 2, viewH * 0.18 + 106);
  ctx.fillStyle = '#9ab0c9';
  ctx.font = '500 16px Inter, system-ui, sans-serif';
  ctx.fillText('The city remembers everything.', viewW / 2, viewH * 0.18 + 136);
  const items = menuItems();
  menuButtons = [];
  const my = viewH * 0.48;
  items.forEach((it, i) => {
    const y = my + i * 46;
    const w = 320, h = 38;
    const x = viewW / 2 - w / 2;
    if (i === menuIndex) {
      ctx.fillStyle = '#e0b13c';
      rr(x, y, w, h, 8); ctx.fill();
      ctx.fillStyle = '#20242c';
    } else {
      ctx.fillStyle = 'rgba(8,13,22,0.7)';
      rr(x, y, w, h, 8); ctx.fill();
      ctx.fillStyle = '#edf5fa';
    }
    ctx.font = '600 16px Inter, system-ui, sans-serif';
    ctx.fillText(it.label, viewW / 2, y + 25);
    menuButtons.push({ x, y, w, h, act: it.act });
  });
  ctx.fillStyle = '#5a6a7a';
  ctx.font = '500 13px Inter, system-ui, sans-serif';
  ctx.fillText('WASD move · E interact · Mouse aim · Click shoot · Esc pause', viewW / 2, viewH - 40);
  ctx.textAlign = 'left';
}

function drawPaused() {
  ctx.fillStyle = 'rgba(8,13,22,0.62)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#edf5fa';
  ctx.font = '700 30px Inter, system-ui, sans-serif';
  ctx.fillText('PAUSED', viewW / 2, viewH * 0.2);
  const items = menuItems();
  menuButtons = [];
  const my = viewH * 0.3;
  items.forEach((it, i) => {
    const y = my + i * 46;
    const w = 320, h = 38;
    const x = viewW / 2 - w / 2;
    if (i === menuIndex) {
      ctx.fillStyle = '#e0b13c';
      rr(x, y, w, h, 8); ctx.fill();
      ctx.fillStyle = '#20242c';
    } else {
      ctx.fillStyle = 'rgba(8,13,22,0.7)';
      rr(x, y, w, h, 8); ctx.fill();
      ctx.fillStyle = '#edf5fa';
    }
    ctx.font = '600 16px Inter, system-ui, sans-serif';
    ctx.fillText(it.label, viewW / 2, y + 25);
    menuButtons.push({ x, y, w, h, act: it.act });
  });
  ctx.textAlign = 'left';
}

function drawMapOverlay() {
  ctx.fillStyle = 'rgba(8,13,22,0.9)';
  ctx.fillRect(0, 0, viewW, viewH);
  const s = Math.min((viewW - 120) / WORLD_W, (viewH - 170) / WORLD_H);
  const ox = (viewW - WORLD_W * s) / 2, oy = 70;
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 2; row++) {
      const d = DISTRICTS[row * 4 + col];
      ctx.fillStyle = d.tint;
      ctx.fillRect(ox + col * 900 * s, oy + row * 1350 * s, 900 * s, 1350 * s);
      ctx.fillStyle = d.accent;
      ctx.font = '700 15px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.name.toUpperCase(), ox + (col * 900 + 450) * s, oy + (row * 1350 + 60) * s);
      ctx.fillStyle = '#9ab0c9';
      ctx.font = '500 11px Inter, system-ui, sans-serif';
      ctx.fillText(d.note, ox + (col * 900 + 450) * s, oy + (row * 1350 + 80) * s);
    }
  }
  ctx.fillStyle = '#0e2431';
  ctx.fillRect(ox, oy + 1350 * s, 150 * s, 1350 * s);
  ctx.strokeStyle = '#3a4a63';
  ctx.lineWidth = 1.5;
  for (const rx of ROADS_V) {
    ctx.beginPath(); ctx.moveTo(ox + rx * s, oy); ctx.lineTo(ox + rx * s, oy + WORLD_H * s); ctx.stroke();
  }
  for (const ry of ROADS_H) {
    ctx.beginPath(); ctx.moveTo(ox, oy + ry * s); ctx.lineTo(ox + WORLD_W * s, oy + ry * s); ctx.stroke();
  }
  ctx.textAlign = 'center';
  for (const lm of LANDMARKS) {
    ctx.fillStyle = '#e0b13c';
    ctx.fillRect(ox + lm.x * s - 2, oy + lm.y * s - 2, 4, 4);
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.fillText(lm.name, ox + lm.x * s, oy + lm.y * s - 8);
  }
  ctx.fillStyle = '#4fc98a';
  ctx.fillRect(ox + GARAGE.x * s - 3, oy + GARAGE.y * s - 3, 6, 6);
  ctx.font = '600 11px Inter, system-ui, sans-serif';
  ctx.fillText('GARAGE', ox + GARAGE.x * s, oy + GARAGE.y * s - 10);
  const step = currentStep();
  if (missionStates[missionIndex] === 'ACTIVE' && step) {
    ctx.fillStyle = '#e0b13c';
    ctx.beginPath(); ctx.arc(ox + step.x * s, oy + step.y * s, 8, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e0b13c';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ox + step.x * s, oy + step.y * s, 13, 0, TAU); ctx.stroke();
  }
  for (const pc of policeCars) {
    ctx.fillStyle = '#e03a3a';
    ctx.beginPath(); ctx.arc(ox + pc.x * s, oy + pc.y * s, 4, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(ox + player.x * s, oy + player.y * s, 6, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ox + player.x * s, oy + player.y * s, 11, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#edf5fa';
  ctx.font = '700 18px Inter, system-ui, sans-serif';
  ctx.fillText('VESPERA CITY — ' + districtAt(player.x, player.y).name.toUpperCase(), viewW / 2, 40);
  ctx.fillStyle = '#9ab0c9';
  ctx.font = '500 13px Inter, system-ui, sans-serif';
  ctx.fillText('M / Esc — close', viewW / 2, viewH - 24);
  ctx.textAlign = 'left';
}

function drawJournal() {
  ctx.fillStyle = 'rgba(8,13,22,0.9)';
  ctx.fillRect(0, 0, viewW, viewH);
  const pw = Math.min(720, viewW - 80);
  const px = (viewW - pw) / 2, py = 56;
  const ph = Math.min(580, viewH - 130);
  ctx.fillStyle = 'rgba(16,22,34,0.96)';
  rr(px, py, pw, ph, 10);
  ctx.fill();
  ctx.fillStyle = '#edf5fa';
  ctx.font = '700 20px Inter, system-ui, sans-serif';
  ctx.fillText('MISSION JOURNAL', px + 24, py + 36);
  ctx.fillStyle = '#e0b13c';
  ctx.font = '600 14px Inter, system-ui, sans-serif';
  ctx.fillText(fmtCash(player.cash) + '   ·   REP ' + player.rep, px + 24, py + 60);
  MISSIONS.forEach((m, i) => {
    const y = py + 84 + i * 52;
    const st = missionStates[i];
    ctx.fillStyle = i === missionIndex && st === 'ACTIVE' ? 'rgba(224,177,60,0.14)' : 'rgba(255,255,255,0.03)';
    rr(px + 12, y, pw - 24, 46, 6);
    ctx.fill();
    ctx.fillStyle = st === 'COMPLETED' ? '#4fc98a' : (st === 'ACTIVE' ? '#e0b13c' : (st === 'AVAILABLE' ? '#edf5fa' : '#5a6a7a'));
    ctx.font = '700 14px Inter, system-ui, sans-serif';
    ctx.fillText((i + 1) + '. ' + m.title, px + 24, y + 19);
    ctx.fillStyle = '#9ab0c9';
    ctx.font = '500 12px Inter, system-ui, sans-serif';
    ctx.fillText(m.giver + '  ·  ' + fmtCash(m.payout) + '  ·  +' + m.rep + ' rep  ·  ' + st, px + 24, y + 37);
  });
  const step = currentStep();
  if (step && missionStates[missionIndex] === 'ACTIVE') {
    ctx.fillStyle = '#e0b13c';
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    ctx.fillText('Current: ' + step.label, px + 24, py + 84 + 8 * 52 + 12);
  }
  ctx.fillStyle = '#9ab0c9';
  ctx.font = '500 13px Inter, system-ui, sans-serif';
  ctx.fillText('J / Esc — close', px + 24, py + ph - 16);
}

function drawSettings() {
  ctx.fillStyle = 'rgba(8,13,22,0.9)';
  ctx.fillRect(0, 0, viewW, viewH);
  const pw = 460, px = (viewW - pw) / 2, py = viewH * 0.3;
  ctx.fillStyle = 'rgba(16,22,34,0.96)';
  rr(px, py, pw, 220, 10);
  ctx.fill();
  ctx.fillStyle = '#edf5fa';
  ctx.font = '700 20px Inter, system-ui, sans-serif';
  ctx.fillText('SETTINGS', px + 24, py + 36);
  const rows = [
    ['Sound', settings.muted ? 'Muted' : 'On'],
    ['Minimap', settings.showMinimap ? 'On' : 'Off'],
    ['Weather', settings.weatherAuto ? 'Auto' : 'Manual'],
  ];
  rows.forEach((r, i) => {
    const y = py + 70 + i * 44;
    if (i === settingsSel) {
      ctx.fillStyle = 'rgba(224,177,60,0.16)';
      rr(px + 12, y - 20, pw - 24, 36, 6);
      ctx.fill();
    }
    ctx.fillStyle = '#edf5fa';
    ctx.font = '600 15px Inter, system-ui, sans-serif';
    ctx.fillText(r[0], px + 24, y + 4);
    ctx.fillStyle = '#e0b13c';
    ctx.textAlign = 'right';
    ctx.fillText(r[1], px + pw - 24, y + 4);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = '#9ab0c9';
  ctx.font = '500 13px Inter, system-ui, sans-serif';
  ctx.fillText('Arrows to choose · Enter to toggle · Esc to go back', px + 24, py + 196);
}

function drawControls() {
  ctx.fillStyle = 'rgba(8,13,22,0.9)';
  ctx.fillRect(0, 0, viewW, viewH);
  const pw = 560, px = (viewW - pw) / 2, py = viewH * 0.2;
  ctx.fillStyle = 'rgba(16,22,34,0.96)';
  rr(px, py, pw, 420, 10);
  ctx.fill();
  ctx.fillStyle = '#edf5fa';
  ctx.font = '700 20px Inter, system-ui, sans-serif';
  ctx.fillText('CONTROLS', px + 24, py + 36);
  const lines = [
    ['WASD / Arrows', 'Move / drive'],
    ['Shift', 'Sprint / boost'],
    ['Space', 'Hop'],
    ['C', 'Crouch (harder to spot)'],
    ['E', 'Interact / enter / exit vehicle'],
    ['Mouse', 'Aim — click to shoot, right-click to aim'],
    ['R', 'Reload'],
    ['Q / 1-5', 'Switch weapon'],
    ['M', 'City map'],
    ['J', 'Mission journal'],
    ['H', 'Headlights'],
    ['0', 'Mute sound'],
    ['Esc', 'Pause menu'],
  ];
  lines.forEach((l, i) => {
    const y = py + 66 + i * 26;
    ctx.fillStyle = '#e0b13c';
    ctx.font = '500 14px Inter, system-ui, sans-serif';
    ctx.fillText(l[0], px + 24, y);
    ctx.fillStyle = '#edf5fa';
    ctx.fillText(l[1], px + 220, y);
  });
  ctx.fillStyle = '#9ab0c9';
  ctx.font = '500 13px Inter, system-ui, sans-serif';
  ctx.fillText('Esc — back', px + 24, py + 392);
}

function drawShop() {
  ctx.fillStyle = 'rgba(8,13,22,0.7)';
  ctx.fillRect(0, 0, viewW, viewH);
  const pw = 560, px = (viewW - pw) / 2, py = viewH * 0.24;
  ctx.fillStyle = 'rgba(16,22,34,0.96)';
  rr(px, py, pw, 340, 10);
  ctx.fill();
  ctx.fillStyle = '#edf5fa';
  ctx.font = '700 20px Inter, system-ui, sans-serif';
  ctx.fillText('NIA\u2019S GARAGE', px + 24, py + 36);
  ctx.fillStyle = '#e0b13c';
  ctx.font = '600 14px Inter, system-ui, sans-serif';
  ctx.fillText('Cash: ' + fmtCash(player.cash), px + 24, py + 60);
  SHOP_ITEMS.forEach((it, i) => {
    const y = py + 92 + i * 44;
    let price = it.price;
    let label = it.label;
    if (i === 4) {
      const next = WEAPONS.findIndex((w, idx) => !player.owned[idx]);
      price = next < 0 ? 0 : WEAPONS[next].price;
      label = next < 0 ? 'Buy next weapon (all owned)' : 'Buy the ' + WEAPONS[next].name;
    }
    ctx.fillStyle = '#edf5fa';
    ctx.font = '600 15px Inter, system-ui, sans-serif';
    ctx.fillText((i + 1) + '. ' + label, px + 24, y);
    ctx.fillStyle = '#e0b13c';
    ctx.textAlign = 'right';
    ctx.fillText(price > 0 ? fmtCash(price) : '—', px + pw - 24, y);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = '#9ab0c9';
  ctx.font = '500 13px Inter, system-ui, sans-serif';
  ctx.fillText('Press 1-5 to buy · Esc to leave', px + 24, py + 312);
}

// --- Screenshot staging -----------------------------------------------------
// Each ?shot= value drops the player into a fixed, good-looking scene so the
// four captures show the city, the HUD, the minimap, traffic, police and a
// mission in progress.
function stageShot() {
  const s = SHOT_PARAM;
  if (!s) return;
  phase = 'playing';
  if (s === 'start') {
    timeOfDay = 17.2; weather = 'clear'; wanted = 0;
    missionStates[0] = 'ACTIVE'; missionIndex = 0; missionStep = 0;
    player.vehicle = { vIdx: 2, x: 1350, y: 800, angle: Math.PI / 2, speed: 60, hp: 70 };
    player.onFoot = false;
    player.x = 1350; player.y = 800;
    for (let i = 0; i < 6; i++) traffic[i] = spawnTrafficCar(1350, 800);
  } else if (s === 'play') {
    timeOfDay = 12.5; weather = 'clear'; wanted = 1;
    missionStates[0] = 'ACTIVE'; missionIndex = 0; missionStep = 1;
    player.x = 1300; player.y = 1950;
    player.onFoot = true; player.vehicle = null;
    player.weapon = 4; player.owned[4] = true;
    player.ammo[4] = { mag: 8, reserve: 32 };
    spawnEnemy(1420, 1900);
    spawnEnemy(1250, 2050);
    spawnEnemy(1500, 2100);
    spawnPoliceCar();
  } else if (s === 'chase') {
    timeOfDay = 19.0; weather = 'clear'; wanted = 3;
    missionStates[0] = 'COMPLETED'; missionStates[1] = 'COMPLETED';
    missionStates[2] = 'ACTIVE'; missionIndex = 2; missionStep = 1;
    player.vehicle = { vIdx: 3, x: 2000, y: 1500, angle: 0, speed: 120, hp: 110 };
    player.onFoot = false;
    player.x = 2000; player.y = 1500;
    for (let i = 0; i < 3; i++) spawnPoliceCar();
  } else if (s === 'night') {
    timeOfDay = 23.5; weather = 'rain'; wanted = 1; headlights = true;
    missionStates[0] = 'COMPLETED'; missionStates[1] = 'ACTIVE';
    missionIndex = 1; missionStep = 0;
    player.vehicle = { vIdx: 1, x: 2250, y: 900, angle: Math.PI / 2, speed: 50, hp: 100 };
    player.onFoot = false;
    player.x = 2250; player.y = 900;
    spawnPoliceCar();
    for (let i = 0; i < 5; i++) traffic[i] = spawnTrafficCar(2250, 900);
  }
  cam.x = player.x;
  cam.y = player.y;
  lastSeenAt = gameTime;
}

// --- Render root and main loop ----------------------------------------------
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#080d16';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.setTransform(cam.zoom, 0, 0, cam.zoom, viewW / 2 - cam.x * cam.zoom, viewH / 2 - cam.y * cam.zoom);
  drawWorld();
  drawMarkers();
  drawEntities();
  drawNightAndWeather();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawWeatherOverlay();
  if (phase === 'playing' || phase === 'paused' || phase === 'map' || phase === 'journal' || phase === 'shop') drawHud();
  if (phase === 'title') drawTitle();
  if (phase === 'paused') drawPaused();
  if (phase === 'map') drawMapOverlay();
  if (phase === 'journal') drawJournal();
  if (phase === 'settings') drawSettings();
  if (phase === 'controls') drawControls();
  if (phase === 'shop') drawShop();
  // Signal that a full frame is painted, so the screenshot harness knows the
  // staged ?shot= scene is ready to capture instead of timing out.
  window.__shotReady = true;
}

function drawWeatherOverlay() {
  if (weather === 'cloudy') {
    ctx.fillStyle = 'rgba(120,130,150,0.13)';
    ctx.fillRect(0, 0, viewW, viewH);
  }
  if (weather === 'rain') {
    ctx.fillStyle = 'rgba(40,60,90,0.14)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.strokeStyle = 'rgba(180,200,230,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const drop of rainDrops) {
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 6, drop.y + 16);
    }
    ctx.stroke();
  }
}

let lastT = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
  lastT = t;
  gameTime += dt;
  if (phase === 'playing') {
    updatePlayer(dt);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateMissions(dt);
    updateWanted(dt);
    updateTasks(dt);
    updateClock(dt);
  } else if (phase === 'title') {
    updateTraffic(dt * 0.5);
    updatePeds(dt * 0.5);
  }
  updateCamera(dt);
  render();
}

stageShot();
requestAnimationFrame(loop);
