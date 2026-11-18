// Solmar Heat — config: the city's numbers, names and data tables.
// Everything the other files need lives here, so tuning never means
// hunting through the game loop.
var SH = {};

SH.WORLD = 2440; // world is WORLD x WORLD units
SH.GRID = 9; // 9 x 9 street grid
SH.ROAD_W = 46; // asphalt width of a road
SH.ROAD0 = 120; // first road line
SH.ROAD_STEP = 254; // distance between road lines
SH.roadAt = function (i) { return SH.ROAD0 + i * SH.ROAD_STEP; };

// A point is on a road when it sits close to a road line on either axis.
SH.onRoad = function (x, y) {
  for (var i = 0; i < SH.GRID; i++) {
    var r = SH.roadAt(i);
    if (Math.abs(x - r) <= SH.ROAD_W / 2 || Math.abs(y - r) <= SH.ROAD_W / 2) return true;
  }
  return false;
};

// The nearest road line on one axis.
SH.nearestRoad = function (v) {
  var best = SH.roadAt(0), bd = 1e9;
  for (var i = 0; i < SH.GRID; i++) {
    var d = Math.abs(v - SH.roadAt(i));
    if (d < bd) { bd = d; best = SH.roadAt(i); }
  }
  return best;
};

// Districts: a 3 x 3 grid of named neighbourhoods, plus Canal Row,
// the tenth district, carved out of the south-east corner.
SH.DISTRICT_GRID = [
  ['Sunset Mile', 'Cactus Court', 'Neon Strip'],
  ['Old Town', 'Palm Court', 'Harbor Lights'],
  ['Marina', 'Pier 9', 'Vineyard Hills']
];
SH.CANAL = { x0: 1650, y0: 2000 }; // Canal Row starts here
SH.districtAt = function (x, y) {
  if (x >= SH.CANAL.x0 && y >= SH.CANAL.y0) return 'Canal Row';
  var cx = Math.max(0, Math.min(2, Math.floor(x / (SH.WORLD / 3))));
  var cy = Math.max(0, Math.min(2, Math.floor(y / (SH.WORLD / 3))));
  return SH.DISTRICT_GRID[cy][cx];
};

// Canals: two water bands across Canal Row. Cars and the player can
// only cross them on the bridges, where a road meets the water.
SH.CANALS = [
  { y0: 2080, y1: 2130 },
  { y0: 2260, y1: 2310 }
];
SH.BRIDGE_HALF = 30; // bridge half-width around a road line
SH.onBridge = function (x, y) {
  for (var c = 0; c < SH.CANALS.length; c++) {
    var band = SH.CANALS[c];
    if (y >= band.y0 && y <= band.y1) {
      for (var i = 0; i < SH.GRID; i++) {
        if (Math.abs(x - SH.roadAt(i)) <= SH.BRIDGE_HALF) return true;
      }
      return false;
    }
  }
  return true; // not over a canal at all
};
SH.inCanalWater = function (x, y) {
  if (x < SH.CANAL.x0) return false;
  for (var c = 0; c < SH.CANALS.length; c++) {
    var band = SH.CANALS[c];
    if (y >= band.y0 && y <= band.y1 && !SH.onBridge(x, y)) return true;
  }
  return false;
};

// The twelve stealable cars. The last two are new for round 5 and
// live in Canal Row: the Marlin and the Kite.
SH.CARS = [
  { name: 'Falco', color: '#e33b2f', top: 265, accel: 240 },
  { name: 'Vento', color: '#f2c200', top: 235, accel: 210, taxi: true },
  { name: 'Comet', color: '#3f7de0', top: 255, accel: 230 },
  { name: 'Bison', color: '#5a4a3a', top: 210, accel: 190 },
  { name: 'Lynx', color: '#c9c9c9', top: 250, accel: 225 },
  { name: 'Dune', color: '#d97b2b', top: 225, accel: 200 },
  { name: 'Marlin', color: '#19b8c4', top: 260, accel: 235 },
  { name: 'Strada', color: '#7b4fd0', top: 245, accel: 220 },
  { name: 'Puma', color: '#2fae5f', top: 248, accel: 222 },
  { name: 'Ridge', color: '#8a94a6', top: 215, accel: 195 },
  { name: 'Nova', color: '#ff7ab8', top: 252, accel: 228 },
  { name: 'Kite', color: '#ffe14d', top: 258, accel: 232 }
];

