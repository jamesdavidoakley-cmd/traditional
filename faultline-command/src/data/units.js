// Unit archetypes plus the per-coalition, per-era equipment tables.
// Archetypes carry the balance; equipment entries carry the identity and small tweaks.

import { FACTIONS } from './factions.js';

const W = (o) => Object.assign({
  name: 'Weapon', range: 5, minRange: 0, damage: 10, type: 'small', rof: 1,
  splash: 0, projectile: 'bullet', burst: 1, salvo: 1, ammoCost: 0,
  targets: ['land', 'naval'], accuracy: 0.92, arcing: false, spread: 0,
}, o);

// role is what the AI reasons about; art is what the renderer draws.
export const ARCHETYPES = {
  // ---------------------------------------------------------------- infantry
  rifle: {
    key: 'rifle', class: 'infantry', role: 'lineInfantry', domain: 'land', heavy: false,
    cost: 220, buildTime: 6.5, hp: 150, speed: 1.45, armour: 'infantry', vision: 7.5,
    turnRate: 7, turretRate: 7, ammoMax: 0, crew: 8,
    weapons: [W({ name: 'Section small arms', range: 4.3, damage: 11, type: 'small', rof: 0.6, projectile: 'bullet', burst: 3 })],
    art: { body: 'squad', figures: 4, weapon: 'rifle' },
    desc: 'Cheap line infantry. Holds ground, takes cover well, useless against armour in the open.',
  },
  at: {
    key: 'at', class: 'infantry', role: 'antiArmour', domain: 'land', heavy: false,
    cost: 430, buildTime: 9, hp: 120, speed: 1.3, armour: 'infantry', vision: 7.5,
    turnRate: 6, turretRate: 6, ammoMax: 8, crew: 4,
    weapons: [W({ name: 'ATGM', range: 6.8, minRange: 0.9, damage: 78, type: 'heat', rof: 3.4, projectile: 'missile', ammoCost: 1, accuracy: 0.9 })],
    art: { body: 'squad', figures: 3, weapon: 'launcher' },
    desc: 'Tank killer. Devastating from cover, fragile once spotted, and it runs dry without munitions.',
  },
  engineer: {
    key: 'engineer', class: 'infantry', role: 'engineer', domain: 'land', heavy: false,
    cost: 480, buildTime: 10, hp: 110, speed: 1.4, armour: 'infantry', vision: 6.5,
    turnRate: 6, turretRate: 6, ammoMax: 0, crew: 4,
    weapons: [], canCapture: true, repairsStructures: 26,
    art: { body: 'squad', figures: 3, weapon: 'tools' },
    desc: 'Captures oil infrastructure and repairs structures. No offensive value whatsoever.',
  },
  recon: {
    key: 'recon', class: 'infantry', role: 'scout', domain: 'land', heavy: false,
    cost: 270, buildTime: 7, hp: 105, speed: 1.85, armour: 'infantry', vision: 12.5,
    turnRate: 8, turretRate: 8, ammoMax: 0, crew: 4, spotter: true,
    weapons: [W({ name: 'Carbines', range: 4.0, damage: 7, type: 'small', rof: 0.55, burst: 3 })],
    art: { body: 'squad', figures: 2, weapon: 'rifle' },
    desc: 'Long sight radius and artillery spotting. Reveals ground your guns cannot see for themselves.',
  },
  manpads: {
    key: 'manpads', class: 'infantry', role: 'airDefence', domain: 'land', heavy: false,
    cost: 400, buildTime: 9, hp: 110, speed: 1.3, armour: 'infantry', vision: 9,
    turnRate: 6, turretRate: 6, ammoMax: 6, crew: 3,
    interceptor: { ballistic: 0.00, cruise: 0.16, rocket: 0.06, loiter: 0.44, aircraft: 0.50, range: 8.5, reload: 4.5, needsData: false },
    weapons: [W({ name: 'MANPADS', range: 8.5, damage: 150, type: 'aa', rof: 4.2, projectile: 'missile', ammoCost: 1, targets: ['air'] })],
    art: { body: 'squad', figures: 2, weapon: 'launcher' },
    desc: 'Man-portable air defence. Swats drones, loitering munitions and air strikes without needing the data link.',
  },
  sf: {
    key: 'sf', class: 'infantry', role: 'raider', domain: 'land', heavy: false,
    cost: 680, buildTime: 13, hp: 200, speed: 1.75, armour: 'infantry', vision: 10.5,
    turnRate: 8, turretRate: 8, ammoMax: 4, crew: 6, lowProfile: 0.45,
    weapons: [
      W({ name: 'Assault weapons', range: 5.0, damage: 17, type: 'small', rof: 0.42, burst: 4 }),
      W({ name: 'Demolition charge', range: 1.4, damage: 260, type: 'demolition', rof: 7, projectile: 'none', ammoCost: 1, splash: 1.1 }),
    ],
    art: { body: 'squad', figures: 3, weapon: 'rifle', elite: true },
    desc: 'Raiders. Hard to spot at distance, and their demolition charges gut artillery parks and munitions plants.',
  },

  // ---------------------------------------------------------------- vehicles
  mbt: {
    key: 'mbt', class: 'vehicle', role: 'mainArmour', domain: 'land', heavy: true,
    cost: 1180, buildTime: 20, hp: 940, speed: 1.62, armour: 'heavy', vision: 8.5,
    turnRate: 1.9, turretRate: 2.3, ammoMax: 14, crew: 4, frontalArc: 0.62,
    weapons: [
      W({ name: 'Main gun', range: 7.2, damage: 118, type: 'ap', rof: 4.3, projectile: 'shell', ammoCost: 1, accuracy: 0.9 }),
      W({ name: 'Coaxial MG', range: 4.6, damage: 9, type: 'small', rof: 0.5, burst: 3 }),
    ],
    art: { body: 'tank', turret: 'cannon', len: 0.86, wid: 0.54, tracks: true },
    desc: 'The backbone of any serious push. Shrugs off small arms; flanks, mines and ATGMs still kill it.',
  },
  ifv: {
    key: 'ifv', class: 'vehicle', role: 'support', domain: 'land', heavy: true,
    cost: 800, buildTime: 14, hp: 500, speed: 1.98, armour: 'light', vision: 8.5,
    turnRate: 2.4, turretRate: 3.0, ammoMax: 20, crew: 3, cargo: 4,
    weapons: [
      W({ name: 'Autocannon', range: 6.1, damage: 30, type: 'ap', rof: 1.5, projectile: 'bullet', burst: 4, ammoCost: 1 }),
      W({ name: 'Turret ATGM', range: 7.0, damage: 66, type: 'heat', rof: 7.5, projectile: 'missile', ammoCost: 1 }),
    ],
    art: { body: 'ifv', turret: 'autocannon', len: 0.78, wid: 0.5, tracks: true },
    desc: 'Carries a section and shreds light armour and infantry. Bad idea to trade with a main battle tank.',
  },
  apc: {
    key: 'apc', class: 'vehicle', role: 'transport', domain: 'land', heavy: false,
    cost: 560, buildTime: 11, hp: 450, speed: 2.2, armour: 'light', vision: 8,
    turnRate: 2.7, turretRate: 3.4, ammoMax: 0, crew: 2, cargo: 6,
    weapons: [W({ name: 'Cupola MG', range: 4.7, damage: 12, type: 'small', rof: 0.5, burst: 3 })],
    art: { body: 'apc', turret: 'mg', len: 0.78, wid: 0.5, tracks: false },
    desc: 'Fast wheeled section transport. Gets riflemen and engineers across open ground alive.',
  },
  scout: {
    key: 'scout', class: 'vehicle', role: 'scout', domain: 'land', heavy: false,
    cost: 400, buildTime: 8, hp: 260, speed: 2.9, armour: 'light', vision: 13.5,
    turnRate: 3.2, turretRate: 3.6, ammoMax: 0, crew: 3, spotter: true,
    weapons: [W({ name: 'Turret MG', range: 4.9, damage: 11, type: 'small', rof: 0.45, burst: 3 })],
    art: { body: 'scout', turret: 'mg', len: 0.66, wid: 0.42, tracks: false },
    desc: 'Eyes. Fast, cheap and the only sensible way to find an enemy that has not attacked you yet.',
  },
  spg: {
    key: 'spg', class: 'vehicle', role: 'artillery', domain: 'land', heavy: true,
    cost: 1080, buildTime: 19, hp: 350, speed: 1.32, armour: 'light', vision: 6,
    turnRate: 1.7, turretRate: 1.4, ammoMax: 10, crew: 4, needsSpotting: true,
    weapons: [W({ name: '155mm howitzer', range: 17.5, minRange: 5, damage: 128, type: 'he', rof: 6.4, projectile: 'arc', splash: 2.3, ammoCost: 1, accuracy: 0.74, spread: 1.0 })],
    art: { body: 'spg', turret: 'howitzer', len: 0.88, wid: 0.52, tracks: true },
    desc: 'Wrecks defensive lines from beyond their reach. Helpless if anything reaches it.',
  },
  mlrs: {
    key: 'mlrs', class: 'vehicle', role: 'rocketArtillery', domain: 'land', heavy: true,
    cost: 1450, buildTime: 24, hp: 320, speed: 1.42, armour: 'light', vision: 6,
    turnRate: 1.7, turretRate: 1.5, ammoMax: 4, crew: 3, needsSpotting: true,
    weapons: [W({ name: 'Rocket salvo', range: 21, minRange: 7, damage: 58, type: 'frag', rof: 17, projectile: 'rocket', splash: 1.9, salvo: 6, ammoCost: 1, accuracy: 0.62, spread: 2.0, threat: 'rocket' })],
    art: { body: 'mlrs', turret: 'rocketpod', len: 0.88, wid: 0.52, tracks: true },
    desc: 'Saturation fire. One salvo can erase a defensive cluster — and it is visible on every radar screen.',
  },
  aa: {
    key: 'aa', class: 'vehicle', role: 'airDefence', domain: 'land', heavy: false,
    cost: 900, buildTime: 16, hp: 400, speed: 2.0, armour: 'light', vision: 9.5,
    turnRate: 2.6, turretRate: 4.2, ammoMax: 12, crew: 3,
    interceptor: { ballistic: 0.00, cruise: 0.26, rocket: 0.22, loiter: 0.52, aircraft: 0.58, range: 9.5, reload: 3.0, needsData: false },
    weapons: [
      W({ name: 'AA missiles/guns', range: 9.5, damage: 190, type: 'aa', rof: 2.4, projectile: 'missile', ammoCost: 1, targets: ['air'] }),
      W({ name: 'Gun mount', range: 4.4, damage: 20, type: 'small', rof: 0.4, burst: 5 }),
    ],
    art: { body: 'aa', turret: 'missile', len: 0.78, wid: 0.5, tracks: true },
    desc: 'Mobile air and missile defence that travels with the armour. Works with the power grid down.',
  },
  eng: {
    key: 'eng', class: 'vehicle', role: 'repair', domain: 'land', heavy: false,
    cost: 620, buildTime: 12, hp: 430, speed: 1.8, armour: 'light', vision: 7,
    turnRate: 2.4, turretRate: 2.4, ammoMax: 0, crew: 3,
    repairsVehicles: 24, rearms: 0.55, repairRadius: 3.4,
    weapons: [],
    art: { body: 'engv', turret: 'crane', len: 0.82, wid: 0.52, tracks: true },
    desc: 'Field recovery. Repairs vehicles and pushes ammunition forward so your guns keep firing.',
  },

  // ------------------------------------------------------------------ naval
  patrol: {
    key: 'patrol', class: 'naval', role: 'navalLight', domain: 'naval', heavy: false,
    cost: 520, buildTime: 10, hp: 340, speed: 3.05, armour: 'navalLight', vision: 10.5,
    turnRate: 1.6, turretRate: 3.0, ammoMax: 10, crew: 12,
    weapons: [W({ name: 'Deck gun', range: 6.6, damage: 30, type: 'navalGun', rof: 1.2, projectile: 'shell', ammoCost: 1 })],
    art: { body: 'boat', turret: 'mg', len: 1.5, wid: 0.5 },
    desc: 'Cheap sea control. Hunts landing craft and harasses shorelines.',
  },
  landing: {
    key: 'landing', class: 'naval', role: 'navalTransport', domain: 'naval', heavy: false,
    cost: 640, buildTime: 12, hp: 500, speed: 2.25, armour: 'navalLight', vision: 8.5,
    turnRate: 1.2, turretRate: 2.0, ammoMax: 0, crew: 10, cargo: 8, amphibious: true,
    weapons: [W({ name: 'Defensive MG', range: 4.2, damage: 10, type: 'small', rof: 0.6, burst: 3 })],
    art: { body: 'landing', turret: null, len: 1.7, wid: 0.72 },
    desc: 'Puts a mechanised element on a beach that has no road leading to it.',
  },
  frigate: {
    key: 'frigate', class: 'naval', role: 'navalLine', domain: 'naval', heavy: false,
    cost: 1550, buildTime: 24, hp: 1150, speed: 1.92, armour: 'naval', vision: 12.5,
    turnRate: 0.9, turretRate: 2.0, ammoMax: 16, crew: 90,
    interceptor: { ballistic: 0.08, cruise: 0.36, rocket: 0.22, loiter: 0.46, aircraft: 0.48, range: 10, reload: 3.6, needsData: false },
    weapons: [
      W({ name: 'Main gun', range: 11, damage: 92, type: 'navalGun', rof: 3.5, projectile: 'shell', splash: 1.2, ammoCost: 1 }),
      W({ name: 'Point defence', range: 9, damage: 150, type: 'aa', rof: 2.6, projectile: 'missile', targets: ['air'], ammoCost: 1 }),
    ],
    art: { body: 'ship', turret: 'cannon', len: 2.3, wid: 0.66 },
    desc: 'The workhorse hull. Escorts the fleet and keeps drones and rockets off the beachhead.',
  },
  destroyer: {
    key: 'destroyer', class: 'naval', role: 'navalHeavy', domain: 'naval', heavy: false,
    cost: 2450, buildTime: 34, hp: 1700, speed: 1.72, armour: 'naval', vision: 14.5,
    turnRate: 0.75, turretRate: 1.8, ammoMax: 20, crew: 300, missilePlatform: true,
    interceptor: { ballistic: 0.34, cruise: 0.56, rocket: 0.24, loiter: 0.52, aircraft: 0.62, range: 13.5, reload: 2.8, needsData: true },
    weapons: [
      W({ name: 'Naval gun', range: 13.5, damage: 130, type: 'navalGun', rof: 3.1, projectile: 'shell', splash: 1.6, ammoCost: 1 }),
      W({ name: 'Area SAM', range: 13, damage: 220, type: 'aa', rof: 2.2, projectile: 'missile', targets: ['air'], ammoCost: 1 }),
    ],
    art: { body: 'ship', turret: 'vls', len: 2.7, wid: 0.72 },
    desc: 'Fleet air-defence and the launch platform for naval cruise strike. Expensive and worth it.',
  },
  support: {
    key: 'support', class: 'naval', role: 'navalArtillery', domain: 'naval', heavy: false,
    cost: 1150, buildTime: 18, hp: 950, speed: 1.78, armour: 'naval', vision: 10,
    turnRate: 0.85, turretRate: 1.4, ammoMax: 12, crew: 60, needsSpotting: true,
    weapons: [W({ name: 'Shore bombardment', range: 15.5, minRange: 4, damage: 150, type: 'he', rof: 7.0, projectile: 'arc', splash: 2.6, ammoCost: 1, accuracy: 0.7, spread: 1.2 })],
    art: { body: 'ship', turret: 'howitzer', len: 2.1, wid: 0.7 },
    desc: 'Floating artillery. Flattens coastal defences, but every coastal battery on the map wants it dead.',
  },

  // ------------------------------------------------- signature rocket units
  himars: {
    key: 'himars', class: 'vehicle', role: 'rocketArtillery', domain: 'land', heavy: false, signature: 'himars',
    cost: 1650, buildTime: 26, hp: 280, speed: 2.35, armour: 'light', vision: 6.5,
    turnRate: 2.8, turretRate: 1.6, ammoMax: 3, crew: 3, needsSpotting: true, needsData: 1, shootAndScoot: true,
    weapons: [W({ name: 'GMLRS precision salvo', range: 26, minRange: 8, damage: 96, type: 'frag', rof: 15, projectile: 'rocket', splash: 1.7, salvo: 6, ammoCost: 1, accuracy: 0.88, spread: 0.7, threat: 'rocket' })],
    art: { body: 'mlrs', turret: 'rocketpod', len: 0.84, wid: 0.46, tracks: false, wheels: 6 },
    desc: 'Wheeled precision rocket artillery. Accurate, long-legged and it relocates after firing.',
  },
  phl16: {
    key: 'phl16', class: 'vehicle', role: 'rocketArtillery', domain: 'land', heavy: true, signature: 'phl16',
    cost: 1750, buildTime: 28, hp: 330, speed: 1.6, armour: 'light', vision: 6.5,
    turnRate: 1.8, turretRate: 1.4, ammoMax: 3, crew: 4, needsSpotting: true, needsData: 1,
    weapons: [W({ name: 'Modular rocket salvo', range: 28, minRange: 9, damage: 74, type: 'frag', rof: 18, projectile: 'rocket', splash: 2.1, salvo: 8, ammoCost: 1, accuracy: 0.72, spread: 1.5, threat: 'rocket' })],
    art: { body: 'mlrs', turret: 'rocketpod', len: 0.9, wid: 0.54, tracks: false, wheels: 8 },
    desc: 'Modular long-range rocket system. Enormous reach; a slow, obvious target once located.',
  },
};

