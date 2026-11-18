// NIGHTFALL: DISTRICT ZERO is a small, offline driving-and-foot patrol through Vespera.
// The complete scene is drawn on one canvas so the four preview URLs work without assets.
const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');
const screen = { width: 1280, height: 800 };
const tau = Math.PI * 2;
const params = new URLSearchParams(location.search);
const shot = params.get('shot') || '';
let randomState = Number(params.get('seed') || 1);
const random = () => {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 4294967296;
};

const neighborhoods = ['HARBOR', 'DOWNTOWN', 'OLD QUARTER', 'INDUSTRIAL', 'HILLSIDE', 'MARKET', 'SOUTHSIDE', 'TRANSIT'];
const palette = ['#e9b75f', '#61c0c2', '#b6c5d0', '#cf5b55', '#596d88'];
const architecture = [];
for (let row = -5; row <= 5; row += 1) {
  for (let col = -6; col <= 6; col += 1) {
    const district = (Math.abs(col) + Math.abs(row)) % neighborhoods.length;
    architecture.push({ col, row, district, height: 100 + random() * 170, width: 110 + random() * 70, glow: random() });
  }
}

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
const player = {
  x: 0, y: 0, angle: 0, speed: 0, health: 92, armor: 62, ammo: 17,
  ammoByWeapon: [17, 42, 90, 24, 60], cash: 4250, wanted: 0,
  carName: 'ARCLIGHT VELO', job: jobs[0][0], objective: 'Meet Mara Venn at the Meridian underpass',
  step: 0, onFoot: false, reputation: 0, weapon: 0,
};
let missionStates = jobs.map((_, index) => index === 0 ? 'AVAILABLE' : 'LOCKED');
const cars = [];
const walkers = [];
const cruisers = [];
const tracers = [];
for (let i = 0; i < 18; i += 1) cars.push({ x: (random() - .5) * 1600, y: (random() - .5) * 1300, angle: random() * tau, pace: 1.1 + random() * 1.6, color: palette[i % palette.length], kind: i % 5 === 0 ? 'van' : 'sedan' });
for (let i = 0; i < 27; i += 1) walkers.push({ x: (random() - .5) * 1300, y: (random() - .5) * 1100, angle: random() * tau, pace: .35 + random() * .5, color: ['#e8a773', '#6bc2bc', '#d5d2c8', '#dc6b78', '#acb4e4'][i % 5] });
const held = new Set();
let paused = false;
let titleScreen = !shot;
let mapVisible = false;
let journalVisible = false;
let nightTint = shot === 'night';
let clock = 0;
let message = 'MARA VENN  //  The city remembers everything.';
let messageSeconds = 4;
let muzzleSeconds = 0;

function announce(text, duration = 3) {
  message = text;
  messageSeconds = duration;
}

function saveCampaign() {
  localStorage.setItem('nightfall-save', JSON.stringify({
    step: player.step, cash: player.cash, reputation: player.reputation,
    health: player.health, armor: player.armor, missionStates, nightTint,
  }));
  announce('GAME SAVED  //  Vespera remembers.');
}

function selectJob() {
  const current = Math.min(player.step, jobs.length - 1);
  player.job = jobs[current][0];
  player.objective = jobs[current][1];
  missionStates = missionStates.map((_, index) => index < current ? 'COMPLETED' : index === current ? 'ACTIVE' : index === current + 1 ? 'AVAILABLE' : 'LOCKED');
}

function continueCampaign() {
  try {
    const saved = JSON.parse(localStorage.getItem('nightfall-save') || 'null');
    if (!saved) return false;
    player.step = Math.min(jobs.length - 1, saved.step | 0);
    player.cash = saved.cash || 0;
    player.reputation = saved.reputation || 0;
    player.health = saved.health || 92;
    player.armor = saved.armor || 62;
    missionStates = Array.isArray(saved.missionStates) ? saved.missionStates : missionStates;
    nightTint = Boolean(saved.nightTint);
    titleScreen = false;
    selectJob();
    return true;
  } catch {
    return false;
  }
}

function beginCampaign() {
  titleScreen = false;
  selectJob();
}

