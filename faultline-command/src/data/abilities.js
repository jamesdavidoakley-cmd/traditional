// Theatre-level fires. Each is a genuinely different battlefield event: different
// flight profile, different interception odds, different thing it is good at killing.

import { THREAT } from './damage.js';

export const ABILITIES = {
  bomberraid: {
    key: 'bomberraid', name: 'Night Bomber Raid', short: 'BMB', icon: 'jet',
    eras: ['interwar'], factions: ['arc', 'esd', 'pdc', 'mrl'],
    nameByFaction: {
      arc: 'Handley Page Night Raid', esd: 'Tupolev TB-1 Raid',
      pdc: 'Naval Bomber Raid', mrl: 'Caproni Night Raid',
    },
    cost: 1000, cooldown: 120, targeting: 'point', threat: THREAT.AIRCRAFT,
    requires: { buildings: ['awc', 'radar'], data: 2, power: true, ammo: 6 },
    flight: { speed: 4.6, altitude: 'high', approach: 'edge' },
    payload: { count: 4, damage: 300, type: 'he', splash: 2.9, spread: 2.2, interval: 0.45 },
    desc: 'A flight of heavy biplane bombers runs in from the map edge under darkness. Slow, loud, and visible on the way in — every anti-aircraft gun between them and the target gets a go.',
    tip: 'Devastating against a base with no high-angle guns. Suicidal against a Heavy Anti-Aircraft Sector.',
  },
  strafing: {
    key: 'strafing', name: 'Ground Attack Squadron', short: 'ATK', icon: 'drone',
    eras: ['interwar'], factions: ['arc', 'pdc'],
    nameByFaction: { arc: 'DH.9A Ground Attack Flight', pdc: 'Naval Attack Flight' },
    cost: 780, cooldown: 105, targeting: 'point', threat: THREAT.LOITER,
    requires: { buildings: ['awc', 'radar'], data: 2, power: true, ammo: 5 },
    flight: { speed: 5.0, altitude: 'low', approach: 'edge' },
    payload: { count: 4, damage: 165, type: 'heat', splash: 0.9, reveal: 11, revealTime: 26, hunt: true },
    desc: 'Four ground-attack biplanes work over a chosen area, picking off the heaviest vehicles they can find one at a time.',
    tip: 'Excellent against parked artillery and unescorted armour. Balloon barrages and machine guns tear them apart.',
  },
  airrecon: {
    key: 'airrecon', name: 'Observation & Reconnaissance Flight', short: 'OBS', icon: 'drone',
    eras: ['interwar'], factions: ['arc', 'esd', 'pdc', 'mrl'],
    cost: 380, cooldown: 65, targeting: 'point', threat: THREAT.LOITER,
    requires: { buildings: ['radar', 'data'], data: 1, power: true, ammo: 0 },
    flight: { speed: 4.2, altitude: 'medium', approach: 'edge' },
    payload: { count: 0, damage: 0, reveal: 13, revealTime: 36 },
    desc: 'An observation aircraft and a tethered balloon section put eyes over a chosen area and telephone back what they see.',
    tip: 'Your guns cannot shoot at what nobody can see. Cheap, and worth flying before every bombardment.',
  },
  siegegun: {
    key: 'siegegun', name: 'Super-Heavy Siege Gun', short: 'SIEGE', icon: 'ballistic',
    eras: ['interwar'], factions: ['esd', 'mrl'],
    nameByFaction: { esd: 'Long-Range Bombardment Gun', mrl: 'Super-Heavy Siege Gun' },
    cost: 1500, cooldown: 165, targeting: 'point', threat: THREAT.BALLISTIC,
    interceptable: false,
    requires: { buildings: ['awc', 'artillery'], data: 1, power: true, ammo: 12 },
    flight: { speed: 11.0, altitude: 'ballistic', approach: 'edge' },
    payload: { count: 1, damage: 900, type: 'cruise', splash: 3.8, spread: 2.8 },
    desc: 'One enormous shell from a gun sited far behind the line. There is nothing in 1926 that can shoot down a shell, so the only defence is to find the gun.',
    tip: 'Aim at dense clusters of buildings — the error budget is measured in tens of metres, not metres.',
  },
  soundranging: {
    key: 'soundranging', name: 'Sound-Ranging Counter-Battery', short: 'CB', icon: 'cruise',
    eras: ['interwar'], factions: ['esd', 'mrl'],
    cost: 900, cooldown: 115, targeting: 'point', threat: null,
    interceptable: false,
    requires: { buildings: ['artillery', 'data'], data: 2, power: true, ammo: 8 },
    flight: { speed: 12.0, altitude: 'ballistic', approach: 'edge' },
    payload: { count: 5, damage: 190, type: 'he', splash: 2.3, spread: 2.6, interval: 0.5, reveal: 14, revealTime: 22 },
    desc: 'Microphone arrays and flash-spotting posts fix the enemy guns by the sound of them firing, and the corps artillery answers within the minute.',
    tip: 'Reveals the area as the shells land. The counter to an enemy who is winning the artillery duel.',
  },
  navalguns: {
    key: 'navalguns', name: 'Battleship Gunfire Support', short: 'BB', icon: 'cruise',
    eras: ['interwar'], factions: ['arc', 'pdc'],
    cost: 1350, cooldown: 150, targeting: 'point', threat: null,
    interceptable: false,
    requires: { buildings: ['navalyard'], units: ['destroyer'], data: 1, power: true, ammo: 10 },
    flight: { speed: 9.0, altitude: 'ballistic', approach: 'launcher' },
    payload: { count: 4, damage: 420, type: 'cruise', splash: 3.0, spread: 1.6, interval: 0.9 },
    desc: 'A capital ship offshore fires a full broadside onto a map reference. The shells come from wherever the ship happens to be lying.',
    tip: 'Keep the battleship alive and out of reach of coastal guns; the bearing of the shoot is wherever you have parked it.',
  },
  airstrike: {
    key: 'airstrike', name: 'Precision Air Strike', short: 'AIR', icon: 'jet',
    eras: ['nineties', 'modern'], factions: ['arc', 'esd', 'pdc', 'mrl'],
    cost: 900, cooldown: 105, targeting: 'point', threat: THREAT.AIRCRAFT,
    requires: { buildings: ['awc', 'radar'], data: 2, power: true, ammo: 6 },
    flight: { speed: 9.5, altitude: 'high', warnRange: 999, approach: 'edge' },
    payload: { count: 3, damage: 260, type: 'he', splash: 2.6, spread: 1.5, interval: 0.35 },
    desc: 'An off-map strike package runs in from the map edge. Three heavy bombs, a wide footprint, and it can be shot down on the way in.',
    tip: 'Best against production buildings and packed formations. Suppress air defences first.',
  },
  droneRecon: {
    key: 'droneRecon', name: 'Reconnaissance Drone Sweep', short: 'UAV', icon: 'drone',
    eras: ['nineties'], factions: ['arc', 'esd', 'pdc', 'mrl'],
    cost: 450, cooldown: 70, targeting: 'point', threat: THREAT.LOITER,
    requires: { buildings: ['radar', 'data'], data: 1, power: true, ammo: 0 },
    flight: { speed: 5.2, altitude: 'medium', approach: 'edge' },
    payload: { count: 0, damage: 0, reveal: 13, revealTime: 34 },
    desc: 'An unarmed reconnaissance drone orbits a chosen area and feeds the picture back for half a minute.',
    tip: 'Cheap eyes for artillery. Vulnerable to any air defence it flies over.',
  },
  loiter: {
    key: 'loiter', name: 'Networked Recon & Loitering Munitions', short: 'LOI', icon: 'drone',
    eras: ['modern'], factions: ['arc', 'esd', 'pdc', 'mrl'],
    nameByFaction: {
      pdc: 'Reconnaissance-Strike Complex',
      esd: 'Loitering Munition Swarm',
      mrl: 'Networked Loitering Munitions',
      arc: 'Networked ISR-Strike Package',
    },
    cost: 1150, cooldown: 125, targeting: 'point', threat: THREAT.LOITER,
    requires: { buildings: ['awc', 'radar', 'data'], data: 3, power: true, ammo: 8 },
    flight: { speed: 4.6, altitude: 'low', approach: 'edge' },
    payload: { count: 5, damage: 190, type: 'heat', splash: 1.0, reveal: 12, revealTime: 30, hunt: true },
    desc: 'A sensor drone reveals the area, then five loitering munitions hunt the highest-value vehicles inside it, one by one.',
    tip: 'Superb against parked artillery and unescorted armour. Short-range interceptors eat it alive.',
  },
  stormshadow: {
    key: 'stormshadow', name: 'Storm Shadow Precision Strike', short: 'SS', icon: 'cruise',
    eras: ['modern'], factions: ['arc', 'mrl'],
    cost: 1700, cooldown: 175, targeting: 'point', threat: THREAT.CRUISE,
    requires: { buildings: ['awc', 'data'], data: 3, power: true, ammo: 10 },
    flight: { speed: 6.4, altitude: 'low', approach: 'edge', evasive: 0.18 },
    payload: { count: 2, damage: 780, type: 'cruise', splash: 2.0, spread: 0.35, interval: 1.4, bunkerBuster: true },
    desc: 'Two low-flying stand-off cruise missiles with hardened penetrating warheads. Built to gut a specific building.',
    tip: 'The cleanest way to remove a Data Centre or Advanced Weapons Command. Terrain-hugging: long-range radars struggle with it.',
  },
  popeye: {
    key: 'popeye', name: 'Standoff Precision Missile', short: 'SPM', icon: 'cruise',
    eras: ['nineties'], factions: ['mrl'],
    cost: 1400, cooldown: 165, targeting: 'point', threat: THREAT.CRUISE,
    requires: { buildings: ['awc', 'data'], data: 2, power: true, ammo: 8 },
    flight: { speed: 6.0, altitude: 'medium', approach: 'edge' },
    payload: { count: 2, damage: 560, type: 'cruise', splash: 2.0, spread: 0.6, interval: 1.5 },
    desc: 'A pair of stand-off missiles guided onto a fixed installation. The decade before terrain-following seekers.',
    tip: 'Slower and higher than a modern cruise missile, so easier for a Patriot to catch.',
  },
  tomahawk: {
    key: 'tomahawk', name: 'Tomahawk Naval Strike', short: 'TLAM', icon: 'cruise',
    eras: ['nineties', 'modern'], factions: ['arc'],
    cost: 1550, cooldown: 160, targeting: 'point', threat: THREAT.CRUISE,
    requires: { buildings: ['navalyard'], units: ['destroyer'], data: 2, power: true, ammo: 10 },
    flight: { speed: 5.4, altitude: 'low', approach: 'launcher' },
    payload: { count: 3, damage: 470, type: 'cruise', splash: 2.4, spread: 0.8, interval: 1.1 },
    desc: 'Three land-attack cruise missiles fired from a destroyer at sea. They fly from wherever the ship happens to be.',
    tip: 'The launch vector is the ship, so a destroyer parked on the far flank produces a strike from an unexpected bearing.',
  },
  iskander: {
    key: 'iskander', name: 'Iskander-M Precision Missile', short: 'ISK', icon: 'ballistic',
    eras: ['modern'], factions: ['esd'],
    cost: 1750, cooldown: 175, targeting: 'point', threat: THREAT.BALLISTIC,
    requires: { buildings: ['awc', 'data'], data: 2, power: true, ammo: 10 },
    flight: { speed: 13.5, altitude: 'ballistic', approach: 'edge', evasive: 0.22 },
    payload: { count: 1, damage: 980, type: 'cruise', splash: 3.4, spread: 0.25 },
    desc: 'A single quasi-ballistic missile on a depressed, manoeuvring trajectory. Very fast, very hard to intercept, enormous warhead.',
    tip: 'Only a Patriot, S-400 or HQ-9 has any realistic chance of stopping it. Short-range interceptors cannot.',
  },
  tochka: {
    key: 'tochka', name: 'Tochka-U Ballistic Missile', short: 'TCH', icon: 'ballistic',
    eras: ['nineties'], factions: ['esd'],
    cost: 1400, cooldown: 160, targeting: 'point', threat: THREAT.BALLISTIC,
    requires: { buildings: ['awc'], data: 1, power: true, ammo: 8 },
    flight: { speed: 11.0, altitude: 'ballistic', approach: 'edge' },
    payload: { count: 1, damage: 720, type: 'cruise', splash: 4.2, spread: 2.6 },
    desc: 'An unguided-terminal ballistic missile with a large warhead and a matching error budget. It will hit something in the area.',
    tip: 'Aim at dense building clusters — precision is not on the menu in this decade.',
  },
};