export const UNIT_ORDER = {
  infantry: ['rifle', 'at', 'engineer', 'recon', 'manpads', 'sf'],
  vehicle: ['scout', 'apc', 'ifv', 'mbt', 'eng', 'aa', 'spg', 'mlrs', 'himars', 'phl16'],
  naval: ['patrol', 'landing', 'frigate', 'support', 'destroyer'],
};

// Equipment naming, by coalition and era. `mod` applies small stat adjustments so
// the coalitions play differently without breaking the counter system.
const EQ = {
  arc: {
    interwar: {
      rifle: ['Rifle Platoon', 'Lee-Enfield sections with a Lewis gun apiece, drilled on 1918 doctrine.'],
      at: ['Anti-Tank Rifle Team', '13.2mm anti-tank rifles and rifle grenades. Very short range: armour has to come to them.'],
      engineer: ['Field Engineer Section', 'Sappers with demolition charges, capture parties and bridging stores.'],
      recon: ['Scout Patrol', 'Dismounted scouts and cyclists working well ahead of the column.'],
      manpads: ['AA Machine-Gun Team', 'Lewis guns on high-angle mountings against low-flying aircraft.'],
      sf: ['Storm Detachment', 'Trench-raiding specialists with bangalores and demolition charges.'],
      mbt: ['Vickers Medium Mk I', 'A revolving turret, a 3-pounder and eight miles an hour. The most modern tank in service anywhere.'],
      ifv: ['Mark V* Heavy Tank', 'Lengthened rhomboid hull with sponson guns and room for a machine-gun section.'],
      apc: ['Armoured Lorry', 'Sheet steel over a three-ton chassis. Gets a section forward alive, provided the road holds.'],
      scout: ['Rolls-Royce Armoured Car', 'Fast on a metalled road, useless off it, and the eyes of every column.'],
      spg: ['Birch Gun', 'An 18-pounder on a tracked mounting — the first self-propelled gun in any army.'],
      mlrs: ['BL 8-inch Howitzer Group', 'Corps heavy artillery. A registered barrage from these erases a position rather than damaging it.'],
      aa: ['QF 3-inch AA Lorry', 'High-angle gun on a lorry mounting, with a sound-locator crew alongside.'],
      eng: ['Holt Recovery Tractor', 'Winch, workshop and a crew who can patch a tank in the field.'],
      patrol: ['Coastal Motor Boat', 'Plywood torpedo boat that does forty knots and cannot take a hit.'],
      landing: ['Landing Barge', 'Powered lighter. Puts a company on a beach with no port.'],
      frigate: ['V-class Destroyer', 'Fast escort with torpedoes and 4-inch guns.'],
      destroyer: ['Queen Elizabeth-class Battleship', 'Fifteen-inch guns, and the naval gunfire authority that comes with them.'],
      support: ['Erebus-class Monitor', 'Shallow-draught hull carrying a 15-inch turret purely for shore bombardment.'],
      himars: ['BL 9.2-inch Railway Gun', 'Rail-mounted siege gun. Fires, then is hauled to another siding before counter-battery lands.'],
    },
    nineties: {
      rifle: ['Rifle Section', 'M16A2 / M249 section, well drilled and well supplied.'],
      at: ['TOW Anti-Tank Team', 'Tube-launched wire-guided missiles on a dismounted tripod.'],
      engineer: ['Combat Engineer Section', 'Sappers with capture kit and structural repair gear.'],
      recon: ['Cavalry Scout Team', 'Dismounted scouts with laser designators.'],
      manpads: ['Stinger Team', 'FIM-92 shoulder-launched air defence.'],
      sf: ['Special Forces Detachment', 'Long-range raiding element with demolition charges.'],
      mbt: ['M1A1 Abrams', '120mm smoothbore behind composite armour. The 1990s benchmark.'],
      ifv: ['M2A2 Bradley', '25mm chain gun and TOW launcher, carries a rifle team.'],
      apc: ['M113A3', 'Ubiquitous tracked battle taxi.'],
      scout: ['M1025 Scout HMMWV', 'Fast wheeled reconnaissance.'],
      spg: ['M109A2 Howitzer', 'Self-propelled 155mm, the standard divisional gun.'],
      mlrs: ['M270 MLRS', 'Twelve 227mm rockets in one salvo. Grid-square removal.'],
      aa: ['M1097 Avenger', 'Stinger turret on a light wheeled chassis.'],
      eng: ['M88A1 Recovery Vehicle', 'Battlefield recovery and forward rearming.'],
      patrol: ['Cyclone Patrol Craft', 'Coastal patrol and interdiction.'],
      landing: ['LCU-1610 Landing Craft', 'Utility landing craft for mechanised elements.'],
      frigate: ['Perry-class Frigate', 'Escort hull with a capable point-defence fit.'],
      destroyer: ['Arleigh Burke Destroyer', 'Aegis air defence and vertical-launch strike.'],
      support: ['Newport Fire Support Ship', 'Converted hull carrying heavy shore bombardment guns.'],
    },
    modern: {
      rifle: ['Rifle Section', 'Networked infantry section with organic ISR feeds.'],
      at: ['Javelin Anti-Tank Team', 'Fire-and-forget top-attack missiles.'],
      engineer: ['Combat Engineer Section', 'Sappers with capture kit and structural repair gear.'],
      recon: ['Recce Team', 'Dismounted scouts feeding the strike network.'],
      manpads: ['Stinger Team', 'FIM-92K with proximity-fused warhead.'],
      sf: ['Special Forces Detachment', 'Deep raiding element with demolition charges.'],
      mbt: ['M1A2 SEPv3 Abrams', 'Trophy-protected, third-generation thermals, brutal frontal armour.'],
      ifv: ['CV90 Mk IV', '35mm cannon, active protection, carries a rifle team.'],
      apc: ['Boxer IFV Module', 'Modular wheeled drive module, fast on roads.'],
      scout: ['Jackal Recce Vehicle', 'Very fast wheeled reconnaissance with elevated optics.'],
      spg: ['M109A7 Paladin', 'Digitised 155mm with automated fire control.'],
      mlrs: ['M270A2 MLRS', 'Upgraded launcher firing extended-range guided rockets.'],
      aa: ['M-SHORAD Stryker', 'Short-range air defence on a wheeled hull.'],
      eng: ['M88A2 Hercules', 'Heavy recovery and forward rearming.'],
      patrol: ['Mark VI Patrol Boat', 'Fast littoral patrol with stabilised guns.'],
      landing: ['LCAC Landing Craft', 'Air-cushion craft; crosses beaches at speed.'],
      frigate: ['Type 26 Frigate', 'Quiet escort hull with a deep missile magazine.'],
      destroyer: ['Arleigh Burke Flight III', 'Radar-heavy air-defence destroyer and cruise-strike platform.'],
      support: ['Littoral Fire Support Ship', 'Shallow-draught gunfire support for the landing force.'],
      himars: ['M142 HIMARS', 'Six guided rockets, then gone before counter-battery arrives.'],
    },
  },
  esd: {
    interwar: {
      rifle: ['Rifle Company', 'Mosin-Nagant sections in depth, and a great many of them.'],
      at: ['Anti-Tank Rifle Team', 'Captured Mauser anti-tank rifles and 37mm trench guns.'],
      engineer: ['Sapper Section', 'Combat engineers with demolition stores and capture parties.'],
      recon: ['Razvedka Patrol', 'Divisional reconnaissance working on foot and horseback.'],
      manpads: ['AA Maxim Team', 'Quadruple Maxim mounting on a cart, thrown up over the column.'],
      sf: ['Shock Detachment', 'Assault troops trained on rear-area raiding.'],
      mbt: ['Renault Russkiy Light Tank', 'A licence-built Renault FT: one man in the turret, one 37mm gun and no wireless.'],
      ifv: ['Ricardo Heavy Tank', 'Captured rhomboid hulls pressed back into service, sponsons and all.'],
      apc: ['Armoured Lorry', 'Riveted plate on a lorry chassis. Crude, and it works.'],
      scout: ['Austin-Putilov Armoured Car', 'Twin turrets on a Putilov chassis, the workhorse of the civil war.'],
      spg: ['Putilov Gun Tractor', '76mm divisional gun on a tracked tractor mounting.'],
      mlrs: ['152mm Howitzer Group', 'Corps howitzers massed on one map square and fired until it stops being a map square.'],
      aa: ['76mm AA Lorry Mounting', 'High-angle gun and a searchlight section on lorries.'],
      eng: ['Recovery Tractor', 'Tracked tractor with winch and field workshop.'],
      patrol: ['Coastal Torpedo Boat', 'Small, fast and armed with one serious weapon.'],
      landing: ['Landing Barge', 'Powered lighter for a beach assault.'],
      frigate: ['Novik-class Destroyer', 'Fast, heavily gunned and getting old.'],
      destroyer: ['Gangut-class Battleship', 'Twelve-inch guns in four triple turrets.'],
      support: ['Shkval-class Monitor', 'River monitor with heavy guns and almost no draught.'],
    },
    nineties: {
      rifle: ['Motor Rifle Squad', 'Conscript-heavy squad, cheap and numerous.'],
      at: ['Konkurs Anti-Tank Team', 'Wire-guided missiles from a dug-in position.'],
      engineer: ['Sapper Section', 'Combat engineers with capture and repair equipment.'],
      recon: ['Razvedka Scout Team', 'Divisional reconnaissance patrol.'],
      manpads: ['Igla Team', '9K38 shoulder-launched air defence.'],
      sf: ['Spetsnaz Detachment', 'Deep raiding troops trained against rear-area targets.'],
      mbt: ['T-80U', 'Gas turbine, reactive armour, gun-launched missiles.'],
      ifv: ['BMP-2', '30mm cannon and a dismount section, thin on top.'],
      apc: ['BTR-80', 'Eight-wheeled amphibious carrier.'],
      scout: ['BRDM-2', 'Amphibious wheeled scout car.'],
      spg: ['2S19 Msta-S', '152mm self-propelled howitzer with a deep magazine.'],
      mlrs: ['BM-30 Smerch', '300mm rockets. The heaviest salvo of the decade.'],
      aa: ['2S6 Tunguska', 'Guns and missiles on one tracked mount.'],
      eng: ['BREM-1 Recovery Vehicle', 'Armoured recovery and resupply.'],
      patrol: ['Tarantul Missile Corvette', 'Small hull, oversized anti-ship punch.'],
      landing: ['Ropucha Landing Ship', 'Beaches armour directly.'],
      frigate: ['Krivak Frigate', 'Anti-submarine escort with a solid gun fit.'],
      destroyer: ['Sovremenny Destroyer', 'Heavy missile armament and area air defence.'],
      support: ['Grisha Coastal Escort', 'Coastal gunfire support and screening.'],
    },
    modern: {
      rifle: ['Motor Rifle Squad', 'Reorganised squad with organic drone support.'],
      at: ['Kornet-EM Team', 'Long-range laser-beam-riding missiles.'],
      engineer: ['Sapper Section', 'Combat engineers with capture and repair equipment.'],
      recon: ['Razvedka Scout Team', 'Reconnaissance patrol feeding the artillery net.'],
      manpads: ['Verba Team', 'Multi-band seeker resistant to countermeasures.'],
      sf: ['Spetsnaz Detachment', 'Deep raiding troops trained against rear-area targets.'],
      mbt: ['T-90M Proryv', 'Relikt armour, improved thermals, hard-hitting 125mm.'],
      ifv: ['BMP-3', '100mm gun plus 30mm cannon; heavy firepower, light protection.'],
      apc: ['BTR-82A', 'Stabilised 30mm on the classic eight-wheeled hull.'],
      scout: ['Tigr-M Recce Vehicle', 'Fast protected reconnaissance.'],
      spg: ['2S19M2 Msta-S', 'Digitised fire control and faster displacement.'],
      mlrs: ['9A52-4 Tornado-S', 'Guided 300mm rockets with extended reach.'],
      aa: ['Pantsir-S1', 'Gun-missile system optimised against drones and rockets.'],
      eng: ['BREM-1M Recovery Vehicle', 'Armoured recovery and forward rearming.'],
      patrol: ['Karakurt Corvette', 'Small missile ship with a heavy strike load.'],
      landing: ['Ivan Gren Landing Ship', 'Modern beaching transport.'],
      frigate: ['Admiral Gorshkov Frigate', 'Multirole escort with layered air defence.'],
      destroyer: ['Project 22350M Destroyer', 'Large missile combatant with area air defence.'],
      support: ['Buyan-M Gunboat', 'Shallow-draught gunfire and missile support.'],
    },
  },
  pdc: {
    interwar: {
      rifle: ['Rifle Company', 'Type 38 rifles and Type 3 machine guns, and the numbers to use them.'],
      at: ['37mm Infantry Gun Team', 'Type 11 gun manhandled forward to fire over open sights.'],
      engineer: ['Engineer Section', 'Pioneers with demolition charges and capture parties.'],
      recon: ['Reconnaissance Patrol', 'Light scouts working ahead of the advance.'],
      manpads: ['AA Machine-Gun Team', 'High-angle machine guns against low-flying aircraft.'],
      sf: ['Raiding Detachment', 'Night-raiding specialists with demolition charges.'],
      mbt: ['Renault Ko-Gata', 'Imported Renault FT. Slow, cramped and the first tank the Compact ever fielded.'],
      ifv: ['Vickers Medium C', 'Imported British medium with room for a dismount team.'],
      apc: ['Armoured Lorry', 'Plated lorry that keeps a section out of the rain and most of the fire.'],
      scout: ['Vickers Crossley Armoured Car', 'Imported six-wheeler, fast on a road and prized by every commander.'],
      spg: ['Type 38 Gun Tractor', '12cm howitzer on a tracked tractor mounting.'],
      mlrs: ['24cm Howitzer Group', 'Siege howitzers of the type that reduced Port Arthur.'],
      aa: ['Type 11 AA Gun Lorry', 'High-angle gun on a lorry, with a listening crew.'],
      eng: ['Recovery Tractor', 'Tracked tractor with winch and workshop.'],
      patrol: ['Motor Torpedo Boat', 'Fast coastal craft carrying two torpedoes and no armour.'],
      landing: ['Landing Barge', 'Purpose-built beaching lighter — the Compact was first to take these seriously.'],
      frigate: ['Minekaze-class Destroyer', 'Long-legged escort with a heavy torpedo armament.'],
      destroyer: ['Kongo-class Battlecruiser', 'Fourteen-inch guns on a hull fast enough to choose its own fight.'],
      support: ['Kuma-class Light Cruiser', 'Fast cruiser told off for inshore gunfire support.'],
      phl16: ['Type 7 30cm Siege Howitzer', 'Super-heavy howitzer broken down for transport and reassembled in the firing position.'],
    },
    nineties: {
      rifle: ['Rifle Squad', 'Large, cheap and quickly replaced.'],
      at: ['HJ-8 Anti-Tank Team', 'Tripod-mounted wire-guided missiles.'],
      engineer: ['Engineer Section', 'Capture and repair specialists.'],
      recon: ['Reconnaissance Team', 'Light scouts with optics.'],
      manpads: ['QW-1 MANPADS Team', 'Shoulder-launched air defence.'],
      sf: ['Special Operations Squad', 'Raiding element with demolition charges.'],
      mbt: ['Type 96', 'Welded turret, 125mm gun, produced in quantity.'],
      ifv: ['WZ-501 IFV', 'Licence-built tracked fighting vehicle.'],
      apc: ['Type 63C APC', 'Simple amphibious tracked carrier.'],
      scout: ['Type 92 Recce Vehicle', 'Six-wheeled reconnaissance vehicle.'],
      spg: ['PLZ-45 Howitzer', '155mm export-standard self-propelled gun.'],
      mlrs: ['Type 83 Rocket System', '273mm rockets on a tracked chassis.'],
      aa: ['Type 95 SPAAA', 'Quad 25mm guns with missile rails.'],
      eng: ['Type 84 Recovery Vehicle', 'Armoured recovery.'],
      patrol: ['Houjian Missile Craft', 'Fast attack craft in numbers.'],
      landing: ['Yuting Landing Ship', 'Tank landing ship.'],
      frigate: ['Jiangwei Frigate', 'General-purpose escort.'],
      destroyer: ['Luhu Destroyer', 'First-generation area air-defence destroyer.'],
      support: ['Haiqing Coastal Escort', 'Coastal gunfire support.'],
    },
    modern: {
      rifle: ['Rifle Squad', 'Digitised squad tied into the strike network.'],
      at: ['HJ-12 Anti-Tank Team', 'Fire-and-forget top-attack missiles.'],
      engineer: ['Engineer Section', 'Capture and repair specialists.'],
      recon: ['Reconnaissance Team', 'Scouts with organic quadcopter feeds.'],
      manpads: ['QW-2 MANPADS Team', 'Improved seeker, effective against drones.'],
      sf: ['Special Operations Squad', 'Raiding element with demolition charges.'],
      mbt: ['Type 99A', 'Heavy frontal protection and an advanced fire-control suite.'],
      ifv: ['ZBD-04A', '100mm gun-launcher plus 30mm cannon.'],
      apc: ['ZBL-08 APC', 'Eight-wheeled modular carrier.'],
      scout: ['CSK-181 Recce Vehicle', 'Protected wheeled reconnaissance.'],
      spg: ['PLZ-05', '155mm with automatic loading and burst fire.'],
      mlrs: ['PHL-03 Rocket System', '300mm rockets, twelve tubes.'],
      aa: ['HQ-17 Mobile SAM', 'Short-range vertical-launch air defence.'],
      eng: ['Type 654 Recovery Vehicle', 'Recovery and forward rearming.'],
      patrol: ['Type 022 Houbei', 'Stealthy missile catamaran.'],
      landing: ['Type 072A Landing Ship', 'Modern tank landing ship.'],
      frigate: ['Type 054A Frigate', 'Multirole escort with vertical launch.'],
      destroyer: ['Type 052D Destroyer', 'Large phased-array air-defence destroyer.'],
      support: ['Type 056A Corvette', 'Littoral gunfire and escort.'],
      phl16: ['PHL-16 Rocket System', 'Modular pods: rockets today, ballistic missiles tomorrow.'],
    },
  },
  mrl: {
    interwar: {
      rifle: ['Rifle Company', 'Carcano sections with Fiat-Revelli machine guns.'],
      at: ['Anti-Tank Gun Team', '37mm Puteaux guns dug into prepared positions.'],
      engineer: ['Combat Engineer Section', 'Sappers with demolition charges and capture parties.'],
      recon: ['Reconnaissance Patrol', 'Mountain-trained scouts who go where lorries cannot.'],
      manpads: ['AA Machine-Gun Team', 'High-angle machine guns on lorry and cart mountings.'],
      sf: ['Arditi Detachment', 'Assault troops with grenades, daggers and demolition charges.'],
      mbt: ['Fiat 3000', 'An improved Renault FT built at Turin. Lighter, faster, and still barely a tank.'],
      ifv: ['Fiat 2000 Heavy Tank', 'A forty-ton steel house with a turret and seven machine guns.'],
      apc: ['Armoured Lorry', 'Plated lorry, and the fastest way to move a section that is not a road march.'],
      scout: ['Lancia 1ZM Armoured Car', 'Twin machine-gun turrets and a wire-cutting rail on the bow.'],
      spg: ['Ansaldo Gun Tractor', '75/27 gun on a tracked mounting.'],
      mlrs: ['Skoda 149mm Howitzer Group', 'Corps howitzers with the best fire control in the Mediterranean.'],
      aa: ['75/46 AA Lorry Mounting', 'High-angle gun on a lorry with a sound locator.'],
      eng: ['Recovery Tractor', 'Tracked tractor with winch and field workshop.'],
      patrol: ['MAS Torpedo Boat', 'Fast attack craft with a reputation out of all proportion to its size.'],
      landing: ['Landing Barge', 'Powered lighter for coastal landings.'],
      frigate: ['Leone-class Destroyer', 'Large destroyer with an oversized gun armament.'],
      destroyer: ['Conte di Cavour-class Battleship', 'Thirteen 12-inch guns and a great deal of national pride.'],
      support: ['Faa di Bruno Monitor', 'A barge with two 15-inch guns bolted to it. Ugly, and it works.'],
      phl16: ['Skoda 305mm Siege Mortar', 'The gun that broke the Belgian forts, still the heaviest thing on any battlefield.'],
    },
    nineties: {
      rifle: ['Rifle Squad', 'Reservist-heavy but very well trained.'],
      at: ['MILAN Anti-Tank Team', 'Compact wire-guided anti-tank missiles.'],
      engineer: ['Combat Engineer Section', 'Capture and structural repair specialists.'],
      recon: ['Reconnaissance Patrol', 'Deep patrol element with designators.'],
      manpads: ['Mistral Team', 'Very high hit probability at short range.'],
      sf: ['Long Range Raid Squad', 'Specialists in rear-area demolition.'],
      mbt: ['Merkava Mk III', 'Front-mounted engine, crew survivability above all.'],
      ifv: ['Marder 1A3', 'Well-protected tracked fighting vehicle.'],
      apc: ['M113 Zelda', 'Up-armoured tracked carrier.'],
      scout: ['VBL Recce Vehicle', 'Small, fast, protected scout car.'],
      spg: ['M109 Doher', 'Locally upgraded 155mm self-propelled gun.'],
      mlrs: ['MAR-290 Rocket System', 'Heavy 290mm rockets on a tank chassis.'],
      aa: ['Machbet SPAAG', 'Gun-missile hybrid on a tracked hull.'],
      eng: ['Puma Combat Engineering Vehicle', 'Heavily armoured engineering hull.'],
      patrol: ["Sa'ar 4.5 Missile Boat", 'Small hull, very heavy missile fit.'],
      landing: ['Ashdod Landing Craft', 'Coastal mechanised landing craft.'],
      frigate: ['Lupo Frigate', 'Mediterranean general-purpose escort.'],
      destroyer: ['Audace Destroyer', 'Area air-defence destroyer.'],
      support: ['Minerva Coastal Corvette', 'Coastal gunfire support.'],
    },
    modern: {
      rifle: ['Rifle Squad', 'Small professional squads with excellent optics.'],
      at: ['Spike LR2 Team', 'Network-enabled fire-and-forget missiles.'],
      engineer: ['Combat Engineer Section', 'Capture and structural repair specialists.'],
      recon: ['Reconnaissance Patrol', 'Patrol element feeding the interception network.'],
      manpads: ['Mistral 3 Team', 'Excellent against drones and loitering munitions.'],
      sf: ['Long Range Raid Squad', 'Specialists in rear-area demolition.'],
      mbt: ['Merkava Mk IV', 'Trophy active protection; extremely hard to kill.'],
      ifv: ['Freccia IFV', 'Wheeled fighting vehicle with a stabilised 25mm.'],
      apc: ['Eitan APC', 'Heavy eight-wheeled protected carrier.'],
      scout: ['Sandcat Recce Vehicle', 'Light protected reconnaissance.'],
      spg: ['ATMOS 2000', 'Wheeled 155mm; shoots and moves quickly.'],
      mlrs: ['PULS Rocket System', 'Mixed-calibre precision rocket launcher.'],
      aa: ['Spyder Mobile SAM', 'Short and medium-range interception on the move.'],
      eng: ['Nemmera Engineering Vehicle', 'Heavy armoured recovery.'],
      patrol: ['Shaldag Fast Craft', 'Very fast littoral patrol.'],
      landing: ['Bay-class Landing Craft', 'Modern beaching transport.'],
      frigate: ["Sa'ar 6 Frigate", 'Compact hull with dense interception fit.'],
      destroyer: ['Horizon Destroyer', 'Aster-armed area air-defence destroyer.'],
      support: ['FREMM Support Ship', 'Multirole hull configured for shore bombardment.'],
    },
  },
};

