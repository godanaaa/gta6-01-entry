// NIGHTFALL: DISTRICT ZERO is a small, offline story about returning to Vespera.
// Canvas shapes supply the whole scene, so a static file server is all it needs.

const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');
const viewport = { width: 1280, height: 800 };
const fullTurn = Math.PI * 2;
const query = new URLSearchParams(location.search);
const previewName = query.get('shot') || '';
let randomSeed = Number(query.get('seed') || 1);

function nextRandom() {
  randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
  return randomSeed / 4294967296;
}

const districtNames = ['HARBOR', 'DOWNTOWN', 'OLD QUARTER', 'INDUSTRIAL', 'HILLSIDE', 'MARKET', 'SOUTHSIDE', 'TRANSIT'];
const buildingColors = ['#35424b', '#393c49', '#3d4546', '#4a4141', '#384552', '#484146', '#34414a', '#39454b'];
const chapters = [
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
  x: 0, y: 0, angle: 0, speed: 0, health: 92, armor: 62,
  rounds: 17, magazines: [17, 42, 90, 24, 60], cash: 4250,
  wanted: 0, vehicle: 'ARCLIGHT VELO', mission: chapters[0][0],
  objective: 'Meet Mara Venn at the Meridian underpass', chapter: 0,
  onFoot: false, reputation: 0, weapon: 0,
};
const city = [];
const traffic = [];
const pedestrians = [];
const police = [];
const shotEffects = [];
const trafficColors = ['#e9b75f', '#61c0c2', '#b6c5d0', '#cf5b55', '#596d88'];
const pedestrianColors = ['#e8a773', '#6bc2bc', '#d5d2c8', '#dc6b78', '#acb4e4'];

for (let gridY = -5; gridY <= 5; gridY += 1) {
  for (let gridX = -6; gridX <= 6; gridX += 1) {
    city.push({
      col: gridX,
      row: gridY,
      district: (Math.abs(gridX) + Math.abs(gridY)) % 8,
      height: 100 + nextRandom() * 170,
      width: 110 + nextRandom() * 70,
      shimmer: nextRandom(),
    });
  }
}
for (let index = 0; index < 18; index += 1) {
  traffic.push({
    x: (nextRandom() - 0.5) * 1600,
    y: (nextRandom() - 0.5) * 1300,
    heading: nextRandom() * fullTurn,
    pace: 1.1 + nextRandom() * 1.6,
    paint: trafficColors[index % trafficColors.length],
    kind: index % 5 === 0 ? 'van' : 'sedan',
  });
}
for (let index = 0; index < 27; index += 1) {
  pedestrians.push({
    x: (nextRandom() - 0.5) * 1300,
    y: (nextRandom() - 0.5) * 1100,
    heading: nextRandom() * fullTurn,
    pace: 0.35 + nextRandom() * 0.5,
    shirt: pedestrianColors[index % pedestrianColors.length],
  });
}

let pressedKeys = new Set();
let isPaused = false;
let showTitle = !previewName;
let showMap = false;
let showJournal = false;
let nightPalette = previewName === 'night';
let elapsedSeconds = 0;
let bannerText = 'MARA VENN  //  The city remembers everything.';
let bannerSeconds = 4;
let muzzleFlashSeconds = 0;
let missionStatuses = chapters.map((_, index) => index === 0 ? 'AVAILABLE' : 'LOCKED');

function announce(message, seconds = 3) {
  bannerText = message;
  bannerSeconds = seconds;
}

function refreshChapter() {
  const activeChapter = Math.min(player.chapter, chapters.length - 1);
  player.mission = chapters[activeChapter][0];
  player.objective = chapters[activeChapter][1];
  missionStatuses = missionStatuses.map((_, index) => {
    if (index < activeChapter) return 'COMPLETED';
    if (index === activeChapter) return 'ACTIVE';
    if (index === activeChapter + 1) return 'AVAILABLE';
    return 'LOCKED';
  });
}