function completeJob() {
  const current = Math.min(player.step, jobs.length - 1);
  const [name, , payout, rep] = jobs[current];
  player.cash += payout;
  player.reputation += rep;
  player.step += 1;
  player.onFoot = false;
  missionStates[current] = 'COMPLETED';
  selectJob();
  announce(`MISSION COMPLETE  //  ${name}  +$${payout}  •  REP +${rep}`, 4);
}

function interact() {
  if (!player.onFoot) {
    player.onFoot = true;
    player.speed = 0;
    announce('ON FOOT  //  Walk to the marker; E to interact');
    return;
  }
  if (Math.hypot(player.x - 310, player.y + 120) < 78) {
    completeJob();
    return;
  }
  const nearby = cars.find(car => Math.hypot(car.x - player.x, car.y - player.y) < 42);
  if (nearby) {
    player.onFoot = false;
    player.carName = 'KESTREL S9';
    player.wanted = Math.min(5, player.wanted + 1);
    announce('VEHICLE STOLEN  //  Police interest rising');
  }
}

function fireWeapon() {
  if (player.ammoByWeapon[player.weapon] <= 0 || titleScreen) return;
  player.ammoByWeapon[player.weapon] -= 1;
  player.ammo = player.ammoByWeapon[player.weapon];
  muzzleSeconds = .12;
  tracers.push({ x: player.x + Math.cos(player.angle) * 90, y: player.y + Math.sin(player.angle) * 90, life: .35 });
  player.wanted = Math.min(5, Math.max(1, player.wanted));
  announce('DISCHARGE REPORTED  //  Police attention rising', 2.5);
}

function stagePreview() {
  if (shot === 'start') {
    Object.assign(player, { x: 0, y: 0, angle: .14, speed: 2.7, wanted: 0, objective: 'Meet Mara Venn at the Meridian underpass' });
  } else if (shot === 'play') {
    Object.assign(player, { x: 0, y: 0, angle: -.35, speed: 0, wanted: 1, step: 1, job: 'NIGHT SHIFT', objective: 'Recover Elias Rook’s ledger • 38 m' });
    walkers.splice(14);
  } else if (shot === 'chase') {
    Object.assign(player, { x: 0, y: 0, angle: .12, speed: 4.3, wanted: 4, job: 'CROSSTOWN', objective: 'Lose the Vespera Police • break line of sight' });
    for (let i = 0; i < 4; i += 1) cruisers.push({ x: player.x - 180 - i * 105, y: player.y - 160 - i * 48, angle: .3, pace: 3.5 + i * .15 });
  } else if (shot === 'night') {
    Object.assign(player, { x: 0, y: 100, angle: -Math.PI / 2, speed: 0, wanted: 0, objective: 'Vespera City • 01:47 AM  //  Blackwater waterfront' });
  }
}
stagePreview();