// Coalition flavour: small multipliers, applied on top of the archetype.
const FACTION_MODS = {
  arc: { mbt: { hp: 1.10, damage: 1.06 }, spg: { range: 1.04 }, destroyer: { hp: 1.06 }, rifle: { hp: 1.04 } },
  esd: { mlrs: { damage: 1.10, cost: 0.94 }, spg: { rof: 0.92 }, mbt: { hp: 0.94, cost: 0.92 }, aa: { range: 1.12 } },
  pdc: { rifle: { cost: 0.86, buildTime: 0.84 }, mbt: { cost: 0.92, buildTime: 0.88, hp: 0.96 }, ifv: { cost: 0.9, buildTime: 0.88 }, apc: { cost: 0.88 } },
  mrl: { mbt: { hp: 1.16, speed: 0.94, cost: 1.06 }, at: { range: 1.10 }, manpads: { damage: 1.15 }, aa: { damage: 1.1 } },
};


/**
 * Era adjustments applied on top of the archetype. 1926 armies are slower and
 * shorter-ranged than their descendants, anti-tank work is done by rifles and
 * field guns rather than guided missiles, and nothing on the battlefield can
 * shoot down an artillery shell — so interwar bombardment carries no threat tag
 * and cannot be intercepted.
 */
const ERA_MODS = {
  // The 1990s uses the base statistics: this block is artwork only, so the era
  // looks like cold-war armour without playing any differently.
  nineties: {
    mbt:   { art: { body: 'tank90' } },
    ifv:   { art: { body: 'ifv90' } },
    apc:   { art: { body: 'apc90' } },
    spg:   { art: { body: 'spg90' } },
    mlrs:  { art: { body: 'mlrs90' } },
    himars: { art: { body: 'mlrs90' } },
    phl16: { art: { body: 'mlrs90' } },
    aa:    { art: { body: 'aa90' } },
    eng:   { art: { body: 'apc90' } },
  },
  interwar: {
    _all: { speed: 0.70, cost: 0.88, buildTime: 0.90 },
    rifle:   { hp: 0.92, w: [{ name: 'Rifle and Lewis gun', range: 3.9, damage: 11, rof: 0.75 }] },
    at:      { cost: 0.82, ammoMax: 10, w: [{ name: 'Anti-tank rifle', range: 4.6, damage: 60, type: 'ap', rof: 2.4, projectile: 'bullet', accuracy: 0.82 }] },
    engineer: {},
    recon:   { vision: 0.86, w: [{ range: 3.6, damage: 8 }] },
    manpads: { cost: 0.88, ammoMax: 12, interceptor: { ballistic: 0, cruise: 0, rocket: 0, loiter: 0.30, aircraft: 0.34, range: 6.4, reload: 3.2, needsData: false },
               w: [{ name: 'High-angle machine gun', range: 6.4, damage: 95, projectile: 'bullet', rof: 2.6 }] },
    sf:      { w: [{ range: 4.2, damage: 15 }, {}] },
    mbt:     { cost: 0.62, hp: 0.56, speed: 0.52, frontalArc: 0.34, turretRate: 0.55, ammoMax: 12,
               w: [{ name: 'Turret gun', range: 5.0, damage: 64, rof: 5.4, accuracy: 0.80 }, { range: 3.6, damage: 7 }],
               art: { len: 0.70, wid: 0.50 } },
    ifv:     { cost: 0.90, hp: 0.92, speed: 0.44, cargo: 4, ammoMax: 14, turretRate: 0.7,
               w: [{ name: 'Sponson gun', range: 4.6, damage: 34, type: 'he', rof: 2.6, projectile: 'shell', burst: 1, splash: 0.5 }],
               dropWeapons: 1, art: { body: 'rhomboid', len: 0.92, wid: 0.46 } },
    apc:     { hp: 0.74, speed: 0.82, art: { len: 0.74, wid: 0.46 } },
    scout:   { cost: 0.95, hp: 0.70, speed: 1.05, vision: 0.90, art: { len: 0.64, wid: 0.40 } },
    spg:     { cost: 0.95, hp: 0.86, speed: 0.55, ammoMax: 12,
               w: [{ name: 'Field battery', range: 13.5, damage: 108, rof: 7.5, spread: 1.5, accuracy: 0.62 }] },
    mlrs:    { cost: 0.92, hp: 0.86, speed: 0.50, ammoMax: 5,
               w: [{ name: 'Heavy battery barrage', range: 16.5, minRange: 6, damage: 96, type: 'he', rof: 20,
                     projectile: 'arc', salvo: 4, spread: 2.4, accuracy: 0.55, threat: null }],
               art: { body: 'heavygun', len: 0.84, wid: 0.48, tracks: false } },
    aa:      { cost: 0.90, hp: 0.80, speed: 0.76, ammoMax: 14,
               interceptor: { ballistic: 0, cruise: 0, rocket: 0, loiter: 0.38, aircraft: 0.44, range: 7.8, reload: 3.0, needsData: false },
               w: [{ name: 'High-angle gun', range: 7.8, damage: 140, projectile: 'bullet', rof: 2.6 }, { range: 3.6 }] },
    eng:     { hp: 0.82, speed: 0.82 },
    patrol:  { hp: 0.82, w: [{ name: 'Deck gun and torpedoes', range: 6.0, damage: 40, rof: 2.0 }] },
    landing: { hp: 0.90 },
    frigate: { hp: 0.86, interceptor: { ballistic: 0, cruise: 0, rocket: 0, loiter: 0.22, aircraft: 0.30, range: 6.5, reload: 4.0, needsData: false },
               w: [{ name: 'Main battery', range: 10, damage: 96, rof: 3.6 }, { name: 'AA guns', range: 6.5, damage: 110, projectile: 'bullet' }] },
    destroyer: { cost: 1.10, hp: 1.30, speed: 0.74, ammoMax: 22, missilePlatform: true,
               interceptor: { ballistic: 0, cruise: 0, rocket: 0, loiter: 0.26, aircraft: 0.36, range: 8, reload: 3.4, needsData: false },
               w: [{ name: 'Main battery', range: 15.5, damage: 205, rof: 5.2, splash: 2.1 }, { name: 'AA battery', range: 8, damage: 150, projectile: 'bullet' }] },
    support: { w: [{ name: 'Monitor turret', range: 15.5, damage: 190, rof: 8.5, spread: 1.4 }] },
    himars:  { cost: 1.05, hp: 1.10, speed: 0.40, ammoMax: 4, needsData: 0,
               w: [{ name: 'Railway gun', range: 26, minRange: 9, damage: 270, type: 'he', rof: 22,
                     projectile: 'arc', salvo: 2, spread: 1.2, accuracy: 0.70, threat: null }],
               art: { body: 'heavygun', len: 1.02, wid: 0.52, tracks: false } },
    phl16:   { hp: 1.05, speed: 0.34, ammoMax: 4, needsData: 0,
               w: [{ name: 'Siege mortar', range: 22, minRange: 8, damage: 320, type: 'he', rof: 24,
                     projectile: 'arc', salvo: 2, spread: 1.8, accuracy: 0.60, threat: null }],
               art: { body: 'heavygun', len: 0.96, wid: 0.54, tracks: false } },
  },
};

