// Theatre-level fires. Each is a genuinely different battlefield event: different
// flight profile, different interception odds, different thing it is good at killing.

import { THREAT } from './damage.js';

export const ABILITIES = {
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

/** Human-readable summary of the ten signature systems, for the briefing screens. */
export const SIGNATURE_SYSTEMS = [
  { id: 1, name: 'Patriot Missile Battery', kind: 'Interceptor site', who: 'Atlantic Response Coalition, Meridian League', era: 'Both eras', note: 'Long-range ballistic and cruise interception; weak against rocket salvos.' },
  { id: 2, name: 'Iron Dome Interception Battery', kind: 'Interceptor site', who: 'Meridian League', era: 'Modern only', note: 'Dedicated rocket and loitering-munition interception at short range.' },
  { id: 3, name: 'Storm Shadow Precision Strike', kind: 'Stand-off strike', who: 'Atlantic Response Coalition, Meridian League', era: 'Modern only', note: 'Terrain-hugging cruise missiles with penetrating warheads.' },
  { id: 4, name: 'M142 HIMARS', kind: 'Mobile launcher', who: 'Atlantic Response Coalition', era: 'Modern only', note: 'Guided rockets at 26 tiles; relocates automatically after firing.' },
  { id: 5, name: 'M270 MLRS', kind: 'Mobile launcher', who: 'Atlantic Response Coalition', era: 'Both eras', note: 'Twelve-rocket saturation salvo; the classic grid-square remover.' },
  { id: 6, name: 'S-400 Long-Range Defence', kind: 'Interceptor site', who: 'Eurasian Security Directorate', era: 'Both eras (S-300PMU in the 1990s)', note: 'The largest defended footprint in the game.' },
  { id: 7, name: 'Iskander-M Precision Missile', kind: 'Ballistic strike', who: 'Eurasian Security Directorate', era: 'Modern (Tochka-U in the 1990s)', note: 'Fast quasi-ballistic profile; only heavy batteries can engage it.' },
  { id: 8, name: 'Tomahawk Naval Strike', kind: 'Naval strike', who: 'Atlantic Response Coalition', era: 'Both eras', note: 'Fired from a live destroyer, so the attack bearing is yours to choose.' },
  { id: 9, name: 'PHL-16 Rocket System', kind: 'Mobile launcher', who: 'Pacific Defence Compact', era: 'Modern (Type 83 MRL in the 1990s)', note: 'Twenty-eight tile reach with an eight-rocket modular salvo.' },
  { id: 10, name: 'Networked Recon & Loitering Munitions', kind: 'ISR-strike package', who: 'All coalitions', era: 'Modern (drone sweep in the 1990s)', note: 'Reveals an area, then hunts the most valuable vehicles inside it.' },
];