function keyDown(event) {
  held.add(event.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (event.code === 'Escape') {
    if (titleScreen) { titleScreen = false; paused = true; }
    else paused = !paused;
  }
  if (event.code === 'KeyM') mapVisible = !mapVisible;
  if (event.code === 'KeyJ') journalVisible = !journalVisible;
  if (event.code === 'KeyE') interact();
  if (event.code === 'KeyR') player.ammo = player.ammoByWeapon[player.weapon];
  if (event.code === 'Digit1') player.carName = 'ARCLIGHT VELO';
  if (event.code === 'Digit2') player.carName = 'KESTREL S9';
  if (event.code === 'Digit3') player.carName = 'ROOK GT';
  if (event.code === 'KeyF') fireWeapon();
  if (event.code === 'KeyQ') { player.weapon = (player.weapon + 1) % player.ammoByWeapon.length; player.ammo = player.ammoByWeapon[player.weapon]; }
  if (event.code === 'KeyK') saveCampaign();
  if (event.code === 'Enter' && titleScreen) {
    if (!continueCampaign()) beginCampaign();
    announce('MARA: Good to have you back, Jace.', 5);
  }
}
window.addEventListener('keydown', keyDown);
window.addEventListener('keyup', event => held.delete(event.code));
canvas.addEventListener('pointerdown', event => {
  if (titleScreen) {
    if (event.offsetY > innerHeight * .47 && event.offsetY < innerHeight * .60 && localStorage.getItem('nightfall-save')) continueCampaign();
    else beginCampaign();
  } else if (event.button === 0) fireWeapon();
});

function fitCanvas() {
  const pixelRatio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * pixelRatio);
  canvas.height = Math.round(innerHeight * pixelRatio);
  context.setTransform(canvas.width / screen.width, 0, 0, canvas.height / screen.height, 0, 0);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function tick(delta) {
  clock += delta;
  messageSeconds = Math.max(0, messageSeconds - delta);
  muzzleSeconds = Math.max(0, muzzleSeconds - delta);
  if (paused || titleScreen) return;
  const steer = Number(held.has('KeyA') || held.has('ArrowLeft')) - Number(held.has('KeyD') || held.has('ArrowRight'));
  const forward = held.has('KeyW') || held.has('ArrowUp');
  const reverse = held.has('KeyS') || held.has('ArrowDown');
  if (player.onFoot) {
    player.angle += steer * delta * 2.5;
    player.x += Math.cos(player.angle) * (Number(forward) - Number(reverse)) * delta * 85;
    player.y += Math.sin(player.angle) * (Number(forward) - Number(reverse)) * delta * 85;
  } else {
    if (forward) player.speed = Math.min(5.2, player.speed + .055);
    else if (reverse) player.speed = Math.max(-1.5, player.speed - .08);
    else player.speed *= .986;
    player.angle += steer * (.032 + Math.min(.035, Math.abs(player.speed) * .007)) * Math.sign(player.speed || 1);
    player.x += Math.cos(player.angle) * player.speed * delta * 48;
    player.y += Math.sin(player.angle) * player.speed * delta * 48;
  }
  for (const car of cars) {
    car.x += Math.cos(car.angle) * car.pace * delta * 42;
    car.y += Math.sin(car.angle) * car.pace * delta * 42;
    if (Math.hypot(car.x - player.x, car.y - player.y) > 1350) {
      car.x = player.x + (random() - .5) * 1600;
      car.y = player.y + (random() - .5) * 1300;
    }
  }
  for (const person of walkers) {
    person.x += Math.cos(person.angle) * person.pace * delta * 24;
    person.y += Math.sin(person.angle) * person.pace * delta * 24;
    if (Math.hypot(person.x - player.x, person.y - player.y) > 1100) {
      person.x = player.x + (random() - .5) * 1300;
      person.y = player.y + (random() - .5) * 1100;
    }
  }
  for (const cop of cruisers) {
    cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.x += Math.cos(cop.angle) * cop.pace * delta * 42;
    cop.y += Math.sin(cop.angle) * cop.pace * delta * 42;
  }
  if (player.wanted && shot !== 'chase' && random() < delta * .08) cruisers.push({ x: player.x - 450, y: player.y - 380, angle: 0, pace: 3.2 });
  if (cruisers.length > 5) cruisers.shift();
  if (!held.has('KeyF') && player.wanted > 0 && shot !== 'chase') player.wanted = Math.max(0, player.wanted - delta * .006);
  for (const tracer of tracers) tracer.life -= delta;
  while (tracers.length && tracers[0].life <= 0) tracers.shift();
}

function roundedRect(x, y, width, height, radius, fill, stroke) {
  context.beginPath(); context.roundRect(x, y, width, height, radius);
  if (fill) { context.fillStyle = fill; context.fill(); }
  if (stroke) { context.strokeStyle = stroke; context.stroke(); }
}
function toScreen(x, y, originX = player.x, originY = player.y) {
  return [screen.width / 2 + (x - originX) * .68, screen.height / 2 + (y - originY) * .68];
}
function text(value, x, y, size, color = '#fff', align = 'left') {
  context.font = `600 ${size}px ui-sans-serif,system-ui`;
  context.fillStyle = color; context.textAlign = align; context.fillText(value, x, y);
}
function card(x, y, width, height) { roundedRect(x, y, width, height, 13, 'rgba(9,15,24,.88)', 'rgba(171,206,215,.19)'); }

function paintStreets() {
  const scale = .68;
  const originX = screen.width / 2 - player.x * scale;
  const originY = screen.height / 2 - player.y * scale;
  context.fillStyle = '#18212b'; context.fillRect(0, 0, screen.width, screen.height);
  context.fillStyle = '#102d3a'; context.fillRect(0, 570, screen.width, 230);
  context.fillStyle = '#24424a';
  for (let pier = 0; pier < 5; pier += 1) context.fillRect(95 + pier * 255, 520, 72, 125);
  for (let line = -8; line <= 8; line += 1) {
    const roadX = originX + line * 220 * scale;
    const roadY = originY + line * 205 * scale;
    context.fillStyle = '#303a43'; context.fillRect(roadX - 33, 0, 66, screen.height); context.fillRect(0, roadY - 32, screen.width, 64);
    context.fillStyle = '#d5b96e'; context.globalAlpha = .48;
    for (let dash = -1; dash < 9; dash += 1) {
      context.fillRect(roadX - 2, dash * 104 + ((clock * 20) % 104), 4, 32);
      context.fillRect(dash * 160 + ((clock * 14) % 160), roadY - 2, 31, 4);
    }
    context.globalAlpha = 1; context.fillStyle = '#58605c';
    for (let mark = 0; mark < 12; mark += 1) { context.fillRect(roadX - 46, mark * 74 + 25, 5, 3); context.fillRect(mark * 96 + 35, roadY + 43, 4, 3); }
  }
}

function paintBuilding(block) {
  const [x, y] = toScreen(block.col * 220, block.row * 205);
  const width = block.width * .68;
  const height = block.height * .68;
  const colors = ['#32404a', '#39434b', '#343949', '#394744', '#3e434b', '#484146', '#343d49', '#343e48'];
  context.fillStyle = 'rgba(0,0,0,.25)'; context.fillRect(x - width / 2 + 13, y - height + 13, width, height);
  context.fillStyle = '#45515a'; context.fillRect(x - width / 2, y - height - 8, width, 10);
  context.fillStyle = colors[block.district]; context.fillRect(x - width / 2, y - height, width, height);
  const rows = Math.max(2, Math.floor(height / 19));
  const columns = Math.max(2, Math.floor(width / 17));
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < columns; col += 1) {
    const glowing = Math.sin((block.col * 13 + col * 5 + row * 7) * 12.3 + block.glow * 20) > -.32;
    if (!glowing) continue;
    context.fillStyle = block.district === 1 ? '#f4c871' : '#eccb8a';
    context.globalAlpha = .23 + ((row + col) % 3) * .12;
    context.fillRect(x - width / 2 + 8 + col * 16, y - height + 12 + row * 18, 5, 8);
  }
  context.globalAlpha = 1;
  if (block.district === 1 && block.col === 0 && block.row === 0) {
    context.fillStyle = '#4fc9cf'; context.fillRect(x - 19, y - height - 25, 38, 18);
    text('VESPERA', x, y - height - 12, 8, '#e8ffff', 'center');
  }
  if (Math.abs(block.col) % 3 === 1 && Math.abs(block.row) % 2 === 0) {
    context.fillStyle = ['#f06e64', '#42c5cb', '#e6b650'][block.district % 3];
    context.fillRect(x - width / 2 + 5, y - height + 38, Math.min(width - 12, 45), 8);
  }
}

