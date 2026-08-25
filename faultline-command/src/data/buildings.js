// Structures. Prerequisites, power draw and data links are the whole point here:
// every building either unlocks something or keeps something else alive.

const B = (o) => Object.assign({
  cost: 500, buildTime: 10, hp: 900, size: 3, power: 0, prereq: [], produces: null,
  category: 'structure', dataLinks: 0, dataUse: 0, needsPower: false, weapons: [],
  padType: 'structure', desc: '', art: 'generic', unique: false, limit: 99,
}, o);

const DW = (o) => Object.assign({
  name: 'Weapon', range: 6, minRange: 0, damage: 20, type: 'small', rof: 1,
  splash: 0, projectile: 'bullet', burst: 1, salvo: 1, ammoCost: 0,
  targets: ['land', 'naval'], accuracy: 0.9, arcing: false, spread: 0,
}, o);

export const BUILDINGS = {
  hq: B({
    key: 'hq', name: 'Command Headquarters', short: 'HQ', cost: 0, buildTime: 0, hp: 10500, size: 4,
    power: 0, category: 'core', art: 'hq', unique: true, limit: 1, critical: true,
    buildsStructures: true, produces: ['engineer'], baseIncome: 11,
    desc: 'The fortified nerve centre. Authorises all construction, draws the national defence budget and runs on its own generator set. Lose it and the battle is over.',
  }),
  power: B({
    key: 'power', name: 'Power Station', short: 'PWR', cost: 620, buildTime: 11, hp: 1250, size: 3,
    power: 42, category: 'core', art: 'power',
    desc: 'Generates 42 MW. Without surplus power, production crawls and every radar-guided system goes dark.',
  }),
  barracks: B({
    key: 'barracks', name: 'Barracks', short: 'BRK', cost: 520, buildTime: 10, hp: 1380, size: 3,
    power: -6, category: 'production', art: 'barracks', produces: ['rifle', 'at', 'engineer', 'recon', 'manpads', 'sf'],
    desc: 'Trains infantry. Cheap, fast, and the only way to capture oil infrastructure.',
  }),
  factory: B({
    key: 'factory', name: 'Armoured Vehicle Factory', short: 'FAC', cost: 2050, buildTime: 22, hp: 1900, size: 4,
    power: -20, category: 'production', art: 'factory', needsPower: true,
    prereq: ['power', 'barracks'], produces: ['scout', 'apc', 'ifv', 'mbt', 'eng', 'aa'],
    desc: 'Builds the armoured fleet. Requires steady power; production halves in a brown-out.',
  }),
  artillery: B({
    key: 'artillery', name: 'Artillery & Munitions Complex', short: 'ART', cost: 1650, buildTime: 20, hp: 1650, size: 4,
    power: -18, category: 'production', art: 'artillery', needsPower: true, prereq: ['factory'],
    produces: ['spg', 'mlrs', 'himars', 'phl16'], ammoRate: 5.2,
    desc: 'Builds tube and rocket artillery AND manufactures replacement ammunition. Lose it and your guns fire only what they already carry.',
  }),
  repair: B({
    key: 'repair', name: 'Repair Depot', short: 'REP', cost: 900, buildTime: 14, hp: 1380, size: 3,
    power: -8, category: 'support', art: 'repair', prereq: ['factory'],
    repairRate: 46, repairRadius: 7.5, rearmRate: 2.8,
    desc: 'Repairs and rearms vehicles parked nearby. Restores mobility and weapon damage that field repairs cannot.',
  }),
  radar: B({
    key: 'radar', name: 'Radar Station', short: 'RDR', cost: 1000, buildTime: 14, hp: 1080, size: 3,
    power: -16, category: 'support', art: 'radar', needsPower: true, prereq: ['power'],
    radarRange: 999, providesRadar: true,
    desc: 'Enables the minimap radar picture and is required by every guided weapon and networked interceptor you own.',
  }),
  data: B({
    key: 'data', name: 'Data Centre', short: 'DAT', cost: 1450, buildTime: 18, hp: 1000, size: 3,
    power: -24, category: 'support', art: 'data', needsPower: true, prereq: ['radar'],
    dataLinks: 8, critical: true,
    desc: 'Fuses the sensor picture into eight data links. Precision strikes and networked missile defence both die with it.',
  }),
  awc: B({
    key: 'awc', name: 'Advanced Weapons Command', short: 'AWC', cost: 2650, buildTime: 28, hp: 1780, size: 4,
    power: -32, category: 'support', art: 'awc', needsPower: true, prereq: ['data', 'artillery'], dataUse: 2,
    desc: 'Releases theatre-level fires: precision strikes, cruise missiles, loitering munitions and the advanced interceptor batteries.',
  }),
  oiladmin: B({
    key: 'oiladmin', name: 'Oil Administration Facility', short: 'OIL', cost: 950, buildTime: 14, hp: 1120, size: 3,
    power: -8, category: 'core', art: 'oil', prereq: ['power'], oilBonus: 0.35, baseIncome: 3,
    desc: 'Administers four more oil sites at full yield and raises their output by 35%. Sites beyond your administrative capacity produce only 42%.',
  }),
  navalyard: B({
    key: 'navalyard', name: 'Naval Yard', short: 'NVY', cost: 1850, buildTime: 22, hp: 1780, size: 4,
    power: -18, category: 'production', art: 'navalyard', needsPower: true, prereq: ['factory'],
    produces: ['patrol', 'landing', 'frigate', 'support', 'destroyer'], padType: 'naval', coastalOnly: true,
    desc: 'Builds and berths warships. Only available where there is a shoreline to build it on.',
  }),

  // ------------------------------------------------------------- defences
  mg: B({
    key: 'mg', name: 'Machine-Gun Defence', short: 'MG', cost: 350, buildTime: 6, hp: 790, size: 2,
    power: -2, category: 'defence', art: 'mg', padType: 'defence',
    weapons: [DW({ name: 'Sustained-fire MG', range: 6.0, damage: 20, type: 'small', rof: 0.32, burst: 4 })],
    desc: 'Cheap infantry deterrent. Will not scratch a tank.',
  }),
  atgun: B({
    key: 'atgun', name: 'Anti-Tank Defence', short: 'ATG', cost: 720, buildTime: 10, hp: 1000, size: 2,
    power: -5, category: 'defence', art: 'atgun', padType: 'defence', prereq: ['barracks'], ammoMax: 12,
    weapons: [DW({ name: 'Emplaced ATGM', range: 8.2, damage: 118, type: 'heat', rof: 2.9, projectile: 'missile', ammoCost: 1 })],
    desc: 'Emplaced anti-tank missiles. Excellent value against armour, useless against a rifle section that walks around it.',
  }),
  sam: B({
    key: 'sam', name: 'Air & Missile Defence', short: 'SAM', cost: 1150, buildTime: 14, hp: 900, size: 3,
    power: -16, category: 'defence', art: 'sam', padType: 'defence', prereq: ['radar'], needsPower: true,
    dataUse: 1, ammoMax: 14,
    interceptor: { ballistic: 0.16, cruise: 0.40, rocket: 0.20, loiter: 0.55, aircraft: 0.62, range: 11.5, reload: 3.2, needsData: true },
    weapons: [DW({ name: 'Medium SAM', range: 11.5, damage: 240, type: 'aa', rof: 2.4, projectile: 'missile', targets: ['air'], ammoCost: 1 })],
    desc: 'The general-purpose interceptor battery. Needs radar, power and a data link to engage anything at all.',
  }),
  coastal: B({
    key: 'coastal', name: 'Coastal Defence Battery', short: 'CDB', cost: 1300, buildTime: 16, hp: 1320, size: 3,
    power: -10, category: 'defence', art: 'coastal', padType: 'naval', prereq: ['artillery'], ammoMax: 16, coastalOnly: true,
    weapons: [DW({ name: 'Coastal gun/missile', range: 15.5, damage: 210, type: 'navalGun', rof: 4.6, projectile: 'shell', splash: 1.4, ammoCost: 1, accuracy: 0.86 })],
    desc: 'Long-range anti-ship battery. Makes an entire stretch of coastline unusable to enemy hulls.',
  }),

  // --------------------------------------------- signature interceptor sites
  heavyaa: B({
    key: 'heavyaa', name: 'Heavy Anti-Aircraft Sector', short: 'HAA', cost: 1900, buildTime: 20, hp: 980, size: 3,
    power: -20, category: 'signature', art: 'sam', padType: 'defence', prereq: ['awc'], needsPower: true,
    dataUse: 2, ammoMax: 16, signature: 'heavyaa',
    interceptor: { ballistic: 0, cruise: 0, rocket: 0, loiter: 0.42, aircraft: 0.72, range: 16, reload: 3.2, needsData: true },
    weapons: [DW({ name: 'QF 3-inch high-angle gun', range: 16, damage: 320, type: 'aa', rof: 3.0, projectile: 'shell', targets: ['air'], ammoCost: 1 })],
    desc: 'Heavy high-angle guns tied to sound locators and searchlights. The only thing in 1926 that reliably brings down a bomber — and it cannot touch an artillery shell.',
    eraNames: { interwar: 'Heavy Anti-Aircraft Sector' },
  }),
  balloons: B({
    key: 'balloons', name: 'Balloon Barrage & Gun Section', short: 'BAL', cost: 900, buildTime: 13, hp: 820, size: 3,
    power: -8, category: 'signature', art: 'irondome', padType: 'defence', prereq: ['radar'], needsPower: true,
    dataUse: 0, ammoMax: 10, signature: 'balloons',
    interceptor: { ballistic: 0, cruise: 0, rocket: 0, loiter: 0.70, aircraft: 0.34, range: 11, reload: 1.8, needsData: false },
    weapons: [DW({ name: 'Balloon cables and light AA', range: 11, damage: 180, type: 'aa', rof: 1.6, projectile: 'missile', targets: ['air'], ammoCost: 1 })],
    desc: 'Cabled balloons flown over the position with a light gun section beneath. Murder on anything trying to come in low; a high-flying bomber sails straight over the top.',
    eraNames: { interwar: 'Balloon Barrage & Gun Section' },
  }),
  patriot: B({
    key: 'patriot', name: 'Patriot Missile Battery', short: 'PAT', cost: 2400, buildTime: 24, hp: 1030, size: 3,
    power: -28, category: 'signature', art: 'patriot', padType: 'defence', prereq: ['awc'], needsPower: true,
    dataUse: 3, ammoMax: 12, signature: 'patriot',
    interceptor: { ballistic: 0.56, cruise: 0.52, rocket: 0.18, loiter: 0.34, aircraft: 0.74, range: 19, reload: 3.0, needsData: true },
    weapons: [DW({ name: 'PAC interceptor', range: 19, damage: 400, type: 'aa', rof: 2.8, projectile: 'missile', targets: ['air'], ammoCost: 1 })],
    desc: 'Theatre missile defence. Very strong against ballistic and cruise missiles, poor against cheap rocket salvos.',
    eraNames: { nineties: 'Patriot PAC-2 Battery', modern: 'Patriot PAC-3 Battery' },
    eraStats: { nineties: { ballistic: -0.10, cruise: -0.06 } },
  }),
  s400: B({
    key: 's400', name: 'S-400 Long-Range Defence', short: 'S400', cost: 2500, buildTime: 25, hp: 1060, size: 3,
    power: -30, category: 'signature', art: 's400', padType: 'defence', prereq: ['awc'], needsPower: true,
    dataUse: 3, ammoMax: 12, signature: 's400',
    interceptor: { ballistic: 0.58, cruise: 0.58, rocket: 0.14, loiter: 0.40, aircraft: 0.80, range: 22, reload: 3.2, needsData: true },
    weapons: [DW({ name: 'Long-range SAM', range: 22, damage: 430, type: 'aa', rof: 3.0, projectile: 'missile', targets: ['air'], ammoCost: 1 })],
    desc: 'The longest reach on the board. Dominates the sky over a huge area — until its data link is cut.',
    eraNames: { nineties: 'S-300PMU Battery', modern: 'S-400 Triumf Battery' },
    eraStats: { nineties: { ballistic: -0.14, cruise: -0.10, range: -4 } },
  }),
  hq9: B({
    key: 'hq9', name: 'HQ-9 Air Defence Battery', short: 'HQ9', cost: 2350, buildTime: 24, hp: 1040, size: 3,
    power: -27, category: 'signature', art: 'hq9', padType: 'defence', prereq: ['awc'], needsPower: true,
    dataUse: 3, ammoMax: 12, signature: 'hq9',
    interceptor: { ballistic: 0.50, cruise: 0.52, rocket: 0.16, loiter: 0.38, aircraft: 0.72, range: 18.5, reload: 2.9, needsData: true },
    weapons: [DW({ name: 'Long-range SAM', range: 18.5, damage: 390, type: 'aa', rof: 2.8, projectile: 'missile', targets: ['air'], ammoCost: 1 })],
    desc: 'Networked area air defence tuned for saturation attacks.',
    eraNames: { nineties: 'HQ-2 Air Defence Site', modern: 'HQ-9B Air Defence Battery' },
    eraStats: { nineties: { ballistic: -0.22, cruise: -0.16, aircraft: -0.10, range: -5 } },
  }),
  irondome: B({
    key: 'irondome', name: 'Short-Range Interception System', short: 'SRI', cost: 1900, buildTime: 20, hp: 950, size: 3,
    power: -22, category: 'signature', art: 'irondome', padType: 'defence', prereq: ['awc'], needsPower: true,
    dataUse: 2, ammoMax: 20, signature: 'irondome',
    interceptor: { ballistic: 0.20, cruise: 0.34, rocket: 0.78, loiter: 0.62, aircraft: 0.36, range: 13, reload: 1.5, needsData: true },
    weapons: [DW({ name: 'Interceptor', range: 13, damage: 200, type: 'aa', rof: 1.4, projectile: 'missile', targets: ['air'], ammoCost: 1 })],
    desc: 'Iron Dome-style rocket interception. Eats artillery rocket salvos and loitering munitions; wasted on ballistic missiles.',
    eraNames: { modern: 'Iron Dome Interception Battery' },
  }),
};

