// Eight AI commanders. The dossier text is flavour; the `build`, `army` and
// `targeting` blocks are read directly by the AI every planning tick, which is why
// two commanders on the same difficulty play visibly different games.

export const DOCTRINE_ICONS = {
  defensive: 'shield', armour: 'tank', aggressive: 'fang', technical: 'circuit',
  air: 'wing', artillery: 'arc', economic: 'cog', naval: 'anchor', mobile: 'arrows',
};

export const COMMANDERS = {
  bastion: {
    key: 'bastion', codename: 'THE BASTION', name: 'Marshal Hedda Korrin', rank: 'Marshal',
    doctrine: 'defensive', icon: 'shield', accent: '#6fa8dc',
    portrait: { cap: 'peaked', skin: '#c99b7a', hair: '#8a8a8a', tunic: '#2f3b4d', insignia: '#d9c46a', scar: false, visor: false },
    background: 'Held the Kessaran river line for nine weeks with a reinforced brigade and no air cover. Korrin has never once been dislodged from prepared ground, and has been criticised in three separate staff reviews for refusing to advance until the arithmetic was overwhelming.',
    dossier: 'Expect layered defences early: machine-gun positions and anti-tank emplacements around every generator, data centre and munitions plant, with interceptor batteries added the moment the technical base allows. Korrin invites overextension and punishes it with pre-registered artillery. Expect no serious attack in the opening ten minutes — and a fully assembled, well-escorted offensive after that.',
    strengths: ['Layered, mutually supporting static defences', 'Deadly artillery-backed counterattacks'],
    weakness: 'Slow to expand and slow to contest neutral ground — the early map is yours if you take it.',
    signature: ['Patriot / S-400 / HQ-9 interceptor batteries', 'Air & Missile Defence sites', 'Self-propelled artillery in prepared kill zones'],
    signatureInterwar: ['Heavy anti-aircraft sectors over the generators', 'Dug-in gun emplacements and machine-gun redoubts', 'Registered artillery kill zones on every approach'],
    voice: {
      open: ['Positions prepared. Let them come to us.', 'Dig in. Nothing moves through this sector.'],
      attack: ['They are overextended. Counterattack.', 'The line holds. Now we advance.'],
      defend: ['Hold. Fires are registered.', 'Fall back to the second line, in order.'],
      strike: ['Battery, engage.', 'Counter-battery fire authorised.'],
      losing: ['Contract the perimeter. We do not rout.'],
      final: ['Enough waiting. All formations — general offensive.'],
    },
    build: {
      order: ['power', 'barracks', 'mg', 'atgun', 'factory', 'power', 'repair', 'radar', 'sam', 'artillery', 'data', 'oiladmin', 'awc', 'atgun', 'sam'],
      defenceRatio: 0.40, expandUrgency: 0.50, techUrgency: 0.62, navalUrgency: 0.35,
      powerBuffer: 28, secondFactory: 0.35, protectCritical: 1.0,
    },
    army: {
      weights: { rifle: 3.0, at: 3.2, engineer: 1.0, recon: 1.0, manpads: 1.6, sf: 0.4, mbt: 2.2, ifv: 2.0, apc: 0.6, scout: 0.9, spg: 2.4, mlrs: 1.0, aa: 2.0, eng: 1.6, himars: 1.0, phl16: 1.0 },
      firstAttackAt: 430, attackInterval: 170, attackSize: 13, attackGrowth: 3,
      harassRatio: 0.10, retreatThreshold: 0.44, artilleryBias: 0.7, abilityBias: 0.9,
      counterAttack: 1.0, decisiveOffensiveAt: 700, garrisonRatio: 0.42, formationDepth: 1.2,
    },
    targeting: ['army', 'defence', 'artillery', 'power', 'production', 'hq'],
  },

  hammer: {
    key: 'hammer', codename: 'THE HAMMER', name: 'General Tomas Bruhn', rank: 'General',
    doctrine: 'armour', icon: 'tank', accent: '#d98c46',
    portrait: { cap: 'beret', skin: '#a97a58', hair: '#3a2c22', tunic: '#4a3b2a', insignia: '#e0a02a', scar: true, visor: false },
    background: 'Made their name at the Tolvan Gap, where they concentrated four battalions into a single armoured fist and drove sixty kilometres in a day. Bruhn regards dispersed armour as armour thrown away, and has never accepted that a tank should ever be committed alone.',
    dossier: 'Bruhn will build a vehicle factory early and rarely stop. Expect massed battalions of main battle tanks with fighting vehicles, mobile air defence and recovery vehicles moving as one body, on the most open ground available. They will attempt to destroy anti-tank teams and artillery before the main body advances. If your anti-tank screen repeatedly stops them, expect self-propelled guns to appear behind the armour within minutes.',
    strengths: ['Overwhelming concentrated armoured punch', 'Repairs and re-commits damaged vehicles quickly'],
    weakness: 'Enormously expensive. Cut the power to the vehicle factory or starve the munitions plant and the fist stops closing.',
    signature: ['Massed main battle tanks with mobile air defence', 'Repair depots and recovery vehicles', 'Self-propelled artillery once its armour is checked'],
    signatureInterwar: ['Massed light tanks screened by armoured cars', 'Recovery tractors and a field workshop behind the line', 'Gun tractors brought up once its armour is checked'],
    voice: {
      open: ['Factory first. Everything else is decoration.', 'Get the armour moving.'],
      attack: ['Battalion, advance. Line abreast.', 'Concentrate. We break them in one place.'],
      defend: ['Armour, wheel about. Meet them head on.'],
      strike: ['Clear the anti-tank positions.'],
      losing: ['Pull the damaged hulls back to the depot.'],
      adapt: ['Their infantry is dug in. Bring the guns forward.'],
    },
    build: {
      order: ['power', 'barracks', 'factory', 'power', 'repair', 'oiladmin', 'artillery', 'radar', 'atgun', 'data', 'awc'],
      defenceRatio: 0.14, expandUrgency: 0.68, techUrgency: 0.44, navalUrgency: 0.25,
      powerBuffer: 16, secondFactory: 0.85, protectCritical: 0.55,
    },
    army: {
      weights: { rifle: 1.4, at: 0.7, engineer: 1.0, recon: 1.0, manpads: 1.0, sf: 0.2, mbt: 6.0, ifv: 3.2, apc: 0.9, scout: 1.2, spg: 1.2, mlrs: 0.6, aa: 2.2, eng: 2.2, himars: 0.5, phl16: 0.5 },
      firstAttackAt: 330, attackInterval: 138, attackSize: 12, attackGrowth: 3.6,
      harassRatio: 0.05, retreatThreshold: 0.34, artilleryBias: 0.35, abilityBias: 0.6,
      counterAttack: 0.5, garrisonRatio: 0.16, formationDepth: 0.7, preferOpen: 1.0, massing: 1.0,
    },
    targeting: ['army', 'defence', 'artillery', 'production', 'power', 'hq'],
  },

  viper: {
    key: 'viper', codename: 'THE VIPER', name: 'Colonel Nadia Ferrow', rank: 'Colonel',
    doctrine: 'aggressive', icon: 'fang', accent: '#e05a5a',
    portrait: { cap: 'garrison', skin: '#8f6247', hair: '#1e1a18', tunic: '#3b2f2f', insignia: '#e05a5a', scar: false, visor: true },
    background: 'Ran raiding columns along the Ostia Nova frontier for two years without a fixed headquarters. Ferrow was passed over for promotion twice for excessive casualties and promoted the third time for the same reason: nobody else took ground that fast.',
    dossier: 'Ferrow attacks before you are ready and does not stop. Expect infantry, scout vehicles and light armour probing within three minutes, aimed at oil derricks, engineers, construction sites and anything left unguarded. Attacks come in several small waves rather than one prepared assault. This is exhausting to defend and cheap to produce — but a properly sited anti-tank and machine-gun line will grind those waves down.',
    strengths: ['Relentless early pressure on your economy', 'Finds and exploits undefended approaches'],
    weakness: 'Feeds units piecemeal into prepared defences. Survive the first ten minutes intact and the initiative is yours.',
    signature: ['Reconnaissance vehicles and light armour', 'Special-forces raids on artillery and munitions', 'Cheap infantry pressure on oil infrastructure'],
    signatureInterwar: ['Armoured cars and infantry raids on oil sites', 'Storm detachments against gun lines and shell plants', 'Cheap rifle companies applied continuously'],
    voice: {
      open: ['Do not wait. Move now.', 'Two sections out. Find their oil.'],
      attack: ['Hit them where they are thin.', 'Again. Do not let them build.'],
      defend: ['Never mind the base — keep attacking.'],
      strike: ['Burn their derricks.'],
      losing: ['Break contact. Go around.'],
      adapt: ['Their line is hard. Find another way in.'],
    },
    build: {
      order: ['barracks', 'power', 'barracks', 'oiladmin', 'factory', 'power', 'mg', 'radar', 'artillery', 'data', 'awc'],
      defenceRatio: 0.10, expandUrgency: 0.95, techUrgency: 0.38, navalUrgency: 0.30,
      powerBuffer: 10, secondFactory: 0.5, protectCritical: 0.35,
    },
    army: {
      weights: { rifle: 4.0, at: 2.2, engineer: 1.6, recon: 2.6, manpads: 0.8, sf: 1.8, mbt: 1.6, ifv: 2.8, apc: 1.6, scout: 2.8, spg: 0.8, mlrs: 0.5, aa: 1.0, eng: 0.8, himars: 0.4, phl16: 0.4 },
      firstAttackAt: 160, attackInterval: 60, attackSize: 5, attackGrowth: 1.3,
      harassRatio: 0.62, retreatThreshold: 0.20, artilleryBias: 0.25, abilityBias: 0.7,
      counterAttack: 0.3, garrisonRatio: 0.10, formationDepth: 0.5, multiProng: 1.0,
    },
    targeting: ['economy', 'construction', 'artillery', 'production', 'power', 'army', 'hq'],
  },

  architect: {
    key: 'architect', codename: 'THE ARCHITECT', name: 'Doctor-General Elian Vasq', rank: 'Doctor-General',
    doctrine: 'technical', icon: 'circuit', accent: '#7fd6c8',
    portrait: { cap: 'none', skin: '#d4b08c', hair: '#5a5a5a', tunic: '#26343b', insignia: '#7fd6c8', scar: false, visor: true },
    background: 'Came to command through the signals and targeting directorate rather than a field unit. Vasq wrote the doctrine paper that treats a battlefield as a sensor problem, and is widely disliked by field officers who resent being told their brigade is a delivery mechanism.',
    dossier: 'Vasq builds the sensor and command chain before the army: power, radar, data centre, advanced weapons command. Expect precision strikes, reconnaissance drones and loitering munitions rather than mass. Targets are chosen by value, not by proximity, and change the moment reconnaissance finds something better — your data centre, your radar, your interceptor batteries and your generators, in that order.',
    strengths: ['Devastating, well-informed precision fires', 'Retargets faster than any other commander'],
    weakness: 'The whole apparatus is expensive and brittle. Kill the data centre or the generators and the strikes simply stop.',
    signature: ['Networked reconnaissance and loitering munitions', 'Storm Shadow / Iskander-M precision strikes', 'HIMARS and PHL-16 guided rocket artillery'],
    signatureInterwar: ['Signals posts and sound-ranging counter-battery', 'Observation and reconnaissance flights', 'Long-range bombardment onto whatever they have just found'],
    voice: {
      open: ['Sensors first. The shooting follows.', 'Bring the network up.'],
      attack: ['Target identified. Executing.', 'Their picture is worse than ours. Proceed.'],
      defend: ['Reposition. Do not trade.'],
      strike: ['Strike package away.', 'Priority target designated.'],
      losing: ['We have lost the link. Reconstitute.'],
      adapt: ['New target set. Re-task everything.'],
    },
    build: {
      order: ['power', 'barracks', 'power', 'radar', 'factory', 'data', 'oiladmin', 'awc', 'sam', 'artillery', 'atgun', 'power'],
      defenceRatio: 0.24, expandUrgency: 0.60, techUrgency: 1.00, navalUrgency: 0.35,
      powerBuffer: 34, secondFactory: 0.4, protectCritical: 0.9,
    },
    army: {
      weights: { rifle: 1.6, at: 2.0, engineer: 1.0, recon: 2.8, manpads: 1.6, sf: 0.8, mbt: 2.0, ifv: 2.2, apc: 0.8, scout: 2.2, spg: 1.6, mlrs: 2.6, aa: 2.0, eng: 1.2, himars: 2.6, phl16: 2.6 },
      firstAttackAt: 415, attackInterval: 150, attackSize: 11, attackGrowth: 2.8,
      harassRatio: 0.24, retreatThreshold: 0.42, artilleryBias: 0.8, abilityBias: 2.4,
      counterAttack: 0.6, garrisonRatio: 0.26, formationDepth: 1.1, retargetSpeed: 1.0,
    },
    targeting: ['data', 'sensors', 'defence', 'power', 'artillery', 'production', 'hq'],
  },

  tempest: {
    key: 'tempest', codename: 'THE TEMPEST', name: 'Air Marshal Sable Ryn', rank: 'Air Marshal',
    doctrine: 'air', icon: 'wing', accent: '#9fb6ff',
    portrait: { cap: 'flight', skin: '#8a5f43', hair: '#241c18', tunic: '#2b3350', insignia: '#9fb6ff', scar: false, visor: true },
    background: 'Spent a career arguing that ground manoeuvre exists to make targets stand still. Ryn commanded the theatre air component at Aldermere and reduced a fortified corridor to rubble in four days without committing a single armoured battalion.',
    dossier: 'Ryn rushes the Advanced Weapons Command and lives on off-map fires: air strikes, cruise missiles and drone attacks arriving from the map edge. Expect a deliberate campaign against your air defences first, then against your generators, factories and headquarters. Their own base will carry an unusually heavy interceptor screen. Every one of these strikes is visible in flight and can be shot down.',
    strengths: ['Constant, heavy off-map fires', 'Very well defended against your strikes in return'],
    weakness: 'Long cooldowns and total dependence on radar, data and power. A thick SAM belt forces them into a ground fight they are not built for.',
    signature: ['Precision air strikes from the map edge', 'Tomahawk and Storm Shadow cruise missiles', 'A heavy Patriot / S-400 screen over its own base'],
    signatureInterwar: ['Night bomber raids and ground-attack flights', 'Heavy anti-aircraft sectors over its own base', 'Balloon barrages against low-level attack'],
    voice: {
      open: ['Get the command centre up. Everything else waits.'],
      attack: ['Strike package inbound.', 'Suppress their air defences.'],
      defend: ['Interceptors hot. Nothing gets through.'],
      strike: ['Weapons away.', 'Target is hardened. Sending two.'],
      losing: ['We have lost the network. Ground forces, hold.'],
      adapt: ['Their air defence is too thick. Go in on the ground.'],
    },
    build: {
      order: ['power', 'barracks', 'power', 'radar', 'data', 'factory', 'awc', 'sam', 'oiladmin', 'sam', 'artillery', 'power'],
      defenceRatio: 0.32, expandUrgency: 0.55, techUrgency: 0.98, navalUrgency: 0.30,
      powerBuffer: 40, secondFactory: 0.3, protectCritical: 1.0, airDefenceBias: 1.0,
    },
    army: {
      weights: { rifle: 1.8, at: 1.8, engineer: 1.0, recon: 1.8, manpads: 2.4, sf: 0.6, mbt: 2.8, ifv: 2.6, apc: 0.9, scout: 1.4, spg: 1.6, mlrs: 1.6, aa: 2.8, eng: 1.4, himars: 1.6, phl16: 1.6 },
      firstAttackAt: 420, attackInterval: 158, attackSize: 12, attackGrowth: 3.0,
      harassRatio: 0.18, retreatThreshold: 0.40, artilleryBias: 0.5, abilityBias: 3.0,
      counterAttack: 0.6, garrisonRatio: 0.32, formationDepth: 1.0, seadFirst: 1.0,
    },
    targeting: ['airDefence', 'sensors', 'power', 'production', 'hq', 'army'],
  },

  longbow: {
    key: 'longbow', codename: 'THE LONGBOW', name: 'General Ottmar Kelsang', rank: 'General',
    doctrine: 'artillery', icon: 'arc', accent: '#c9a34e',
    portrait: { cap: 'peaked', skin: '#b98a63', hair: '#6b6157', tunic: '#3d4034', insignia: '#c9a34e', scar: false, visor: false },
    background: 'A gunner by trade who rose through fire-direction rather than command of troops. Kelsang believes an assault that has to be fought is an assault that was planned badly, and prefers to spend two hours of shelling to save twenty minutes of manoeuvre.',
    dossier: 'Kelsang builds the artillery and munitions complex early and defends it obsessively. Expect self-propelled guns and rocket launchers firing from behind a screen of armour and infantry, with reconnaissance pushed forward to spot for them, and launchers relocating after each salvo to defeat counter-battery. Sustained bombardment precedes any ground advance. Your interceptor batteries and your munitions plant will be near the top of their target list.',
    strengths: ['Punishing long-range bombardment', 'Displaces launchers before counter-battery lands'],
    weakness: 'The guns are thin-skinned and slow. A fast raid or a special-forces team in the gun line ends the bombardment immediately.',
    signature: ['M270 MLRS, HIMARS and PHL-16 rocket artillery', 'Self-propelled howitzers with forward spotters', 'Counter-battery displacement after every salvo'],
    signatureInterwar: ['Corps heavy artillery groups firing in concert', 'Railway guns and super-heavy siege howitzers', 'Forward observation posts to spot for them'],
    voice: {
      open: ['Guns first. We will need them.'],
      attack: ['Fire mission. Danger close is their problem.', 'Advance behind the barrage.'],
      defend: ['Shift fires to the breakthrough.'],
      strike: ['Shot, over.', 'Battery displacing.'],
      losing: ['Protect the gun line. Everything else is replaceable.'],
      adapt: ['They are closing too fast. Guns back, armour forward.'],
    },
    build: {
      order: ['power', 'barracks', 'factory', 'artillery', 'power', 'radar', 'atgun', 'repair', 'oiladmin', 'data', 'awc', 'sam'],
      defenceRatio: 0.22, expandUrgency: 0.60, techUrgency: 0.66, navalUrgency: 0.30,
      powerBuffer: 20, secondFactory: 0.45, protectCritical: 0.85, protectArtillery: 1.0,
    },
    army: {
      weights: { rifle: 1.8, at: 1.6, engineer: 1.0, recon: 2.8, manpads: 1.2, sf: 0.5, mbt: 2.2, ifv: 2.0, apc: 0.8, scout: 1.8, spg: 3.6, mlrs: 3.2, aa: 1.6, eng: 1.8, himars: 3.4, phl16: 3.4 },
      firstAttackAt: 400, attackInterval: 155, attackSize: 12, attackGrowth: 3.0,
      harassRatio: 0.16, retreatThreshold: 0.46, artilleryBias: 1.0, abilityBias: 1.2,
      counterAttack: 0.5, garrisonRatio: 0.24, formationDepth: 1.6, bombardFirst: 1.0, shootAndScoot: 1.0,
    },
    targeting: ['airDefence', 'artillery', 'defence', 'production', 'power', 'hq'],
  },

  quartermaster: {
    key: 'quartermaster', codename: 'THE QUARTERMASTER', name: 'General Marisol Quintaine', rank: 'General',
    doctrine: 'economic', icon: 'cog', accent: '#8fd18a',
    portrait: { cap: 'peaked', skin: '#7d5539', hair: '#2b2320', tunic: '#33422f', insignia: '#8fd18a', scar: false, visor: false },
    background: 'Ran theatre logistics for eleven years before taking a field command, and treats a battle as a production problem with an inconvenient enemy attached. Quintaine has never lost a war of attrition and is unbeaten in any engagement lasting more than an hour.',
    dossier: 'Quintaine seizes oil infrastructure fast and builds an oil administration facility almost immediately, then doubles up on production buildings. Expect balanced combined-arms formations rather than specialists, and expect every loss to be replaced within a minute. Early pressure is comparatively light, but the size of each successive wave grows faster than any other commander on the board.',
    strengths: ['Replaces losses faster than you can inflict them', 'Grows more dangerous every minute the match continues'],
    weakness: 'Buys warehouses before it buys weapons. Hit the oil sites early and the whole model stalls.',
    signature: ['Balanced combined arms in depth', 'Multiple oil administration facilities', 'Whatever the situation actually calls for'],
    signatureInterwar: ['Petroleum administration built early and often', 'Several tank works and depot barracks', 'Whatever the situation actually calls for'],
    voice: {
      open: ['Secure the oil. All of it.'],
      attack: ['Wave two is already building.', 'Push. There is more behind them.'],
      defend: ['Replace the losses. Keep the line fed.'],
      strike: ['Authorised. We can afford it.'],
      losing: ['We are losing income. Retake the derricks.'],
      adapt: ['Adjust the production mix.'],
    },
    build: {
      order: ['power', 'barracks', 'oiladmin', 'factory', 'power', 'barracks', 'repair', 'factory', 'radar', 'artillery', 'oiladmin', 'data', 'awc'],
      defenceRatio: 0.20, expandUrgency: 1.00, techUrgency: 0.60, navalUrgency: 0.45,
      powerBuffer: 24, secondFactory: 1.0, protectCritical: 0.75, economyFocus: 1.0,
    },
    army: {
      weights: { rifle: 2.6, at: 2.0, engineer: 2.2, recon: 1.6, manpads: 1.4, sf: 0.6, mbt: 2.8, ifv: 2.8, apc: 1.6, scout: 1.6, spg: 2.0, mlrs: 1.4, aa: 2.0, eng: 2.0, himars: 1.2, phl16: 1.2 },
      firstAttackAt: 355, attackInterval: 118, attackSize: 10, attackGrowth: 4.4,
      harassRatio: 0.22, retreatThreshold: 0.38, artilleryBias: 0.6, abilityBias: 1.0,
      counterAttack: 0.7, garrisonRatio: 0.26, formationDepth: 1.0, replaceLosses: 1.0,
    },
    targeting: ['economy', 'production', 'army', 'power', 'hq'],
  },

  admiral: {
    key: 'admiral', codename: 'THE ADMIRAL', name: 'Admiral Kaito Verenna', rank: 'Admiral',
    doctrine: 'naval', icon: 'anchor', accent: '#5fc8e0',
    portrait: { cap: 'naval', skin: '#a97c56', hair: '#2a2622', tunic: '#1f2b3a', insignia: '#5fc8e0', scar: false, visor: false },
    background: 'Commanded the Coral Approaches squadron through two blockade actions and one very public political crisis. Verenna regards a coastline as an open flank that the enemy has generously agreed not to defend.',
    dossier: 'On any map with water, Verenna builds a naval yard early and coastal batteries to protect it. Expect missile ships bombarding your coastal positions, patrol craft hunting your shipping, and landing craft putting a mechanised force ashore behind your defensive line, usually near your oil infrastructure. On a landlocked map this commander reverts to a fast combined-arms mobile doctrine instead.',
    strengths: ['Attacks from bearings your land defences do not cover', 'Very heavy naval gunfire support'],
    weakness: 'A fleet is a great deal of money that is not defending the base. Push inland hard while the ships are away.',
    signature: ['Missile destroyers and Tomahawk naval strike', 'Coastal defence batteries and frigates', 'Landing craft for amphibious envelopment'],
    signatureInterwar: ['Battleship gunfire support and monitors inshore', 'Coastal gun batteries protecting the dockyard', 'Landing barges for an amphibious envelopment'],
    voice: {
      open: ['Get the yard laid down.'],
      attack: ['Landing force away.', 'Bombard the shoreline, then put them ashore.'],
      defend: ['Bring the ships in close. Support the line.'],
      strike: ['Missiles away from the flank.'],
      losing: ['Withdraw the hulls. Do not lose the fleet.'],
      adapt: ['No sea room here. Fight it out on land.'],
    },
    build: {
      order: ['power', 'barracks', 'factory', 'navalyard', 'power', 'coastal', 'oiladmin', 'radar', 'artillery', 'coastal', 'data', 'awc'],
      defenceRatio: 0.26, expandUrgency: 0.72, techUrgency: 0.55, navalUrgency: 1.00,
      powerBuffer: 20, secondFactory: 0.4, protectCritical: 0.7,
    },
    army: {
      weights: { rifle: 2.2, at: 1.2, engineer: 1.6, recon: 1.4, manpads: 1.2, sf: 0.8, mbt: 1.6, ifv: 1.8, apc: 1.4, scout: 1.4, spg: 1.2, mlrs: 1.0, aa: 1.6, eng: 1.2, himars: 0.8, phl16: 0.8,
        patrol: 2.4, landing: 1.8, frigate: 2.6, destroyer: 2.0, support: 2.4 },
      firstAttackAt: 400, attackInterval: 148, attackSize: 11, attackGrowth: 3.0,
      harassRatio: 0.28, retreatThreshold: 0.44, artilleryBias: 0.5, abilityBias: 1.4,
      counterAttack: 0.6, garrisonRatio: 0.24, formationDepth: 1.0, amphibious: 1.0,
    },
    targeting: ['economy', 'coastal', 'power', 'production', 'hq'],
    landlockedFallback: 'mobile',
  },
};

