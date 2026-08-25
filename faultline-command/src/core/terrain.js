// Terrain vocabulary shared by the map builders, the simulation and the renderer.

export const T = {
  GRASS: 0, ROAD: 1, WOOD: 2, WATER: 3, SAND: 4, ROCK: 5,
  FARM: 6, URBAN: 7, DUNE: 8, SHALLOW: 9, CONCRETE: 10, RUBBLE: 11, TRENCH: 12,
};

// moveCost: multiplier on time to cross (1 = baseline). heavyCost: extra penalty for
// tracked/heavy vehicles. cover: fractional damage reduction for infantry standing here.
export const TERRAIN = {
  [T.GRASS]:    { name: 'Open ground', moveCost: 1.00, heavyCost: 1.00, cover: 0.00, land: true,  naval: false, build: true,  colour: '#5c7346', alt: '#546b40' },
  [T.ROAD]:     { name: 'Metalled road', moveCost: 0.62, heavyCost: 0.70, cover: 0.00, land: true,  naval: false, build: false, colour: '#6d6a63', alt: '#75726b' },
  [T.WOOD]:     { name: 'Woodland', moveCost: 1.75, heavyCost: 2.30, cover: 0.42, land: true,  naval: false, build: false, colour: '#33482c', alt: '#2c3f26' },
  [T.WATER]:    { name: 'Deep water', moveCost: 0,    heavyCost: 0,    cover: 0.00, land: false, naval: true,  build: false, colour: '#1d3f5c', alt: '#1a3852' },
  [T.SAND]:     { name: 'Sand', moveCost: 1.18, heavyCost: 1.35, cover: 0.05, land: true,  naval: false, build: true,  colour: '#b09760', alt: '#a88f59' },
  [T.ROCK]:     { name: 'Rock outcrop', moveCost: 0,   heavyCost: 0,    cover: 0.35, land: false, naval: false, build: false, colour: '#6b6355', alt: '#5f584c' },
  [T.FARM]:     { name: 'Cultivated field', moveCost: 1.15, heavyCost: 1.30, cover: 0.10, land: true, naval: false, build: true, colour: '#7d7f42', alt: '#8a8a48' },
  [T.URBAN]:    { name: 'Built-up area', moveCost: 1.35, heavyCost: 1.70, cover: 0.50, land: true,  naval: false, build: false, colour: '#7a7166', alt: '#6e675d' },
  [T.DUNE]:     { name: 'Dune field', moveCost: 1.55, heavyCost: 2.05, cover: 0.12, land: true,  naval: false, build: false, colour: '#c9ad72', alt: '#bfa269' },
  [T.SHALLOW]:  { name: 'Shallows', moveCost: 1.9,  heavyCost: 2.6,  cover: 0.00, land: true,  naval: true,  build: false, colour: '#2f6d8e', alt: '#2b6484' },
  [T.CONCRETE]: { name: 'Hardstanding', moveCost: 0.78, heavyCost: 0.85, cover: 0.05, land: true, naval: false, build: true, colour: '#8b8880', alt: '#827f77' },
  [T.RUBBLE]:   { name: 'Rubble', moveCost: 1.45, heavyCost: 1.80, cover: 0.30, land: true,  naval: false, build: false, colour: '#5f5a52', alt: '#565149' },
  [T.TRENCH]:   { name: 'Prepared position', moveCost: 1.30, heavyCost: 2.20, cover: 0.58, land: true, naval: false, build: false, colour: '#4d4a3a', alt: '#454233' },
};

export function isLand(t) { return TERRAIN[t].land; }
export function isNaval(t) { return TERRAIN[t].naval; }
export function coverAt(t) { return TERRAIN[t].cover; }

export const DOMAIN = { LAND: 'land', NAVAL: 'naval', ANY: 'any' };

/** Cost to enter a tile for a given movement profile, or 0 when impassable. */
export function moveCost(tile, domain, heavy) {
  const d = TERRAIN[tile];
  if (domain === DOMAIN.NAVAL) return d.naval ? (tile === T.SHALLOW ? 1.35 : 1.0) : 0;
  if (!d.land) return 0;
  return heavy ? d.heavyCost : d.moveCost;
}