export const BUILD_ORDER = [
  'power', 'barracks', 'factory', 'artillery', 'repair', 'radar', 'data', 'awc',
  'oiladmin', 'navalyard',
];
export const DEFENCE_ORDER = ['mg', 'atgun', 'sam', 'coastal', 'balloons', 'heavyaa', 'patriot', 's400', 'hq9', 'irondome'];

// Which signature interceptor each coalition fields, per era.
export const SIGNATURE_DEFENCE = {
  arc: { interwar: ['balloons', 'heavyaa'], nineties: ['patriot'], modern: ['patriot'] },
  esd: { interwar: ['heavyaa'], nineties: ['s400'], modern: ['s400'] },
  pdc: { interwar: ['heavyaa'], nineties: ['hq9'], modern: ['hq9'] },
  mrl: { interwar: ['balloons', 'heavyaa'], nineties: ['patriot'], modern: ['patriot', 'irondome'] },
};

/**
 * 1926 has no radar, no computers and no guided weapons, so the infrastructure
 * spine keeps its function under period names: wireless and observation instead
 * of radar, a cipher and telephone office instead of a data centre.
 */
const ERA_BUILDING = {
  interwar: {
    hq:        ['General Headquarters', 'The fortified staff headquarters. Authorises all construction, draws the national defence estimate and runs its own generator set. Lose it and the campaign is over.'],
    power:     ['Generator Station', 'Drives the workshops, the searchlights and the wireless sets. Without surplus current, production crawls and the observation network goes deaf.'],
    barracks:  ['Depot Barracks', 'Trains infantry. Cheap, quick, and the only way to take an oil field intact.'],
    factory:   ['Tank Works', 'Builds the armoured fleet. Needs steady current; output halves in a brown-out.'],
    artillery: ['Ordnance Works & Shell-Filling Plant', 'Builds heavy artillery AND fills replacement shell. Lose it and every gun you own fires what it is already carrying, then stops.'],
    repair:    ['Field Workshop', 'Repairs and re-ammunitions vehicles parked nearby, and puts thrown tracks back on.'],
    radar:     ['Signals & Observation Post', 'Wireless masts, observation balloons and a sound-ranging section. Required by every co-ordinated shoot and every air-defence engagement you make.'],
    data:      ['Signals Corps Headquarters', 'Telephone exchange, cipher office and the artillery fire-direction staff. Co-ordinated bombardment and directed air defence both die with it.'],
    awc:       ['Ordnance Experimental Command', 'Releases the theatre-level weapons: bomber raids, siege guns, naval gunfire and the heavy anti-aircraft sectors.'],
    oiladmin:  ['Petroleum Administration', 'Administers four more oil sites at full yield and raises their output by 35%. Sites past your administrative capacity produce only 42%.'],
    navalyard: ['Naval Dockyard', 'Builds and berths warships. Only where there is a shoreline to build it on.'],
    mg:        ['Machine-Gun Redoubt', 'Sandbagged emplacement with interlocking arcs. Cheap, and it will not scratch a tank.'],
    atgun:     ['Anti-Tank Gun Emplacement', 'A field gun dug in to fire over open sights. Excellent value against armour; a rifle section simply walks around it.'],
    sam:       ['Anti-Aircraft Battery', 'The general-purpose high-angle battery. Needs the observation post, current and a live telephone line to engage anything at all.'],
    coastal:   ['Coastal Gun Battery', 'Long-range naval guns in concrete. Makes a whole stretch of coastline unusable to enemy shipping.'],
  },
};