function paintCar(x, y, angle, color, kind = 'sedan', size = 1, policeCar = false) {
  const [sx, sy] = toScreen(x, y);
  context.save(); context.translate(sx, sy); context.rotate(angle);
  const length = (kind === 'van' ? 52 : kind === 'bike' ? 33 : 43) * size;
  const breadth = (kind === 'van' ? 25 : 21) * size;
  context.shadowColor = policeCar ? '#57d9ff' : '#000'; context.shadowBlur = policeCar ? 14 : 8;
  roundedRect(-length / 2, -breadth / 2, length, breadth, 6, color, '#111820');
  context.shadowBlur = 0;
  roundedRect(-length * .12, -breadth * .37, length * .42, breadth * .74, 4, policeCar ? '#b9d8df' : '#7eabb2');
  context.fillStyle = '#f8d79a'; context.fillRect(length * .32, -breadth * .33, 4, 5); context.fillRect(length * .32, breadth * .13, 4, 5);
  context.fillStyle = '#e46155'; context.fillRect(-length * .48, -breadth * .32, 3, 5); context.fillRect(-length * .48, breadth * .12, 3, 5);
  if (policeCar) {
    context.fillStyle = '#eef8ff'; context.fillRect(-4, -breadth / 2 - 4, 9, 4);
    context.fillStyle = '#f24d6c'; context.fillRect(-4, -breadth / 2 - 4, 4, 4);
    context.fillStyle = '#55dfff'; context.fillRect(0, -breadth / 2 - 4, 5, 4);
  }
  context.restore();
}
function paintWalker(person) {
  const [x, y] = toScreen(person.x, person.y);
  context.fillStyle = 'rgba(0,0,0,.32)'; context.beginPath(); context.ellipse(x, y + 4, 5, 3, 0, 0, tau); context.fill();
  context.fillStyle = person.color; context.beginPath(); context.arc(x, y - 4, 4, 0, tau); context.fill(); context.fillRect(x - 3, y, 6, 10);
}
function paintMarker(x, y, color, caption) {
  const [sx, sy] = toScreen(x, y);
  const pulse = 1 + Math.sin(clock * 4) * .08;
  context.strokeStyle = color; context.lineWidth = 2; context.beginPath(); context.arc(sx, sy, 21 * pulse, 0, tau); context.stroke();
  context.fillStyle = color; context.globalAlpha = .18; context.beginPath(); context.arc(sx, sy, 15, 0, tau); context.fill(); context.globalAlpha = 1;
  text(caption, sx, sy - 28, 10, color, 'center');
}