/** Apply one era modifier block to a resolved unit definition. */
function applyEraMod(def, mod) {
  if (!mod) return;
  for (const k of ['hp', 'speed', 'vision', 'turretRate', 'turnRate']) {
    if (mod[k] !== undefined) def[k] = +(def[k] * mod[k]).toFixed(3);
  }
  // Period equipment is priced against what it can actually do: a Vickers Medium
  // is not a Leopard 2 and must not cost like one, or armour is never worth
  // building and 1926 collapses into an infantry stalemate.
  if (mod.cost !== undefined) def.cost = Math.round(def.cost * mod.cost / 10) * 10;
  if (mod.buildTime !== undefined) def.buildTime = +(def.buildTime * mod.buildTime).toFixed(1);
  for (const k of ['ammoMax', 'cargo', 'frontalArc', 'needsData', 'missilePlatform']) {
    if (mod[k] !== undefined) def[k] = mod[k];
  }
  if (mod.interceptor) def.interceptor = Object.assign({}, def.interceptor, mod.interceptor);
  if (mod.art) Object.assign(def.art, mod.art);
  if (mod.dropWeapons) def.weapons.length = Math.max(1, def.weapons.length - mod.dropWeapons);
  if (mod.w) {
    mod.w.forEach((patch, i) => {
      if (!def.weapons[i]) return;
      for (const key of Object.keys(patch)) {
        if (patch[key] === null) delete def.weapons[i][key];
        else def.weapons[i][key] = patch[key];
      }
    });
  }
}