function saveProgress() {
  const record = {
    chapter: player.chapter,
    cash: player.cash,
    reputation: player.reputation,
    health: player.health,
    armor: player.armor,
    missionStates: missionStatuses,
    isNight: nightPalette,
  };
  localStorage.setItem('nightfall-save', JSON.stringify(record));
  announce('GAME SAVED  //  Vespera remembers.');
}

function loadProgress() {
  try {
    const record = JSON.parse(localStorage.getItem('nightfall-save') || 'null');
    if (!record) return false;
    player.chapter = Math.min(chapters.length - 1, record.chapter | 0);
    player.cash = record.cash || 0;
    player.reputation = record.reputation || 0;
    player.health = record.health || 92;
    player.armor = record.armor || 62;
    missionStatuses = Array.isArray(record.missionStates) ? record.missionStates : missionStatuses;
    nightPalette = Boolean(record.isNight);
    showTitle = false;
    refreshChapter();
    return true;
  } catch {
    return false;
  }
}

function startCampaign() {
  showTitle = false;
  refreshChapter();
}

function finishChapter() {
  const stage = Math.min(player.chapter, chapters.length - 1);
  const [chapterName, , payment, renown] = chapters[stage];
  player.cash += payment;
  player.reputation += renown;
  player.chapter += 1;
  player.onFoot = false;
  missionStatuses[stage] = 'COMPLETED';
  refreshChapter();
  announce(`MISSION COMPLETE  //  ${chapterName}  +$${payment}  •  REP +${renown}`, 4);
}

function useInteraction() {
  if (!player.onFoot) {
    player.onFoot = true;
    player.speed = 0;
    announce('ON FOOT  //  Walk to the marker; E to interact');
    return;
  }
  if (Math.hypot(player.x - 310, player.y + 120) < 78) {
    finishChapter();
    return;
  }
  const nearbyCar = traffic.some((car) => Math.hypot(car.x - player.x, car.y - player.y) < 42);
  if (nearbyCar) {
    player.onFoot = false;
    player.vehicle = 'KESTREL S9';
    player.wanted = Math.min(5, player.wanted + 1);
    announce('VEHICLE STOLEN  //  Police interest rising');
  }
}

function fireCurrentWeapon() {
  if (player.magazines[player.weapon] < 1 || showTitle) return;
  player.magazines[player.weapon] -= 1;
  player.rounds = player.magazines[player.weapon];
  muzzleFlashSeconds = 0.12;
  shotEffects.push({
    x: player.x + Math.cos(player.angle) * 90,
    y: player.y + Math.sin(player.angle) * 90,
    remaining: 0.35,
  });
  player.wanted = Math.min(5, Math.max(1, player.wanted));
  announce('DISCHARGE REPORTED  //  Police attention rising', 2.5);
}

function configurePreviewScene() {
  if (previewName === 'start') {
    Object.assign(player, { x: 0, y: 0, angle: 0.14, speed: 2.7, wanted: 0, objective: 'Meet Mara Venn at the Meridian underpass' });
  }
  if (previewName === 'play') {
    Object.assign(player, { angle: -0.35, speed: 0, wanted: 1, chapter: 1, mission: 'NIGHT SHIFT', objective: 'Recover Elias Rook’s ledger • 38 m' });
    pedestrians.splice(14);
  }
  if (previewName === 'chase') {
    Object.assign(player, { angle: 0.12, speed: 4.3, wanted: 4, mission: 'CROSSTOWN', objective: 'Lose the Vespera Police • break line of sight' });
    for (let unit = 0; unit < 4; unit += 1) {
      police.push({ x: -180 - unit * 105, y: -160 - unit * 48, heading: 0.3, pace: 3.5 + unit * 0.15 });
    }
  }
  if (previewName === 'night') {
    Object.assign(player, { y: 100, angle: -Math.PI / 2, speed: 0, wanted: 0, objective: 'Vespera City • 01:47 AM  //  Blackwater waterfront' });
  }
}
configurePreviewScene();