function paintMinimap() {
  const left = screen.width - 164; const top = 48; const size = 132;
  card(left - 10, top - 10, size + 20, size + 50);
  context.save(); context.beginPath(); context.roundRect(left, top, size, size, 8); context.clip();
  context.fillStyle = '#14232c'; context.fillRect(left, top, size, size);
  context.strokeStyle = '#52616a'; context.lineWidth = 5;
  for (let road = 0; road < 5; road += 1) {
    context.beginPath(); context.moveTo(left + road * 37 - 12, top); context.lineTo(left + road * 37 + 18, top + size); context.stroke();
    context.beginPath(); context.moveTo(left, top + road * 36); context.lineTo(left + size, top + road * 36 - 15); context.stroke();
  }
  context.fillStyle = '#f0bc5e'; context.beginPath(); context.arc(left + size / 2 + (310 - player.x) * .07, top + size / 2 + (-120 - player.y) * .07, 4, 0, tau); context.fill();
  context.fillStyle = '#ff5568';
  for (const cop of cruisers) { context.beginPath(); context.arc(left + size / 2 + (cop.x - player.x) * .07, top + size / 2 + (cop.y - player.y) * .07, 3, 0, tau); context.fill(); }
  context.translate(left + size / 2, top + size / 2); context.rotate(player.angle); context.fillStyle = '#75f4e2';
  context.beginPath(); context.moveTo(0, -8); context.lineTo(6, 7); context.lineTo(0, 4); context.lineTo(-6, 7); context.closePath(); context.fill(); context.restore();
  text('VESPERA  /  GRID', left, top + size + 23, 9, '#9baeb6');
}