// Used when THE ADMIRAL is drawn on a map with no navigable water.
export const MOBILE_FALLBACK = {
  build: {
    order: ['power', 'barracks', 'factory', 'power', 'oiladmin', 'repair', 'radar', 'artillery', 'data', 'awc'],
    defenceRatio: 0.18, expandUrgency: 0.85, techUrgency: 0.58, navalUrgency: 0,
    powerBuffer: 18, secondFactory: 0.6, protectCritical: 0.7,
  },
  army: {
    weights: { rifle: 2.2, at: 1.8, engineer: 1.6, recon: 2.2, manpads: 1.2, sf: 1.0, mbt: 2.6, ifv: 3.0, apc: 2.0, scout: 2.4, spg: 1.6, mlrs: 1.2, aa: 1.8, eng: 1.6, himars: 1.0, phl16: 1.0 },
    firstAttackAt: 330, attackInterval: 125, attackSize: 10, attackGrowth: 3.2,
    harassRatio: 0.38, retreatThreshold: 0.40, artilleryBias: 0.5, abilityBias: 1.2,
    counterAttack: 0.7, garrisonRatio: 0.20, formationDepth: 0.8, multiProng: 0.7,
  },
  targeting: ['economy', 'production', 'army', 'power', 'hq'],
  icon: 'arrows', doctrine: 'mobile',
};