export function buildingAvailable(key, faction, era, coastal) {
  const d = BUILDINGS[key];
  if (!d) return false;
  if (d.coastalOnly && !coastal) return false;
  if (d.category === 'signature') {
    const list = (SIGNATURE_DEFENCE[faction] || {})[era] || [];
    return list.includes(key);
  }
  return true;
}

/**
 * Structure toughness by era. A 1926 installation is brick, sandbags and
 * corrugated iron; a modern one is hardened concrete. Without this the era's
 * heaviest shell cannot crack a headquarters and matches never resolve.
 */
const ERA_STRUCTURE_HP = { interwar: 0.58 };

/*
 * Construction cost by era. A 1926 "data centre" is a signals office with a
 * switchboard and a cipher room, not a networked command node, and it must be
 * priced like one — otherwise the tech tree eats an interwar economy alive and
 * neither side ever reaches its oil administration or its gun works.
 */
const ERA_STRUCTURE_COST = {
  interwar: { _all: 0.88, radar: 0.65, data: 0.65, awc: 0.75 },
};

const bcache = new Map();

/** Building definition resolved for a coalition and era (names + interceptor tuning). */
export function getBuilding(key, faction, era) {
  const id = key + '|' + faction + '|' + era;
  const hit = bcache.get(id);
  if (hit) return hit;
  const base = BUILDINGS[key];
  if (!base) return null;
  const def = JSON.parse(JSON.stringify(base));
  def.id = id;
  if (def.eraNames && def.eraNames[era]) def.name = def.eraNames[era];
  const eraEntry = (ERA_BUILDING[era] || {})[key];
  if (eraEntry) { def.name = eraEntry[0]; def.desc = eraEntry[1]; }
  const es = def.eraStats && def.eraStats[era];
  if (es && def.interceptor) {
    for (const k of Object.keys(es)) {
      if (k === 'range') { def.interceptor.range += es.range; def.weapons.forEach((w) => { w.range += es.range; }); }
      else def.interceptor[k] = Math.max(0, def.interceptor[k] + es[k]);
    }
  }
  const hpScale = ERA_STRUCTURE_HP[era];
  if (hpScale) def.hp = Math.round(def.hp * hpScale);
  const costSet = ERA_STRUCTURE_COST[era];
  if (costSet && def.cost) {
    const mult = (costSet._all || 1) * (costSet[key] || 1);
    def.cost = Math.round(def.cost * mult / 10) * 10;
    def.buildTime = +(def.buildTime * (0.5 + mult * 0.5)).toFixed(1);
  }
  def.hpMax = def.hp;
  bcache.set(id, def);
  return def;
}

export function structureList(faction, era, coastal) {
  return BUILD_ORDER.filter((k) => buildingAvailable(k, faction, era, coastal));
}
export function defenceList(faction, era, coastal) {
  return DEFENCE_ORDER.filter((k) => buildingAvailable(k, faction, era, coastal));
}