const cache = new Map();

/** Merge archetype + equipment naming + coalition modifiers into a concrete unit definition. */
export function getUnit(faction, era, key) {
  const id = faction + '|' + era + '|' + key;
  const hit = cache.get(id);
  if (hit) return hit;

  const base = ARCHETYPES[key];
  if (!base) return null;
  const eq = EQ[faction] && EQ[faction][era] && EQ[faction][era][key];
  if (!eq) return null;

  const def = JSON.parse(JSON.stringify(base));
  def.id = id;
  def.faction = faction;
  def.era = era;
  def.name = eq[0];
  def.flavour = eq[1];
  def.colour = FACTIONS[faction].colour;

  const eraSet = ERA_MODS[era];
  if (eraSet) { applyEraMod(def, eraSet._all); applyEraMod(def, eraSet[key]); }

  const mods = (FACTION_MODS[faction] || {})[key];
  if (mods) {
    if (mods.hp) def.hp = Math.round(def.hp * mods.hp);
    if (mods.cost) def.cost = Math.round(def.cost * mods.cost / 5) * 5;
    if (mods.buildTime) def.buildTime = +(def.buildTime * mods.buildTime).toFixed(1);
    if (mods.speed) def.speed = +(def.speed * mods.speed).toFixed(3);
    for (const w of def.weapons) {
      if (mods.damage) w.damage = Math.round(w.damage * mods.damage);
      if (mods.range) w.range = +(w.range * mods.range).toFixed(2);
      if (mods.rof) w.rof = +(w.rof * mods.rof).toFixed(2);
    }
    if (mods.range && def.interceptor) def.interceptor.range = +(def.interceptor.range * mods.range).toFixed(2);
  }
  // Global pacing scalars, applied after the coalition modifiers. Durability keeps
  // engagements from resolving in two volleys; the movement scalar lengthens every
  // approach, reinforcement and withdrawal so position and terrain carry weight.
  // (A build-time scalar was tried here and removed: it thinned out the fighting
  // without measurably changing how long a match ran.)
  def.hp = Math.round(def.hp * 1.15);
  def.speed = +(def.speed * 0.85).toFixed(3);
  def.hpMax = def.hp;
  cache.set(id, def);
  return def;
}

/** Which unit keys this coalition/era can field, in sidebar order. */
export function rosterFor(faction, era, category) {
  return UNIT_ORDER[category].filter((k) => !!(EQ[faction] && EQ[faction][era] && EQ[faction][era][k]));
}

export function allUnitKeysFor(faction, era) {
  return ['infantry', 'vehicle', 'naval'].flatMap((c) => rosterFor(faction, era, c));
}