function paintHud() {
  card(25, 22, 315, 96); text('NIGHTFALL', 44, 52, 12, '#66d7d5'); text('DISTRICT ZERO', 44, 70, 10, '#d5e3e8');
  text(`$${player.cash.toLocaleString()}`, 321, 52, 15, '#e6c47f', 'right'); text('JACE MERCER', 44, 101, 11, '#b4c1c7');
  text(`VESPERA • ${neighborhoods[(Math.floor(Math.abs(player.x) / 450) + Math.floor(Math.abs(player.y) / 390)) % neighborhoods.length]}`, 183, 101, 10, '#8fa3ab');
  card(25, screen.height - 121, 340, 93); text(player.job, 44, screen.height - 90, 12, '#70ddda');
  text(`◈  ${player.objective}`, 44, screen.height - 66, 12, '#edf2ee'); text('J  JOURNAL', 44, screen.height - 43, 9, '#85969f');
  card(screen.width / 2 - 158, screen.height - 70, 316, 43); text('W  DRIVE', screen.width / 2 - 137, screen.height - 44, 10, '#a5b3bb');
  text('A D  STEER', screen.width / 2 - 50, screen.height - 44, 10, '#a5b3bb'); text('E  INTERACT', screen.width / 2 + 48, screen.height - 44, 10, '#a5b3bb');
  card(screen.width - 195, screen.height - 110, 171, 78); text('HEALTH', screen.width - 178, screen.height - 83, 9, '#a6b2ba');
  roundedRect(screen.width - 125, screen.height - 92, 84, 8, 4, '#36414a'); roundedRect(screen.width - 125, screen.height - 92, 84 * player.health / 100, 8, 4, '#d86166');
  text('ARMOR', screen.width - 178, screen.height - 61, 9, '#a6b2ba'); roundedRect(screen.width - 125, screen.height - 70, 84, 8, 4, '#36414a');
  roundedRect(screen.width - 125, screen.height - 70, 84 * player.armor / 100, 8, 4, '#58b9bf');
  card(screen.width - 190, screen.height - 206, 166, 73); text(player.carName, screen.width - 174, screen.height - 181, 10, '#e6c57e');
  text(`${Math.round(Math.abs(player.speed) * 31)} KM/H`, screen.width - 174, screen.height - 154, 16, '#f1f5f5');
  text(`▣  ${player.ammo} / 68`, screen.width - 174, screen.height - 136, 9, '#9cabb1'); text('VE', screen.width - 181, 233, 10, '#a9bbc1');
  for (let star = 0; star < 5; star += 1) text('★', screen.width - 153 + star * 23, 235, 17, star < player.wanted ? '#f3c866' : '#46515a');
  if (player.wanted > 0) text(player.wanted >= 4 ? 'POLICE RESPONSE  •  BREAK LINE OF SIGHT' : 'POLICE INTEREST', screen.width - 194, 257, 8, '#f28d85');
  paintMinimap();
  if (messageSeconds > 0) { card(screen.width / 2 - 223, 26, 446, 42); text(message, screen.width / 2, 53, 11, '#e6d3a2', 'center'); }
}

function paintTitle() {
  context.fillStyle = 'rgba(5,10,17,.68)'; context.fillRect(0, 0, screen.width, screen.height);
  context.save(); context.translate(82, 191); context.fillStyle = '#6ee1dc'; context.fillRect(0, 0, 4, 140);
  text('NIGHTFALL', 25, 25, 14, '#81e7dd'); text('DISTRICT', 25, 86, 48, '#f5f3e9'); text('ZERO', 25, 143, 54, '#f3cb75');
  text('THE CITY REMEMBERS EVERYTHING.', 26, 181, 13, '#bfccd0'); card(22, 222, 356, 202);
  text('NEW GAME', 45, 264, 15); text(`${localStorage.getItem('nightfall-save') ? 'CONTINUE  •  SAVED CAMPAIGN' : 'CONTINUE  •  NO SAVE YET'}`, 45, 302, 13, '#a9b8be');
  text(`SETTINGS  •  AUDIO ${localStorage.getItem('nightfall-muted') === '1' ? 'OFF' : 'ON'}`, 45, 340, 13, '#a9b8be');
  text('CONTROLS  •  WASD / E / F / J / M', 45, 378, 13, '#a9b8be'); text('ENTER  NEW GAME     C  CONTINUE', 26, 461, 10, '#70d5d2'); context.restore();
}

function paintMap() {
  context.fillStyle = 'rgba(3,8,14,.86)'; context.fillRect(0, 0, screen.width, screen.height);
  text('VESPERA CITY', screen.width / 2, 85, 25, '#e7c475', 'center'); text('DISTRICT ATLAS  /  M', screen.width / 2, 111, 10, '#9baeb3', 'center');
  context.strokeStyle = '#53646b'; context.lineWidth = 21;
  for (let route = 0; route < 7; route += 1) {
    context.beginPath(); context.moveTo(310 + route * 105, 190); context.lineTo(390 + route * 60, 615); context.stroke();
    context.beginPath(); context.moveTo(255, 240 + route * 53); context.lineTo(1025, 210 + route * 48); context.stroke();
  }
  neighborhoods.forEach((name, index) => text(name, 330 + (index % 4) * 178, 300 + Math.floor(index / 4) * 180, 11, '#d5dedc', 'center'));
  context.fillStyle = '#64eee0'; context.beginPath(); context.arc(screen.width / 2, screen.height / 2, 8, 0, tau); context.fill();
  text('JACE', screen.width / 2 + 17, screen.height / 2 + 5, 10); text('ESC  CLOSE', screen.width / 2, screen.height - 84, 10, '#91a5ac', 'center');
}