// Where the parked cars start (one per model).
SH.CAR_SPOTS = [
  { model: 0, x: 882, y: 374 }, { model: 1, x: 628, y: 628 },
  { model: 2, x: 1390, y: 882 }, { model: 3, x: 1898, y: 1390 },
  { model: 4, x: 374, y: 1644 }, { model: 5, x: 1136, y: 1136 },
  { model: 6, x: 1898, y: 2220 }, { model: 7, x: 2152, y: 628 },
  { model: 8, x: 628, y: 2152 }, { model: 9, x: 1644, y: 1644 },
  { model: 10, x: 374, y: 882 }, { model: 11, x: 2152, y: 2400 }
];

// Ten hidden Solmar coins, one tucked into Canal Row.
SH.COINS = [
  { x: 374, y: 628 }, { x: 882, y: 1136 }, { x: 1390, y: 374 },
  { x: 1898, y: 882 }, { x: 628, y: 1644 }, { x: 1136, y: 2152 },
  { x: 2152, y: 1644 }, { x: 1644, y: 628 }, { x: 374, y: 1898 },
  { x: 2152, y: 2220 }
];
SH.COIN_VALUE = 75;

// Landmarks the player navigates by.
SH.LANDMARKS = [
  { name: 'SCPD Headquarters', x: 1898, y: 628, r: 90, color: '#2b3a55' },
  { name: "Lou's Paint Shop", x: 628, y: 1898, r: 70, color: '#c25a7a' },
  { name: 'Marina', x: 374, y: 2152, r: 90, color: '#2b7a8a' },
  { name: 'Pier 9', x: 1136, y: 2152, r: 80, color: '#8a6a2b' },
  { name: 'Cactus Court Plaza', x: 882, y: 374, r: 80, color: '#4a7a2b' },
  { name: 'Old Town Market', x: 374, y: 1136, r: 70, color: '#7a4a2b' },
  { name: 'Neon Strip', x: 2152, y: 374, r: 90, color: '#a03fd0' },
  { name: 'Canal Row Marina', x: 2152, y: 2400, r: 80, color: '#19b8c4' },
  { name: 'Sunset Hospital', x: 628, y: 374, r: 70, color: '#e8e8e8' }
];
SH.landmark = function (name) {
  for (var i = 0; i < SH.LANDMARKS.length; i++) {
    if (SH.LANDMARKS[i].name === name) return SH.LANDMARKS[i];
  }
  return null;
};

// Street ranks, in order. The last one is only for finishing the story.
SH.RANKS = [
  { score: 0, title: 'Street Rookie' },
  { score: 400, title: 'Corner Hustler' },
  { score: 1000, title: 'Mile Runner' },
  { score: 2000, title: 'King of the Mile' },
  { score: 3200, title: 'Night Operator' },
  { score: 5000, title: 'Street Royalty' }
];
SH.rankFor = function (score, storyDone) {
  if (storyDone) return 'Solmar Legend';
  var title = SH.RANKS[0].title;
  for (var i = 0; i < SH.RANKS.length; i++) {
    if (score >= SH.RANKS[i].score) title = SH.RANKS[i].title;
  }
  return title;
};

// Wanted: heat 0..500, one star per 100. A star gained must land
// mid-band (star * 100 + 50) so it never decays back the next frame.
SH.HEAT_PER_STAR = 100;
SH.MAX_HEAT = 500;
SH.HEAT_DECAY = 4; // heat per second while laying low
SH.starsOf = function (heat) {
  return Math.max(0, Math.min(5, Math.floor(heat / SH.HEAT_PER_STAR)));
};
SH.gainStar = function (heat, star) {
  return Math.max(heat, star * SH.HEAT_PER_STAR + 50);
};

