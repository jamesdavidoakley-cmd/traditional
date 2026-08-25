// Damage-type versus armour-class matrix. Everything about the combat model that
// makes rock-paper-scissors readable lives here.

export const ARMOUR = ['infantry', 'light', 'heavy', 'structure', 'navalLight', 'naval', 'air'];

export const DAMAGE_TABLE = {
  //            infantry light heavy structure navalLight naval air
  small:      { infantry: 1.00, light: 0.32, heavy: 0.04, structure: 0.05, navalLight: 0.22, naval: 0.04, air: 0.10 },
  ap:         { infantry: 0.42, light: 1.00, heavy: 1.00, structure: 0.34, navalLight: 0.80, naval: 0.50, air: 0.00 },
  heat:       { infantry: 0.34, light: 1.10, heavy: 1.18, structure: 0.50, navalLight: 0.72, naval: 0.42, air: 0.00 },
  he:         { infantry: 1.10, light: 0.88, heavy: 0.52, structure: 1.15, navalLight: 0.78, naval: 0.48, air: 0.00 },
  frag:       { infantry: 1.38, light: 0.78, heavy: 0.32, structure: 0.70, navalLight: 0.70, naval: 0.38, air: 0.00 },
  aa:         { infantry: 0.14, light: 0.10, heavy: 0.02, structure: 0.04, navalLight: 0.10, naval: 0.04, air: 1.00 },
  navalGun:   { infantry: 0.92, light: 1.00, heavy: 0.82, structure: 1.10, navalLight: 1.10, naval: 1.00, air: 0.00 },
  demolition: { infantry: 0.60, light: 0.90, heavy: 0.90, structure: 3.20, navalLight: 0.60, naval: 0.40, air: 0.00 },
  cruise:     { infantry: 1.05, light: 1.15, heavy: 1.00, structure: 1.85, navalLight: 1.10, naval: 1.00, air: 0.00 },
};

export function damageMultiplier(damageType, armourClass) {
  const row = DAMAGE_TABLE[damageType];
  if (!row) return 1;
  const v = row[armourClass];
  return v === undefined ? 1 : v;
}

// Threat categories used by the interception model.
export const THREAT = {
  BALLISTIC: 'ballistic',   // Iskander, Tochka — fast, steep, hard to hit
  CRUISE: 'cruise',         // Tomahawk, Storm Shadow — low, slow, trackable
  ROCKET: 'rocket',         // MLRS / HIMARS / PHL salvos — many, short flight
  LOITER: 'loiter',         // loitering munitions and drones
  AIRCRAFT: 'aircraft',     // off-map air strike packages
};