export const COMMANDER_KEYS = Object.keys(COMMANDERS);

export const DIFFICULTIES = {
  cadet: {
    key: 'cadet', name: 'Cadet', reaction: 3.4, planQuality: 0.52, aggression: 0.70,
    incomeMultiplier: 1.0, buildSpeed: 0.86, microSkill: 0.35, maxConcurrent: 1,
    note: 'Slow to react, plans loosely, attacks with less. No economic advantage.',
  },
  officer: {
    key: 'officer', name: 'Officer', reaction: 1.9, planQuality: 0.76, aggression: 0.95,
    incomeMultiplier: 1.0, buildSpeed: 1.0, microSkill: 0.6, maxConcurrent: 1,
    note: 'A competent opponent playing by exactly your rules. No economic advantage.',
  },
  general: {
    key: 'general', name: 'General', reaction: 1.0, planQuality: 0.93, aggression: 1.14,
    incomeMultiplier: 1.0, buildSpeed: 1.08, microSkill: 0.85, maxConcurrent: 2,
    note: 'Reacts fast, plans well, presses advantages hard. No economic advantage.',
  },
  marshal: {
    key: 'marshal', name: 'Marshal', reaction: 0.55, planQuality: 1.0, aggression: 1.30,
    incomeMultiplier: 1.25, buildSpeed: 1.15, microSkill: 1.0, maxConcurrent: 2,
    disclosed: 'DISCLOSED ADVANTAGE: +25% income and +15% construction speed.',
    note: 'Best possible planning and reaction, plus a disclosed +25% income and +15% construction speed.',
  },
};

export const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES);

/** Resolve a commander's active doctrine, applying the landlocked fallback if needed. */
export function resolveCommander(key, hasWater) {
  const c = COMMANDERS[key];
  if (!c) return null;
  if (c.landlockedFallback && !hasWater) {
    return Object.assign({}, c, {
      build: MOBILE_FALLBACK.build, army: MOBILE_FALLBACK.army,
      targeting: MOBILE_FALLBACK.targeting, icon: MOBILE_FALLBACK.icon,
      doctrine: MOBILE_FALLBACK.doctrine, fallbackActive: true,
    });
  }
  return c;
}