// The seven story jobs. Lena Voss and the boss Kane carry the arc:
// a getaway driver proves himself, runs errands, gets set up, and
// finally steals Kane's ledger from SCPD Headquarters.
SH.MISSIONS = [
  {
    id: 1, name: 'First Wheels', payout: 200, time: 120,
    desc: 'Steal any car, then drive to Lena at Cactus Court Plaza.',
    banner: 'Steal a car and meet Lena at Cactus Court Plaza.'
  },
  {
    id: 2, name: "Lena's Escort", payout: 350, time: 120,
    desc: 'Drive Lena to the Marina. Kane’s men are watching the roads.',
    banner: 'Drive Lena to the Marina before the timer runs out.'
  },
  {
    id: 3, name: 'The Voss Lift', payout: 500, time: 150,
    desc: 'Steal the red Falco and deliver it to Cactus Court Plaza.',
    banner: 'Steal the Falco and bring it to Cactus Court Plaza.'
  },
  {
    id: 4, name: 'Hot Pursuit', payout: 650, time: 75,
    desc: 'Reach the Neon Strip in 75 seconds with at least 2 stars.',
    banner: 'Reach the Neon Strip in 75 seconds. 2 stars and counting.'
  },
  {
    id: 5, name: 'The Setup', payout: 800, time: 180,
    desc: 'Drop the package at SCPD Headquarters, then get back to Old Town Market.',
    banner: 'Drop the package at SCPD Headquarters, then return to Old Town.'
  },
  {
    id: 6, name: 'Pier 9 Getaway', payout: 1200, time: 90,
    desc: 'Reach Pier 9 before the timer runs out. 3 stars from the start.',
    banner: 'Reach Pier 9 before the timer runs out. 3 stars from the start.'
  },
  {
    id: 7, name: 'The Last Ledger', payout: 4000, time: 90,
    desc: 'Steal Kane’s ledger from SCPD Headquarters, clear 3 guards, grab the ledger, then escape to the Marina in 90 seconds under a 4-star manhunt.',
    banner: 'Steal the ledger from SCPD HQ. Clear the guards, grab it, run to the Marina.'
  }
];
SH.GUARD_DROP = 50; // each guard in job 7 drops $50: $4,000 + 3 x $50 = $4,150

// Street races (round 5): three routes, one starter flag each.
// Checkpoints must be driven through in order before the par time.
SH.RACES = [
  {
    id: 'sunset', name: 'Sunset Sprint', level: 'Easy', payout: 150, par: 75,
    start: { x: 374, y: 374 },
    checkpoints: [
      { x: 374, y: 374 }, { x: 882, y: 374 }, { x: 882, y: 882 }, { x: 374, y: 882 }
    ]
  },
  {
    id: 'neon', name: 'Neon Circuit', level: 'Medium', payout: 300, par: 110,
    start: { x: 2152, y: 374 },
    checkpoints: [
      { x: 2152, y: 374 }, { x: 2152, y: 882 }, { x: 1644, y: 882 },
      { x: 1644, y: 1390 }, { x: 2152, y: 1390 }, { x: 2152, y: 374 }
    ]
  },
  {
    id: 'canal', name: 'Canal Run', level: 'Hard', payout: 600, par: 150,
    start: { x: 1898, y: 2152 },
    checkpoints: [
      { x: 1898, y: 2152 }, { x: 2152, y: 2152 }, { x: 2152, y: 2400 },
      { x: 1898, y: 2400 }, { x: 1898, y: 2152 }, { x: 1644, y: 2152 },
      { x: 1644, y: 1898 }, { x: 1898, y: 1898 }
    ]
  }
];

// Delivery side job (round 5): pick the parcel up at Old Town Market,
// run it to Pier 9 against the clock. Police spot you twice as fast
// while you carry it.
SH.DELIVERY = {
  pickup: { x: 374, y: 1136 }, drop: { x: 1136, y: 2152 },
  time: 100, payout: 250
};

SH.FARE_MIN = 280; // taxi fares pay around $310
SH.FARE_MAX = 340;
SH.NEAR_MISS_VALUE = 15;
SH.NEAR_MISS_COOLDOWN = 1.5;
SH.DAMAGE_PER_HIT = 8; // car health lost per wall hit
SH.SAVE_KEY = 'solmar-heat-save-v5';

