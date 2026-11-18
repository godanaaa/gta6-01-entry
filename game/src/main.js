// NIGHTFALL: DISTRICT ZERO — a self-contained Vespera City street simulation.
// Canvas primitives keep the build portable and all preview routes deterministic.
const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const view = { w: 1280, h: 800 };
const tau = Math.PI * 2;
const query = new URLSearchParams(location.search);
const preview = query.get('shot') || '';
let seed = Number(query.get('seed') || 1);
const dice = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const districts = ['HARBOR', 'DOWNTOWN', 'OLD QUARTER', 'INDUSTRIAL', 'HILLSIDE', 'MARKET', 'SOUTHSIDE', 'TRANSIT'];
const facades = ['#35424b', '#393c49', '#3d4546', '#4a4141', '#384552', '#484146', '#34414a', '#39454b'];
const jobs = [
  ['BACK IN THE CITY', 'Meet Mara Venn, retrieve the stolen vehicle', 250, 1],
  ['HOT CARGO', 'Steal the delivery van and take it to Blackwater warehouse', 600, 1],
  ['NO QUESTIONS', 'Deliver the package and lose the police', 750, 2],
  ['NIGHT SHIFT', 'Break into the warehouse and recover the evidence', 900, 2],
  ['CROSSTOWN', 'Cross the city while rivals pursue', 1100, 3],
  ['THE LEDGER', 'Infiltrate the business and steal the ledger', 1300, 3],
  ['OLD DEBTS', 'Help your ally escape the enemy faction', 1500, 4],
  ['DISTRICT ZERO', 'Survive the finale and reach the safehouse', 2500, 5],
];
const hero = { x: 0, y: 0, angle: 0, speed: 0, health: 92, armor: 62, ammo: 17, mags: [17, 42, 90, 24, 60], cash: 4250, heat: 0, car: 'ARCLIGHT VELO', job: jobs[0][0], goal: 'Meet Mara Venn at the Meridian underpass', chapter: 0, walking: false, rep: 0, gun: 0 };
const blocks = [], traffic = [], people = [], patrols = [], shots = [];
for (let y = -5; y <= 5; y++) for (let x = -6; x <= 6; x++) blocks.push({ x, y, zone: (Math.abs(x) + Math.abs(y)) % 8, tall: 100 + dice() * 170, wide: 110 + dice() * 70, glow: dice() });
const paintColors = ['#e9b75f', '#61c0c2', '#b6c5d0', '#cf5b55', '#596d88'];
for (let i = 0; i < 18; i++) traffic.push({ x: (dice() - .5) * 1600, y: (dice() - .5) * 1300, dir: dice() * tau, pace: 1.1 + dice() * 1.6, color: paintColors[i % 5], type: i % 5 === 0 ? 'van' : 'sedan' });
for (let i = 0; i < 27; i++) people.push({ x: (dice() - .5) * 1300, y: (dice() - .5) * 1100, dir: dice() * tau, pace: .35 + dice() * .5, color: ['#e8a773', '#6bc2bc', '#d5d2c8', '#dc6b78', '#acb4e4'][i % 5] });
let keys = new Set(), paused = false, menu = !preview, atlas = false, journal = false;
let night = preview === 'night', elapsed = 0, toast = 'MARA VENN  //  The city remembers everything.', toastTime = 4, flash = 0;
let states = jobs.map((_, i) => i ? 'LOCKED' : 'AVAILABLE');
const say = (line, seconds = 3) => { toast = line; toastTime = seconds; };
function setChapter() {
  const n = Math.min(hero.chapter, jobs.length - 1);
  hero.job = jobs[n][0]; hero.goal = jobs[n][1];
  states = states.map((_, i) => i < n ? 'COMPLETED' : i === n ? 'ACTIVE' : i === n + 1 ? 'AVAILABLE' : 'LOCKED');
}
function save() {
  localStorage.setItem('nightfall-save', JSON.stringify({ chapter: hero.chapter, cash: hero.cash, rep: hero.rep, health: hero.health, armor: hero.armor, states, night }));
  say('GAME SAVED  //  Vespera remembers.');
}
function resumeSave() {
  try {
    const data = JSON.parse(localStorage.getItem('nightfall-save') || 'null');
    if (!data) return false;
    hero.chapter = Math.min(jobs.length - 1, data.chapter | 0); hero.cash = data.cash || 0; hero.rep = data.rep || 0;
    hero.health = data.health || 92; hero.armor = data.armor || 62; states = Array.isArray(data.states) ? data.states : states;
    night = Boolean(data.night); menu = false; setChapter(); return true;
  } catch { return false; }
}
function startGame() { menu = false; setChapter(); }
function finishJob() {
  const n = Math.min(hero.chapter, jobs.length - 1), [name, , reward, renown] = jobs[n];
  hero.cash += reward; hero.rep += renown; hero.chapter++; hero.walking = false; states[n] = 'COMPLETED'; setChapter();
  say(`MISSION COMPLETE  //  ${name}  +$${reward}  •  REP +${renown}`, 4);
}
function useAction() {
  if (!hero.walking) { hero.walking = true; hero.speed = 0; say('ON FOOT  //  Walk to the marker; E to interact'); return; }
  if (Math.hypot(hero.x - 310, hero.y + 120) < 78) { finishJob(); return; }
  if (traffic.some(car => Math.hypot(car.x - hero.x, car.y - hero.y) < 42)) {
    hero.walking = false; hero.car = 'KESTREL S9'; hero.heat = Math.min(5, hero.heat + 1); say('VEHICLE STOLEN  //  Police interest rising');
  }
}
function shoot() {
  if (hero.mags[hero.gun] < 1 || menu) return;
  hero.mags[hero.gun]--; hero.ammo = hero.mags[hero.gun]; flash = .12;
  shots.push({ x: hero.x + Math.cos(hero.angle) * 90, y: hero.y + Math.sin(hero.angle) * 90, life: .35 });
  hero.heat = Math.min(5, Math.max(1, hero.heat)); say('DISCHARGE REPORTED  //  Police attention rising', 2.5);
}
function stageShot() {
  if (preview === 'start') Object.assign(hero, { x: 0, y: 0, angle: .14, speed: 2.7, heat: 0, goal: 'Meet Mara Venn at the Meridian underpass' });
  if (preview === 'play') { Object.assign(hero, { angle: -.35, speed: 0, heat: 1, chapter: 1, job: 'NIGHT SHIFT', goal: 'Recover Elias Rook’s ledger • 38 m' }); people.splice(14); }
  if (preview === 'chase') {
    Object.assign(hero, { angle: .12, speed: 4.3, heat: 4, job: 'CROSSTOWN', goal: 'Lose the Vespera Police • break line of sight' });
    for (let i = 0; i < 4; i++) patrols.push({ x: -180 - i * 105, y: -160 - i * 48, dir: .3, pace: 3.5 + i * .15 });
  }
  if (preview === 'night') Object.assign(hero, { y: 100, angle: -Math.PI / 2, speed: 0, heat: 0, goal: 'Vespera City • 01:47 AM  //  Blackwater waterfront' });
}
stageShot();
function onKey(event) {
  keys.add(event.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (event.code === 'Escape') { if (menu) { menu = false; paused = true; } else paused = !paused; }
  if (event.code === 'KeyM') atlas = !atlas;
  if (event.code === 'KeyJ') journal = !journal;
  if (event.code === 'KeyE') useAction();
  if (event.code === 'KeyR') hero.ammo = hero.mags[hero.gun];
  if (event.code === 'Digit1') hero.car = 'ARCLIGHT VELO';
  if (event.code === 'Digit2') hero.car = 'KESTREL S9';
  if (event.code === 'Digit3') hero.car = 'ROOK GT';
  if (event.code === 'KeyF') shoot();
  if (event.code === 'KeyQ') { hero.gun = (hero.gun + 1) % hero.mags.length; hero.ammo = hero.mags[hero.gun]; }
  if (event.code === 'KeyK') save();
  if (event.code === 'Enter' && menu) { if (!resumeSave()) startGame(); say('MARA: Good to have you back, Jace.', 5); }
}
window.addEventListener('keydown', onKey);
window.addEventListener('keyup', event => keys.delete(event.code));
canvas.addEventListener('pointerdown', event => {
  if (menu) { if (event.offsetY > innerHeight * .47 && event.offsetY < innerHeight * .60 && localStorage.getItem('nightfall-save')) resumeSave(); else startGame(); }
  else if (event.button === 0) shoot();
});
function fit() { const ratio = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(innerWidth * ratio); canvas.height = Math.round(innerHeight * ratio); ctx.setTransform(canvas.width / view.w, 0, 0, canvas.height / view.h, 0, 0); }
window.addEventListener('resize', fit); fit();
function update(dt) {
  elapsed += dt; toastTime = Math.max(0, toastTime - dt); flash = Math.max(0, flash - dt);
  if (paused || menu) return;
  const turn = Number(keys.has('KeyA') || keys.has('ArrowLeft')) - Number(keys.has('KeyD') || keys.has('ArrowRight'));
  const forward = keys.has('KeyW') || keys.has('ArrowUp'), reverse = keys.has('KeyS') || keys.has('ArrowDown');
  if (hero.walking) { hero.angle += turn * dt * 2.5; hero.x += Math.cos(hero.angle) * (Number(forward) - Number(reverse)) * dt * 85; hero.y += Math.sin(hero.angle) * (Number(forward) - Number(reverse)) * dt * 85; }
  else {
    if (forward) hero.speed = Math.min(5.2, hero.speed + .055); else if (reverse) hero.speed = Math.max(-1.5, hero.speed - .08); else hero.speed *= .986;
    hero.angle += turn * (.032 + Math.min(.035, Math.abs(hero.speed) * .007)) * Math.sign(hero.speed || 1);
    hero.x += Math.cos(hero.angle) * hero.speed * dt * 48; hero.y += Math.sin(hero.angle) * hero.speed * dt * 48;
  }
  for (const car of traffic) { car.x += Math.cos(car.dir) * car.pace * dt * 42; car.y += Math.sin(car.dir) * car.pace * dt * 42; if (Math.hypot(car.x - hero.x, car.y - hero.y) > 1350) { car.x = hero.x + (dice() - .5) * 1600; car.y = hero.y + (dice() - .5) * 1300; } }
  for (const person of people) { person.x += Math.cos(person.dir) * person.pace * dt * 24; person.y += Math.sin(person.dir) * person.pace * dt * 24; if (Math.hypot(person.x - hero.x, person.y - hero.y) > 1100) { person.x = hero.x + (dice() - .5) * 1300; person.y = hero.y + (dice() - .5) * 1100; } }
  for (const cop of patrols) { cop.dir = Math.atan2(hero.y - cop.y, hero.x - cop.x); cop.x += Math.cos(cop.dir) * cop.pace * dt * 42; cop.y += Math.sin(cop.dir) * cop.pace * dt * 42; }
  if (hero.heat && preview !== 'chase' && dice() < dt * .08) patrols.push({ x: hero.x - 450, y: hero.y - 380, dir: 0, pace: 3.2 });
  if (patrols.length > 5) patrols.shift();
  if (!keys.has('KeyF') && hero.heat && preview !== 'chase') hero.heat = Math.max(0, hero.heat - dt * .006);
  shots.forEach(item => item.life -= dt); while (shots.length && shots[0].life <= 0) shots.shift();
}
function box(x, y, w, h, radius = 12, fill = 'rgba(9,15,24,.88)', stroke = 'rgba(171,206,215,.19)') {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
function label(value, x, y, size, color = '#fff', align = 'left') { ctx.font = `600 ${size}px ui-sans-serif,system-ui`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y); }
function point(x, y) { return [640 + (x - hero.x) * .68, 400 + (y - hero.y) * .68]; }
function streets() {
  const scale = .68, ox = 640 - hero.x * scale, oy = 400 - hero.y * scale;
  ctx.fillStyle = '#18212b'; ctx.fillRect(0, 0, 1280, 800); ctx.fillStyle = '#102d3a'; ctx.fillRect(0, 570, 1280, 230);
  ctx.fillStyle = '#24424a'; for (let i = 0; i < 5; i++) ctx.fillRect(95 + i * 255, 520, 72, 125);
  for (let i = -8; i <= 8; i++) {
    const rx = ox + i * 220 * scale, ry = oy + i * 205 * scale;
    ctx.fillStyle = '#303a43'; ctx.fillRect(rx - 33, 0, 66, 800); ctx.fillRect(0, ry - 32, 1280, 64);
    ctx.fillStyle = '#d5b96e'; ctx.globalAlpha = .48;
    for (let d = -1; d < 9; d++) { ctx.fillRect(rx - 2, d * 104 + elapsed * 20 % 104, 4, 32); ctx.fillRect(d * 160 + elapsed * 14 % 160, ry - 2, 31, 4); }
    ctx.globalAlpha = 1; ctx.fillStyle = '#58605c';
    for (let m = 0; m < 12; m++) { ctx.fillRect(rx - 46, m * 74 + 25, 5, 3); ctx.fillRect(m * 96 + 35, ry + 43, 4, 3); }
  }
}
function building(part) {
  const [x, y] = point(part.x * 220, part.y * 205), w = part.wide * .68, h = part.tall * .68;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - w / 2 + 13, y - h + 13, w, h); ctx.fillStyle = '#45515a'; ctx.fillRect(x - w / 2, y - h - 8, w, 10);
  ctx.fillStyle = facades[part.zone]; ctx.fillRect(x - w / 2, y - h, w, h);
  const rows = Math.max(2, Math.floor(h / 19)), cols = Math.max(2, Math.floor(w / 17));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (Math.sin((part.x * 13 + c * 5 + r * 7) * 12.3 + part.glow * 20) > -.32) {
    ctx.fillStyle = part.zone === 1 ? '#f4c871' : '#eccb8a'; ctx.globalAlpha = .23 + ((r + c) % 3) * .12; ctx.fillRect(x - w / 2 + 8 + c * 16, y - h + 12 + r * 18, 5, 8);
  }
  ctx.globalAlpha = 1;
  if (part.zone === 1 && part.x === 0 && part.y === 0) { ctx.fillStyle = '#4fc9cf'; ctx.fillRect(x - 19, y - h - 25, 38, 18); label('VESPERA', x, y - h - 12, 8, '#e8ffff', 'center'); }
  if (Math.abs(part.x) % 3 === 1 && Math.abs(part.y) % 2 === 0) { ctx.fillStyle = ['#f06e64', '#42c5cb', '#e6b650'][part.zone % 3]; ctx.fillRect(x - w / 2 + 5, y - h + 38, Math.min(w - 12, 45), 8); }
}
function car(x, y, angle, color, type = 'sedan', size = 1, police = false) {
  const [sx, sy] = point(x, y); ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle);
  const length = (type === 'van' ? 52 : type === 'bike' ? 33 : 43) * size, width = (type === 'van' ? 25 : 21) * size;
  ctx.shadowColor = police ? '#57d9ff' : '#000'; ctx.shadowBlur = police ? 14 : 8; box(-length / 2, -width / 2, length, width, 6, color, '#111820'); ctx.shadowBlur = 0;
  box(-length * .12, -width * .37, length * .42, width * .74, 4, police ? '#b9d8df' : '#7eabb2', null);
  ctx.fillStyle = '#f8d79a'; ctx.fillRect(length * .32, -width * .33, 4, 5); ctx.fillRect(length * .32, width * .13, 4, 5);
  ctx.fillStyle = '#e46155'; ctx.fillRect(-length * .48, -width * .32, 3, 5); ctx.fillRect(-length * .48, width * .12, 3, 5);
  if (police) { ctx.fillStyle = '#f24d6c'; ctx.fillRect(-4, -width / 2 - 4, 4, 4); ctx.fillStyle = '#55dfff'; ctx.fillRect(0, -width / 2 - 4, 5, 4); }
  ctx.restore();
}
function walker(person) { const [x, y] = point(person.x, person.y); ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 5, 3, 0, 0, tau); ctx.fill(); ctx.fillStyle = person.color; ctx.beginPath(); ctx.arc(x, y - 4, 4, 0, tau); ctx.fill(); ctx.fillRect(x - 3, y, 6, 10); }
function marker(x, y, color, caption) { const [sx, sy] = point(x, y), pulse = 1 + Math.sin(elapsed * 4) * .08; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 21 * pulse, 0, tau); ctx.stroke(); ctx.fillStyle = color; ctx.globalAlpha = .18; ctx.beginPath(); ctx.arc(sx, sy, 15, 0, tau); ctx.fill(); ctx.globalAlpha = 1; label(caption, sx, sy - 28, 10, color, 'center'); }
function minimap() {
  const x = 1106, y = 48, size = 132; box(x - 10, y - 10, size + 20, size + 50);
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, size, size, 8); ctx.clip(); ctx.fillStyle = '#14232c'; ctx.fillRect(x, y, size, size); ctx.strokeStyle = '#52616a'; ctx.lineWidth = 5;
  for (let n = 0; n < 5; n++) { ctx.beginPath(); ctx.moveTo(x + n * 37 - 12, y); ctx.lineTo(x + n * 37 + 18, y + size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y + n * 36); ctx.lineTo(x + size, y + n * 36 - 15); ctx.stroke(); }
  ctx.fillStyle = '#f0bc5e'; ctx.beginPath(); ctx.arc(x + 66 + (310 - hero.x) * .07, y + 66 + (-120 - hero.y) * .07, 4, 0, tau); ctx.fill(); ctx.fillStyle = '#ff5568';
  for (const cop of patrols) { ctx.beginPath(); ctx.arc(x + 66 + (cop.x - hero.x) * .07, y + 66 + (cop.y - hero.y) * .07, 3, 0, tau); ctx.fill(); }
  ctx.translate(x + 66, y + 66); ctx.rotate(hero.angle); ctx.fillStyle = '#75f4e2'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(0, 4); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.restore(); label('VESPERA  /  GRID', x, y + size + 23, 9, '#9baeb6');
}
function hud() {
  box(25, 22, 315, 96); label('NIGHTFALL', 44, 52, 12, '#66d7d5'); label('DISTRICT ZERO', 44, 70, 10, '#d5e3e8'); label(`$${hero.cash.toLocaleString()}`, 321, 52, 15, '#e6c47f', 'right'); label('JACE MERCER', 44, 101, 11, '#b4c1c7');
  label(`VESPERA • ${districts[(Math.floor(Math.abs(hero.x) / 450) + Math.floor(Math.abs(hero.y) / 390)) % 8]}`, 183, 101, 10, '#8fa3ab');
  box(25, 679, 340, 93); label(hero.job, 44, 710, 12, '#70ddda'); label(`◈  ${hero.goal}`, 44, 734, 12, '#edf2ee'); label('J  JOURNAL', 44, 757, 9, '#85969f');
  box(482, 730, 316, 43); label('W  DRIVE', 503, 756, 10, '#a5b3bb'); label('A D  STEER', 590, 756, 10, '#a5b3bb'); label('E  INTERACT', 690, 756, 10, '#a5b3bb');
  box(1085, 690, 171, 78); label('HEALTH', 1102, 717, 9, '#a6b2ba'); box(1155, 708, 84, 8, 4, '#36414a', null); box(1155, 708, 84 * hero.health / 100, 8, 4, '#d86166', null); label('ARMOR', 1102, 739, 9, '#a6b2ba'); box(1155, 730, 84, 8, 4, '#36414a', null); box(1155, 730, 84 * hero.armor / 100, 8, 4, '#58b9bf', null);
  box(1090, 594, 166, 73); label(hero.car, 1106, 619, 10, '#e6c57e'); label(`${Math.round(Math.abs(hero.speed) * 31)} KM/H`, 1106, 646, 16, '#f1f5f5'); label(`▣  ${hero.ammo} / 68`, 1106, 664, 9, '#9cabb1');
  label('VE', 1099, 233, 10, '#a9bbc1'); for (let n = 0; n < 5; n++) label('★', 1127 + n * 23, 235, 17, n < hero.heat ? '#f3c866' : '#46515a'); if (hero.heat) label(hero.heat >= 4 ? 'POLICE RESPONSE  •  BREAK LINE OF SIGHT' : 'POLICE INTEREST', 1086, 257, 8, '#f28d85');
  minimap(); if (toastTime > 0) { box(417, 26, 446, 42); label(toast, 640, 53, 11, '#e6d3a2', 'center'); }
}
function title() {
  ctx.fillStyle = 'rgba(5,10,17,.68)'; ctx.fillRect(0, 0, 1280, 800); ctx.save(); ctx.translate(82, 191); ctx.fillStyle = '#6ee1dc'; ctx.fillRect(0, 0, 4, 140);
  label('NIGHTFALL', 25, 25, 14, '#81e7dd'); label('DISTRICT', 25, 86, 48, '#f5f3e9'); label('ZERO', 25, 143, 54, '#f3cb75'); label('THE CITY REMEMBERS EVERYTHING.', 26, 181, 13, '#bfccd0'); box(22, 222, 356, 202);
  label('NEW GAME', 45, 264, 15); label(`${localStorage.getItem('nightfall-save') ? 'CONTINUE  •  SAVED CAMPAIGN' : 'CONTINUE  •  NO SAVE YET'}`, 45, 302, 13, '#a9b8be'); label(`SETTINGS  •  AUDIO ${localStorage.getItem('nightfall-muted') === '1' ? 'OFF' : 'ON'}`, 45, 340, 13, '#a9b8be'); label('CONTROLS  •  WASD / E / F / J / M', 45, 378, 13, '#a9b8be'); label('ENTER  NEW GAME     C  CONTINUE', 26, 461, 10, '#70d5d2'); ctx.restore();
}
function mapOverlay() {
  ctx.fillStyle = 'rgba(3,8,14,.86)'; ctx.fillRect(0, 0, 1280, 800); label('VESPERA CITY', 640, 85, 25, '#e7c475', 'center'); label('DISTRICT ATLAS  /  M', 640, 111, 10, '#9baeb3', 'center'); ctx.strokeStyle = '#53646b'; ctx.lineWidth = 21;
  for (let n = 0; n < 7; n++) { ctx.beginPath(); ctx.moveTo(310 + n * 105, 190); ctx.lineTo(390 + n * 60, 615); ctx.stroke(); ctx.beginPath(); ctx.moveTo(255, 240 + n * 53); ctx.lineTo(1025, 210 + n * 48); ctx.stroke(); }
  districts.forEach((name, i) => label(name, 330 + (i % 4) * 178, 300 + Math.floor(i / 4) * 180, 11, '#d5dedc', 'center')); ctx.fillStyle = '#64eee0'; ctx.beginPath(); ctx.arc(640, 400, 8, 0, tau); ctx.fill(); label('JACE', 657, 405, 10); label('ESC  CLOSE', 640, 716, 10, '#91a5ac', 'center');
}
function journalOverlay() {
  ctx.fillStyle = 'rgba(3,8,14,.8)'; ctx.fillRect(0, 0, 1280, 800); box(380, 180, 520, 440); label(paused ? 'PAUSED  •  ESC RESUME' : 'MISSION JOURNAL  •  J CLOSE', 640, 223, 21, '#ead08d', 'center');
  jobs.forEach((job, i) => { const state = states[i]; label(`${state}   ${job[0]}`, 420, 272 + i * 35, 11, state === 'ACTIVE' ? '#70ddda' : state === 'COMPLETED' ? '#e6c47f' : '#92a1a8'); label(job[1], 550, 272 + i * 35, 10, '#c6d0d1'); });
  if (paused) label('M MAP  •  J MISSIONS  •  K SAVE  •  ESC RESUME', 640, 587, 10, '#70d5d2', 'center');
}
function draw() {
  streets(); for (const part of blocks) if (Math.abs(part.x * 220 - hero.x) < 1050 && Math.abs(part.y * 205 - hero.y) < 900) building(part);
  marker(310, -120, '#f1bd61', jobs[Math.min(hero.chapter, jobs.length - 1)][0]); traffic.forEach(v => car(v.x, v.y, v.dir, v.color, v.type, .88)); people.forEach(walker);
  for (const shot of shots) { const [x, y] = point(shot.x, shot.y); ctx.fillStyle = '#f8d46c'; ctx.beginPath(); ctx.arc(x, y, 3, 0, tau); ctx.fill(); }
  patrols.forEach(cop => car(cop.x, cop.y, cop.dir, '#d8e0e0', 'sedan', 1.05, true));
  if (hero.walking) walker({ x: hero.x, y: hero.y, color: '#65e1d7' }); else car(hero.x, hero.y, hero.angle, hero.car === 'ROOK GT' ? '#d36657' : hero.car === 'KESTREL S9' ? '#557f91' : '#c9a664', 'sedan', 1.14);
  const shade = ctx.createRadialGradient(640, 400, 150, 640, 400, 690); shade.addColorStop(0, 'rgba(3,8,15,0)'); shade.addColorStop(1, 'rgba(3,8,15,.4)'); ctx.fillStyle = shade; ctx.fillRect(0, 0, 1280, 800);
  if (night) { ctx.fillStyle = 'rgba(5,12,34,.16)'; ctx.fillRect(0, 0, 1280, 800); } hud(); if (menu) title(); if (atlas) mapOverlay(); if ((journal || paused) && !menu) journalOverlay();
}
let last = performance.now(), frames = 0;
function frame(now) {
  const dt = Math.min(.04, (now - last) / 1000); last = now;
  if (preview) {
    elapsed += dt;
    for (const v of traffic) { v.x += Math.cos(v.dir) * v.pace * dt * 42; v.y += Math.sin(v.dir) * v.pace * dt * 42; }
    for (const p of people) { p.x += Math.cos(p.dir) * p.pace * dt * 24; p.y += Math.sin(p.dir) * p.pace * dt * 24; }
    for (const cop of patrols) { cop.dir = Math.atan2(hero.y - cop.y, hero.x - cop.x); cop.x += Math.cos(cop.dir) * cop.pace * dt * 42; cop.y += Math.sin(cop.dir) * cop.pace * dt * 42; }
    if (++frames === 3) window.__shotReady = true;
  } else update(dt);
  draw(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
