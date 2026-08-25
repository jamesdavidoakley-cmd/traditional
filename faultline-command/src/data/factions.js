// The four fictional coalitions. Flags, palettes and architecture are original;
// only the real equipment designations are borrowed, as briefed.

export const ERAS = {
  interwar: { key: 'interwar', name: '1926', short: '26', year: '1926', blurb: 'Interwar armies: rhomboid tanks, massed guns, wireless telegraphy and biplanes.' },
  nineties: { key: 'nineties', name: '1990s', short: '90s', year: '1994', blurb: 'Cold-war stockpiles, analogue fire control and mechanised mass.' },
  modern:   { key: 'modern',   name: 'Modern Day', short: 'MOD', year: '2027', blurb: 'Networked sensors, precision fires and layered missile defence.' },
};

export const FACTIONS = {
  arc: {
    key: 'arc',
    name: 'Atlantic Response Coalition',
    abbr: 'ARC',
    motto: 'Ex Litore, Vis',
    colour: '#3d7ddb',
    accent: '#9ec9ff',
    architecture: 'atlantic',
    doctrineNote: 'Combined-arms expeditionary force built around heavy armour, networked fires and naval reach.',
    homeland: 'The Atlantic Charter states of Verrand, Calmar and the Aldermere Isles.',
    strengths: ['Best-in-class main battle tanks', 'Deep precision fires and naval strike'],
    weakness: 'Expensive high-end formations; heavily dependent on the data link.',
    doctrineNoteInterwar: 'Expeditionary force built around heavy tanks, corps artillery and the reach of a battle fleet.',
    strengthsInterwar: ['Best-protected heavy and medium tanks', 'Railway guns and capital-ship gunfire'],
    weaknessInterwar: 'Expensive formations; the fleet is a great deal of money that is not defending the base.',
    flag: { bars: ['#123a6b', '#ffffff', '#3d7ddb'], emblem: 'star' },
  },
  esd: {
    key: 'esd',
    name: 'Eurasian Security Directorate',
    abbr: 'ESD',
    motto: 'Stal i Volya',
    colour: '#cf3a3a',
    accent: '#ffb3a0',
    architecture: 'eurasian',
    doctrineNote: 'Mass, echeloned artillery and the densest integrated air-defence umbrella on the board.',
    homeland: 'The Directorate oblasts of Sever, Kamenna and the Tolvan corridor.',
    strengths: ['Overwhelming rocket and tube artillery', 'Layered long-range air defence'],
    weakness: 'Individual vehicles are thinner-skinned; poor at sustained sieges.',
    doctrineNoteInterwar: 'Mass, echeloned guns and the deepest magazine of shells on the board.',
    strengthsInterwar: ['Overwhelming massed howitzer groups', 'Super-heavy siege guns nothing can intercept'],
    weaknessInterwar: 'Individual vehicles are thinner-skinned; slow to concentrate against a mobile enemy.',
    flag: { bars: ['#7a1414', '#cf3a3a', '#f0d060'], emblem: 'gear' },
  },
  pdc: {
    key: 'pdc',
    name: 'Pacific Defence Compact',
    abbr: 'PDC',
    motto: 'Tide and Rampart',
    colour: '#2fae86',
    accent: '#b6f2dc',
    architecture: 'pacific',
    doctrineNote: 'Industrial tempo, cheap replacement echelons and networked reconnaissance-strike complexes.',
    homeland: 'The Compact provinces of Hanzhou, Nakasu and the Coral Approaches.',
    strengths: ['Fast, cheap production echelons', 'Reconnaissance-strike networking'],
    weakness: 'Mid-tier armour quality; the network collapses without its data centre.',
    doctrineNoteInterwar: 'Industrial tempo, cheap replacement echelons and aggressive aerial observation.',
    strengthsInterwar: ['Fast, cheap production echelons', 'Naval bombers and battlecruiser gunfire'],
    weaknessInterwar: 'Mid-tier armour quality; the guns go blind if the observation post falls.',
    flag: { bars: ['#0d5744', '#2fae86', '#ffffff'], emblem: 'wave' },
  },
  mrl: {
    key: 'mrl',
    name: 'Meridian League',
    abbr: 'MRL',
    motto: 'Scutum Meridiei',
    colour: '#e0a02a',
    accent: '#ffe3a0',
    architecture: 'meridian',
    doctrineNote: 'Survivable armour, active protection and the finest short-range interception in service.',
    homeland: 'The League cantons of Ostia Nova, Tarshan and the Kessaran littoral.',
    strengths: ['Superb short-range missile interception', 'Very survivable armoured vehicles'],
    weakness: 'Smaller industrial base; struggles to replace losses quickly.',
    doctrineNoteInterwar: 'Tough armour, dense gun defences and the heaviest siege ordnance in service.',
    strengthsInterwar: ['Balloon barrages and heavy anti-aircraft sectors', 'Skoda siege mortars and monitor gunfire'],
    weaknessInterwar: 'Smaller industrial base; struggles to replace losses quickly.',
    flag: { bars: ['#8a5a08', '#e0a02a', '#2b2b2b'], emblem: 'sun' },
  },
};

export const FACTION_KEYS = Object.keys(FACTIONS);

// Player colours are deliberately high-contrast against grass, sand and sea.
export const TEAM_COLOURS = [
  { key: 'blue',    name: 'Cobalt',   hex: '#3d7ddb' },
  { key: 'red',     name: 'Crimson',  hex: '#e0463c' },
  { key: 'green',   name: 'Jade',     hex: '#2fae86' },
  { key: 'gold',    name: 'Amber',    hex: '#e0a02a' },
  { key: 'purple',  name: 'Violet',   hex: '#9b5fd0' },
  { key: 'cyan',    name: 'Ice',      hex: '#39c3d6' },
  { key: 'orange',  name: 'Ember',    hex: '#f2762b' },
  { key: 'white',   name: 'Bone',     hex: '#d8dbe0' },
];

export function factionList() { return FACTION_KEYS.map((k) => FACTIONS[k]); }