function paintJournal() {
  context.fillStyle = 'rgba(3,8,14,.8)'; context.fillRect(0, 0, screen.width, screen.height);
  card(screen.width / 2 - 260, screen.height / 2 - 220, 520, 440);
  text(paused ? 'PAUSED  •  ESC RESUME' : 'MISSION JOURNAL  •  J CLOSE', screen.width / 2, screen.height / 2 - 177, 21, '#ead08d', 'center');
  jobs.forEach((job, index) => {
    const state = missionStates[index];
    text(`${state}   ${job[0]}`, screen.width / 2 - 220, screen.height / 2 - 128 + index * 35, 11, state === 'ACTIVE' ? '#70ddda' : state === 'COMPLETED' ? '#e6c47f' : '#92a1a8');
    text(job[1], screen.width / 2 - 90, screen.height / 2 - 128 + index * 35, 10, '#c6d0d1');
  });
  if (paused) text('M MAP  •  J MISSIONS  •  K SAVE  •  ESC RESUME', screen.width / 2, screen.height / 2 + 187, 10, '#70d5d2', 'center');
}

function render() {
  paintStreets();
  for (const building of architecture) {
    if (Math.abs(building.col * 220 - player.x) < 1050 && Math.abs(building.row * 205 - player.y) < 900) paintBuilding(building);
  }
  paintMarker(310, -120, '#f1bd61', jobs[Math.min(player.step, jobs.length - 1)][0]);
  for (const car of cars) paintCar(car.x, car.y, car.angle, car.color, car.kind, .88);
  walkers.forEach(paintWalker);
  for (const tracer of tracers) { const [x, y] = toScreen(tracer.x, tracer.y); context.fillStyle = '#f8d46c'; context.beginPath(); context.arc(x, y, 3, 0, tau); context.fill(); }
  cruisers.forEach(cop => paintCar(cop.x, cop.y, cop.angle, '#d8e0e0', 'sedan', 1.05, true));
  if (player.onFoot) paintWalker({ x: player.x, y: player.y, color: '#65e1d7' });
  else paintCar(player.x, player.y, player.angle, player.carName === 'ROOK GT' ? '#d36657' : player.carName === 'KESTREL S9' ? '#557f91' : '#c9a664', 'sedan', 1.14);
  const shade = context.createRadialGradient(screen.width / 2, screen.height / 2, 150, screen.width / 2, screen.height / 2, 690);
  shade.addColorStop(0, 'rgba(3,8,15,0)'); shade.addColorStop(1, 'rgba(3,8,15,.4)'); context.fillStyle = shade; context.fillRect(0, 0, screen.width, screen.height);
  if (nightTint) { context.fillStyle = 'rgba(5,12,34,.16)'; context.fillRect(0, 0, screen.width, screen.height); }
  paintHud();
  if (titleScreen) paintTitle();
  if (mapVisible) paintMap();
  if ((journalVisible || paused) && !titleScreen) paintJournal();
}

let previous = performance.now();
let previewFrames = 0;
function animate(now) {
  const delta = Math.min(.04, (now - previous) / 1000);
  previous = now;
  if (shot) {
    clock += delta;
    for (const car of cars) { car.x += Math.cos(car.angle) * car.pace * delta * 42; car.y += Math.sin(car.angle) * car.pace * delta * 42; }
    for (const person of walkers) { person.x += Math.cos(person.angle) * person.pace * delta * 24; person.y += Math.sin(person.angle) * person.pace * delta * 24; }
    for (const cop of cruisers) { cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x); cop.x += Math.cos(cop.angle) * cop.pace * delta * 42; cop.y += Math.sin(cop.angle) * cop.pace * delta * 42; }
    if (++previewFrames === 3) window.__shotReady = true;
  } else tick(delta);
  render();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