export const ABILITY_KEYS = Object.keys(ABILITIES);

export function abilitiesFor(faction, era) {
  return ABILITY_KEYS.filter((k) => {
    const a = ABILITIES[k];
    return a.eras.includes(era) && a.factions.includes(faction);
  });
}

export function abilityName(key, faction) {
  const a = ABILITIES[key];
  if (!a) return '';
  return (a.nameByFaction && a.nameByFaction[faction]) || a.name;
}

/** Human-readable summary of the signature systems, by era. */
export const SIGNATURE_SYSTEMS_BY_ERA = {
  interwar: [
    { id: 1, name: 'Heavy Anti-Aircraft Sector', kind: 'Interception site', who: 'All coalitions', era: '1926', note: 'QF 3-inch guns tied to sound locators and searchlights; the only reliable answer to a bomber raid.' },
    { id: 2, name: 'Balloon Barrage & Gun Section', kind: 'Interception site', who: 'Atlantic Response Coalition, Meridian League', era: '1926', note: 'Cabled balloons and a light gun section. Ruinous to low-level attack, irrelevant to anything flying high.' },
    { id: 3, name: 'Night Bomber Raid', kind: 'Air strike', who: 'All coalitions', era: '1926', note: 'Four heavy biplane bombers, visible the whole way in and engageable by every gun they pass.' },
    { id: 4, name: 'BL 9.2-inch Railway Gun', kind: 'Mobile siege gun', who: 'Atlantic Response Coalition', era: '1926', note: 'Twenty-six tiles of reach on rails; displaces after firing to defeat counter-battery.' },
    { id: 5, name: 'Corps Heavy Artillery Group', kind: 'Mobile battery', who: 'All coalitions', era: '1926', note: 'Massed 8-inch and 152mm howitzers. A registered barrage erases a position rather than damaging it.' },
    { id: 6, name: 'Sound-Ranging Counter-Battery', kind: 'Counter-battery fire', who: 'Eurasian Security Directorate, Meridian League', era: '1926', note: 'Microphone arrays fix the enemy guns by sound, and the corps artillery answers within the minute.' },
    { id: 7, name: 'Super-Heavy Siege Gun', kind: 'Bombardment', who: 'Eurasian Security Directorate, Meridian League', era: '1926', note: 'One enormous shell. Nothing in this decade can intercept it — the only defence is to find the gun.' },
    { id: 8, name: 'Battleship Gunfire Support', kind: 'Naval bombardment', who: 'Atlantic Response Coalition, Pacific Defence Compact', era: '1926', note: 'A full capital-ship broadside, arriving from whichever bearing you have anchored on.' },
    { id: 9, name: 'Siege Howitzer / Skoda 305mm Mortar', kind: 'Mobile siege gun', who: 'Pacific Defence Compact, Meridian League', era: '1926', note: 'The heaviest shell on the battlefield, on a mounting that takes an age to move.' },
    { id: 10, name: 'Observation & Reconnaissance Flight', kind: 'Observation', who: 'All coalitions', era: '1926', note: 'Aircraft and tethered balloons telephoning back what they can see. Your guns cannot shoot at what nobody has spotted.' },
  ],
  modern: [
    { id: 1, name: 'Patriot Missile Battery', kind: 'Interceptor site', who: 'Atlantic Response Coalition, Meridian League', era: '1990s and modern', note: 'Long-range ballistic and cruise interception; weak against rocket salvos.' },
    { id: 2, name: 'Iron Dome Interception Battery', kind: 'Interceptor site', who: 'Meridian League', era: 'Modern only', note: 'Dedicated rocket and loitering-munition interception at short range.' },
    { id: 3, name: 'Storm Shadow Precision Strike', kind: 'Stand-off strike', who: 'Atlantic Response Coalition, Meridian League', era: 'Modern only', note: 'Terrain-hugging cruise missiles with penetrating warheads.' },
    { id: 4, name: 'M142 HIMARS', kind: 'Mobile launcher', who: 'Atlantic Response Coalition', era: 'Modern only', note: 'Guided rockets at 26 tiles; relocates automatically after firing.' },
    { id: 5, name: 'M270 MLRS', kind: 'Mobile launcher', who: 'Atlantic Response Coalition', era: '1990s and modern', note: 'Twelve-rocket saturation salvo; the classic grid-square remover.' },
    { id: 6, name: 'S-400 Long-Range Defence', kind: 'Interceptor site', who: 'Eurasian Security Directorate', era: 'Both (S-300PMU in the 1990s)', note: 'The largest defended footprint in the game.' },
    { id: 7, name: 'Iskander-M Precision Missile', kind: 'Ballistic strike', who: 'Eurasian Security Directorate', era: 'Modern (Tochka-U in the 1990s)', note: 'Fast quasi-ballistic profile; only heavy batteries can engage it.' },
    { id: 8, name: 'Tomahawk Naval Strike', kind: 'Naval strike', who: 'Atlantic Response Coalition', era: '1990s and modern', note: 'Fired from a live destroyer, so the attack bearing is yours to choose.' },
    { id: 9, name: 'PHL-16 Rocket System', kind: 'Mobile launcher', who: 'Pacific Defence Compact', era: 'Modern (Type 83 MRL in the 1990s)', note: 'Twenty-eight tile reach with an eight-rocket modular salvo.' },
    { id: 10, name: 'Networked Recon & Loitering Munitions', kind: 'ISR-strike package', who: 'All coalitions', era: 'Modern (drone sweep in the 1990s)', note: 'Reveals an area, then hunts the most valuable vehicles inside it.' },
  ],
};

export const SIGNATURE_SYSTEMS = SIGNATURE_SYSTEMS_BY_ERA.modern;