function onKeyDown(event) {
  pressedKeys.add(event.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (event.code === 'Escape') {
    if (showTitle) {
      showTitle = false;
      isPaused = true;
    } else {
      isPaused = !isPaused;
    }
  }
  if (event.code === 'KeyM') showMap = !showMap;
  if (event.code === 'KeyJ') showJournal = !showJournal;
  if (event.code === 'KeyE') useInteraction();
  if (event.code === 'KeyR') player.rounds = player.magazines[player.weapon];
  if (event.code === 'Digit1') player.vehicle = 'ARCLIGHT VELO';
  if (event.code === 'Digit2') player.vehicle = 'KESTREL S9';
  if (event.code === 'Digit3') player.vehicle = 'ROOK GT';
  if (event.code === 'KeyF') fireCurrentWeapon();
  if (event.code === 'KeyQ') {
    player.weapon = (player.weapon + 1) % player.magazines.length;
    player.rounds = player.magazines[player.weapon];
  }
  if (event.code === 'KeyK') saveProgress();
  if (event.code === 'Enter' && showTitle) {
    if (!loadProgress()) startCampaign();
    announce('MARA: Good to have you back, Jace.', 5);
  }
}
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', (event) => pressedKeys.delete(event.code));
canvas.addEventListener('pointerdown', (event) => {
  if (showTitle) {
    const continueBand = event.offsetY > innerHeight * 0.47 && event.offsetY < innerHeight * 0.60;
    if (continueBand && localStorage.getItem('nightfall-save')) loadProgress();
    else startCampaign();
  } else if (event.button === 0) {
    fireCurrentWeapon();
  }
});

function fitCanvas() {
  const pixelRatio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * pixelRatio);
  canvas.height = Math.round(innerHeight * pixelRatio);
  context.setTransform(canvas.width / viewport.width, 0, 0, canvas.height / viewport.height, 0, 0);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function updateFrame(seconds) {
  elapsedSeconds += seconds;
  bannerSeconds = Math.max(0, bannerSeconds - seconds);
  muzzleFlashSeconds = Math.max(0, muzzleFlashSeconds - seconds);
  if (isPaused || showTitle) return;

  const turnInput = Number(pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft'))
    - Number(pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight'));
  const accelerating = pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp');
  const reversing = pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown');

  if (player.onFoot) {
    player.angle += turnInput * seconds * 2.5;
    const walkingDirection = Number(accelerating) - Number(reversing);
    player.x += Math.cos(player.angle) * walkingDirection * seconds * 85;
    player.y += Math.sin(player.angle) * walkingDirection * seconds * 85;
  } else {
    if (accelerating) player.speed = Math.min(5.2, player.speed + 0.055);
    else if (reversing) player.speed = Math.max(-1.5, player.speed - 0.08);
    else player.speed *= 0.986;
    const steeringGain = 0.032 + Math.min(0.035, Math.abs(player.speed) * 0.007);
    player.angle += turnInput * steeringGain * Math.sign(player.speed || 1);
    player.x += Math.cos(player.angle) * player.speed * seconds * 48;
    player.y += Math.sin(player.angle) * player.speed * seconds * 48;
  }

  moveCityLife(seconds);
  followPlayer(seconds);
  if (player.wanted && previewName !== 'chase' && nextRandom() < seconds * 0.08) {
    police.push({ x: player.x - 450, y: player.y - 380, heading: 0, pace: 3.2 });
  }
  if (police.length > 5) police.shift();
  if (!pressedKeys.has('KeyF') && player.wanted && previewName !== 'chase') {
    player.wanted = Math.max(0, player.wanted - seconds * 0.006);
  }
  ageShotEffects(seconds);
}

function moveCityLife(seconds) {
  for (const car of traffic) {
    car.x += Math.cos(car.heading) * car.pace * seconds * 42;
    car.y += Math.sin(car.heading) * car.pace * seconds * 42;
    if (Math.hypot(car.x - player.x, car.y - player.y) > 1350) {
      car.x = player.x + (nextRandom() - 0.5) * 1600;
      car.y = player.y + (nextRandom() - 0.5) * 1300;
    }
  }
  for (const person of pedestrians) {
    person.x += Math.cos(person.heading) * person.pace * seconds * 24;
    person.y += Math.sin(person.heading) * person.pace * seconds * 24;
    if (Math.hypot(person.x - player.x, person.y - player.y) > 1100) {
      person.x = player.x + (nextRandom() - 0.5) * 1300;
      person.y = player.y + (nextRandom() - 0.5) * 1100;
    }
  }
}

function followPlayer(seconds) {
  for (const patrol of police) {
    patrol.heading = Math.atan2(player.y - patrol.y, player.x - patrol.x);
    patrol.x += Math.cos(patrol.heading) * patrol.pace * seconds * 42;
    patrol.y += Math.sin(patrol.heading) * patrol.pace * seconds * 42;
  }
}

function ageShotEffects(seconds) {
  for (const effect of shotEffects) effect.remaining -= seconds;
  while (shotEffects.length && shotEffects[0].remaining <= 0) shotEffects.shift();
}

function drawPanel(x, y, width, height, radius = 12, fill = 'rgba(9,15,24,.88)', border = 'rgba(171,206,215,.19)') {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  if (fill) {
    context.fillStyle = fill;
    context.fill();
  }
  if (border) {
    context.strokeStyle = border;
    context.stroke();
  }
}

function drawText(label, x, y, size, color = '#fff', alignment = 'left') {
  context.font = `600 ${size}px ui-sans-serif,system-ui`;
  context.fillStyle = color;
  context.textAlign = alignment;
  context.fillText(label, x, y);
}

function worldToCanvas(worldX, worldY) {
  return [640 + (worldX - player.x) * 0.68, 400 + (worldY - player.y) * 0.68];
}

function paintRoadGrid() {
  const zoom = 0.68;
  const originX = 640 - player.x * zoom;
  const originY = 400 - player.y * zoom;
  context.fillStyle = '#18212b';
  context.fillRect(0, 0, viewport.width, viewport.height);
  context.fillStyle = '#102d3a';
  context.fillRect(0, 570, viewport.width, 230);
  context.fillStyle = '#24424a';
  for (let pier = 0; pier < 5; pier += 1) context.fillRect(95 + pier * 255, 520, 72, 125);

  for (let block = -8; block <= 8; block += 1) {
    const verticalRoad = originX + block * 220 * zoom;
    const horizontalRoad = originY + block * 205 * zoom;
    context.fillStyle = '#303a43';
    context.fillRect(verticalRoad - 33, 0, 66, viewport.height);
    context.fillRect(0, horizontalRoad - 32, viewport.width, 64);
    context.fillStyle = '#d5b96e';
    context.globalAlpha = 0.48;
    for (let dash = -1; dash < 9; dash += 1) {
      context.fillRect(verticalRoad - 2, dash * 104 + (elapsedSeconds * 20) % 104, 4, 32);
      context.fillRect(dash * 160 + (elapsedSeconds * 14) % 160, horizontalRoad - 2, 31, 4);
    }
    context.globalAlpha = 1;
    context.fillStyle = '#58605c';
    for (let marker = 0; marker < 12; marker += 1) {
      context.fillRect(verticalRoad - 46, marker * 74 + 25, 5, 3);
      context.fillRect(marker * 96 + 35, horizontalRoad + 43, 4, 3);
    }
  }
}

function paintBuilding(building) {
  const [centerX, centerY] = worldToCanvas(building.col * 220, building.row * 205);
  const width = building.width * 0.68;
  const height = building.height * 0.68;
  context.fillStyle = 'rgba(0,0,0,.25)';
  context.fillRect(centerX - width / 2 + 13, centerY - height + 13, width, height);
  context.fillStyle = '#45515a';
  context.fillRect(centerX - width / 2, centerY - height - 8, width, 10);
  context.fillStyle = buildingColors[building.district];
  context.fillRect(centerX - width / 2, centerY - height, width, height);

  const windowRows = Math.max(2, Math.floor(height / 19));
  const windowColumns = Math.max(2, Math.floor(width / 17));
  for (let row = 0; row < windowRows; row += 1) {
    for (let column = 0; column < windowColumns; column += 1) {
      const lightPattern = Math.sin((building.col * 13 + column * 5 + row * 7) * 12.3 + building.shimmer * 20);
      if (lightPattern <= -0.32) continue;
      context.fillStyle = building.district === 1 ? '#f4c871' : '#eccb8a';
      context.globalAlpha = 0.23 + ((row + column) % 3) * 0.12;
      context.fillRect(centerX - width / 2 + 8 + column * 16, centerY - height + 12 + row * 18, 5, 8);
    }
  }
  context.globalAlpha = 1;

  if (building.district === 1 && building.col === 0 && building.row === 0) {
    context.fillStyle = '#4fc9cf';
    context.fillRect(centerX - 19, centerY - height - 25, 38, 18);
    drawText('VESPERA', centerX, centerY - height - 12, 8, '#e8ffff', 'center');
  }
  const getsSign = Math.abs(building.col) % 3 === 1 && Math.abs(building.row) % 2 === 0;
  if (getsSign) {
    const signColors = ['#f06e64', '#42c5cb', '#e6b650'];
    context.fillStyle = signColors[building.district % signColors.length];
    context.fillRect(centerX - width / 2 + 5, centerY - height + 38, Math.min(width - 12, 45), 8);
  }
}

function paintCar(worldX, worldY, direction, color, shape = 'sedan', scale = 1, isPolice = false) {
  const [pixelX, pixelY] = worldToCanvas(worldX, worldY);
  context.save();
  context.translate(pixelX, pixelY);
  context.rotate(direction);
  const bodyLength = (shape === 'van' ? 52 : shape === 'bike' ? 33 : 43) * scale;
  const bodyWidth = (shape === 'van' ? 25 : 21) * scale;
  context.shadowColor = isPolice ? '#57d9ff' : '#000';
  context.shadowBlur = isPolice ? 14 : 8;
  drawPanel(-bodyLength / 2, -bodyWidth / 2, bodyLength, bodyWidth, 6, color, '#111820');
  context.shadowBlur = 0;
  drawPanel(-bodyLength * 0.12, -bodyWidth * 0.37, bodyLength * 0.42, bodyWidth * 0.74, 4, isPolice ? '#b9d8df' : '#7eabb2', null);
  context.fillStyle = '#f8d79a';
  context.fillRect(bodyLength * 0.32, -bodyWidth * 0.33, 4, 5);
  context.fillRect(bodyLength * 0.32, bodyWidth * 0.13, 4, 5);
  context.fillStyle = '#e46155';
  context.fillRect(-bodyLength * 0.48, -bodyWidth * 0.32, 3, 5);
  context.fillRect(-bodyLength * 0.48, bodyWidth * 0.12, 3, 5);
  if (isPolice) {
    context.fillStyle = '#f24d6c';
    context.fillRect(-4, -bodyWidth / 2 - 4, 4, 4);
    context.fillStyle = '#55dfff';
    context.fillRect(0, -bodyWidth / 2 - 4, 5, 4);
  }
  context.restore();
}

function paintPedestrian(person) {
  const [pixelX, pixelY] = worldToCanvas(person.x, person.y);
  context.fillStyle = 'rgba(0,0,0,.32)';
  context.beginPath();
  context.ellipse(pixelX, pixelY + 4, 5, 3, 0, 0, fullTurn);
  context.fill();
  context.fillStyle = person.shirt;
  context.beginPath();
  context.arc(pixelX, pixelY - 4, 4, 0, fullTurn);
  context.fill();
  context.fillRect(pixelX - 3, pixelY, 6, 10);
}

function paintMarker(worldX, worldY, color, caption) {
  const [pixelX, pixelY] = worldToCanvas(worldX, worldY);
  const pulse = 1 + Math.sin(elapsedSeconds * 4) * 0.08;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(pixelX, pixelY, 21 * pulse, 0, fullTurn);
  context.stroke();
  context.fillStyle = color;
  context.globalAlpha = 0.18;
  context.beginPath();
  context.arc(pixelX, pixelY, 15, 0, fullTurn);
  context.fill();
  context.globalAlpha = 1;
  drawText(caption, pixelX, pixelY - 28, 10, color, 'center');
}

function paintMinimap() {
  const left = 1106;
  const top = 48;
  const mapSize = 132;
  drawPanel(left - 10, top - 10, mapSize + 20, mapSize + 50);
  context.save();
  context.beginPath();
  context.roundRect(left, top, mapSize, mapSize, 8);
  context.clip();
  context.fillStyle = '#14232c';
  context.fillRect(left, top, mapSize, mapSize);
  context.strokeStyle = '#52616a';
  context.lineWidth = 5;
  for (let road = 0; road < 5; road += 1) {
    context.beginPath();
    context.moveTo(left + road * 37 - 12, top);
    context.lineTo(left + road * 37 + 18, top + mapSize);
    context.stroke();
    context.beginPath();
    context.moveTo(left, top + road * 36);
    context.lineTo(left + mapSize, top + road * 36 - 15);
    context.stroke();
  }
  context.fillStyle = '#f0bc5e';
  context.beginPath();
  context.arc(left + 66 + (310 - player.x) * 0.07, top + 66 + (-120 - player.y) * 0.07, 4, 0, fullTurn);
  context.fill();
  context.fillStyle = '#ff5568';
  for (const patrol of police) {
    context.beginPath();
    context.arc(left + 66 + (patrol.x - player.x) * 0.07, top + 66 + (patrol.y - player.y) * 0.07, 3, 0, fullTurn);
    context.fill();
  }
  context.translate(left + 66, top + 66);
  context.rotate(player.angle);
  context.fillStyle = '#75f4e2';
  context.beginPath();
  context.moveTo(0, -8);
  context.lineTo(6, 7);
  context.lineTo(0, 4);
  context.lineTo(-6, 7);
  context.closePath();
  context.fill();
  context.restore();
  drawText('VESPERA  /  GRID', left, top + mapSize + 23, 9, '#9baeb6');
}

function paintHud() {
  drawPanel(25, 22, 315, 96);
  drawText('NIGHTFALL', 44, 52, 12, '#66d7d5');
  drawText('DISTRICT ZERO', 44, 70, 10, '#d5e3e8');
  drawText(`$${player.cash.toLocaleString()}`, 321, 52, 15, '#e6c47f', 'right');
  drawText('JACE MERCER', 44, 101, 11, '#b4c1c7');
  const wardIndex = (Math.floor(Math.abs(player.x) / 450) + Math.floor(Math.abs(player.y) / 390)) % districtNames.length;
  drawText(`VESPERA • ${districtNames[wardIndex]}`, 183, 101, 10, '#8fa3ab');

  drawPanel(25, 679, 340, 93);
  drawText(player.mission, 44, 710, 12, '#70ddda');
  drawText(`◈  ${player.objective}`, 44, 734, 12, '#edf2ee');
  drawText('J  JOURNAL', 44, 757, 9, '#85969f');
  drawPanel(482, 730, 316, 43);
  drawText('W  DRIVE', 503, 756, 10, '#a5b3bb');
  drawText('A D  STEER', 590, 756, 10, '#a5b3bb');
  drawText('E  INTERACT', 690, 756, 10, '#a5b3bb');

  drawPanel(1085, 690, 171, 78);
  drawText('HEALTH', 1102, 717, 9, '#a6b2ba');
  drawPanel(1155, 708, 84, 8, 4, '#36414a', null);
  drawPanel(1155, 708, 84 * player.health / 100, 8, 4, '#d86166', null);
  drawText('ARMOR', 1102, 739, 9, '#a6b2ba');
  drawPanel(1155, 730, 84, 8, 4, '#36414a', null);
  drawPanel(1155, 730, 84 * player.armor / 100, 8, 4, '#58b9bf', null);
  drawPanel(1090, 594, 166, 73);
  drawText(player.vehicle, 1106, 619, 10, '#e6c57e');
  drawText(`${Math.round(Math.abs(player.speed) * 31)} KM/H`, 1106, 646, 16, '#f1f5f5');
  drawText(`▣  ${player.rounds} / 68`, 1106, 664, 9, '#9cabb1');
  drawText('VE', 1099, 233, 10, '#a9bbc1');
  for (let star = 0; star < 5; star += 1) {
    drawText('★', 1127 + star * 23, 235, 17, star < player.wanted ? '#f3c866' : '#46515a');
  }
  if (player.wanted) {
    const responseText = player.wanted >= 4 ? 'POLICE RESPONSE  •  BREAK LINE OF SIGHT' : 'POLICE INTEREST';
    drawText(responseText, 1086, 257, 8, '#f28d85');
  }
  paintMinimap();
  if (bannerSeconds > 0) {
    drawPanel(417, 26, 446, 42);
    drawText(bannerText, 640, 53, 11, '#e6d3a2', 'center');
  }
}

function paintTitleScreen() {
  context.fillStyle = 'rgba(5,10,17,.68)';
  context.fillRect(0, 0, viewport.width, viewport.height);
  context.save();
  context.translate(82, 191);
  context.fillStyle = '#6ee1dc';
  context.fillRect(0, 0, 4, 140);
  drawText('NIGHTFALL', 25, 25, 14, '#81e7dd');
  drawText('DISTRICT', 25, 86, 48, '#f5f3e9');
  drawText('ZERO', 25, 143, 54, '#f3cb75');
  drawText('THE CITY REMEMBERS EVERYTHING.', 26, 181, 13, '#bfccd0');
  drawPanel(22, 222, 356, 202);
  drawText('NEW GAME', 45, 264, 15);
  const savedCopy = localStorage.getItem('nightfall-save') ? 'CONTINUE  •  SAVED CAMPAIGN' : 'CONTINUE  •  NO SAVE YET';
  drawText(savedCopy, 45, 302, 13, '#a9b8be');
  const audioCopy = localStorage.getItem('nightfall-muted') === '1' ? 'OFF' : 'ON';
  drawText(`SETTINGS  •  AUDIO ${audioCopy}`, 45, 340, 13, '#a9b8be');
  drawText('CONTROLS  •  WASD / E / F / J / M', 45, 378, 13, '#a9b8be');
  drawText('ENTER  NEW GAME     C  CONTINUE', 26, 461, 10, '#70d5d2');
  context.restore();
}

function paintDistrictMap() {
  context.fillStyle = 'rgba(3,8,14,.86)';
  context.fillRect(0, 0, viewport.width, viewport.height);
  drawText('VESPERA CITY', 640, 85, 25, '#e7c475', 'center');
  drawText('DISTRICT ATLAS  /  M', 640, 111, 10, '#9baeb3', 'center');
  context.strokeStyle = '#53646b';
  context.lineWidth = 21;
  for (let road = 0; road < 7; road += 1) {
    context.beginPath();
    context.moveTo(310 + road * 105, 190);
    context.lineTo(390 + road * 60, 615);
    context.stroke();
    context.beginPath();
    context.moveTo(255, 240 + road * 53);
    context.lineTo(1025, 210 + road * 48);
    context.stroke();
  }
  districtNames.forEach((district, index) => {
    drawText(district, 330 + index % 4 * 178, 300 + Math.floor(index / 4) * 180, 11, '#d5dedc', 'center');
  });
  context.fillStyle = '#64eee0';
  context.beginPath();
  context.arc(640, 400, 8, 0, fullTurn);
  context.fill();
  drawText('JACE', 657, 405, 10);
  drawText('ESC  CLOSE', 640, 716, 10, '#91a5ac', 'center');
}

function paintJournal() {
  context.fillStyle = 'rgba(3,8,14,.8)';
  context.fillRect(0, 0, viewport.width, viewport.height);
  drawPanel(380, 180, 520, 440);
  const heading = isPaused ? 'PAUSED  •  ESC RESUME' : 'MISSION JOURNAL  •  J CLOSE';
  drawText(heading, 640, 223, 21, '#ead08d', 'center');
  chapters.forEach((chapter, index) => {
    const status = missionStatuses[index];
    const statusColor = status === 'ACTIVE' ? '#70ddda' : status === 'COMPLETED' ? '#e6c47f' : '#92a1a8';
    drawText(`${status}   ${chapter[0]}`, 420, 272 + index * 35, 11, statusColor);
    drawText(chapter[1], 550, 272 + index * 35, 10, '#c6d0d1');
  });
  if (isPaused) drawText('M MAP  •  J MISSIONS  •  K SAVE  •  ESC RESUME', 640, 587, 10, '#70d5d2', 'center');
}

function drawScene() {
  paintRoadGrid();
  for (const building of city) {
    const visibleX = Math.abs(building.col * 220 - player.x) < 1050;
    const visibleY = Math.abs(building.row * 205 - player.y) < 900;
    if (visibleX && visibleY) paintBuilding(building);
  }
  const currentStage = Math.min(player.chapter, chapters.length - 1);
  paintMarker(310, -120, '#f1bd61', chapters[currentStage][0]);
  traffic.forEach((car) => paintCar(car.x, car.y, car.heading, car.paint, car.kind, 0.88));
  pedestrians.forEach(paintPedestrian);
  for (const effect of shotEffects) {
    const [pixelX, pixelY] = worldToCanvas(effect.x, effect.y);
    context.fillStyle = '#f8d46c';
    context.beginPath();
    context.arc(pixelX, pixelY, 3, 0, fullTurn);
    context.fill();
  }
  police.forEach((patrol) => paintCar(patrol.x, patrol.y, patrol.heading, '#d8e0e0', 'sedan', 1.05, true));
  if (player.onFoot) paintPedestrian({ x: player.x, y: player.y, shirt: '#65e1d7' });
  else {
    const bodyColor = player.vehicle === 'ROOK GT' ? '#d36657' : player.vehicle === 'KESTREL S9' ? '#557f91' : '#c9a664';
    paintCar(player.x, player.y, player.angle, bodyColor, 'sedan', 1.14);
  }

  const edgeShade = context.createRadialGradient(640, 400, 150, 640, 400, 690);
  edgeShade.addColorStop(0, 'rgba(3,8,15,0)');
  edgeShade.addColorStop(1, 'rgba(3,8,15,.4)');
  context.fillStyle = edgeShade;
  context.fillRect(0, 0, viewport.width, viewport.height);
  if (nightPalette) {
    context.fillStyle = 'rgba(5,12,34,.16)';
    context.fillRect(0, 0, viewport.width, viewport.height);
  }
  paintHud();
  if (showTitle) paintTitleScreen();
  if (showMap) paintDistrictMap();
  if ((showJournal || isPaused) && !showTitle) paintJournal();
}

let previousTimestamp = performance.now();
let previewFrames = 0;
function frame(timestamp) {
  const deltaSeconds = Math.min(0.04, (timestamp - previousTimestamp) / 1000);
  previousTimestamp = timestamp;
  if (previewName) {
    elapsedSeconds += deltaSeconds;
    ageShotEffects(deltaSeconds);
    moveCityLife(deltaSeconds);
    followPlayer(deltaSeconds);
    previewFrames += 1;
    if (previewFrames === 3) window.__shotReady = true;
  } else {
    updateFrame(deltaSeconds);
  }
  drawScene();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
