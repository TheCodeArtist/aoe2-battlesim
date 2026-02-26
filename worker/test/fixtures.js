export const ARCHER_SPEC = { unit: 'archer_fu_feudal', count: 10 };
export const SKIRM_SPEC  = { unit: 'skirm_fu_feudal',  count: 10 };
export const INLINE_UNIT_SPEC = {
  unit: { name: 'Custom Archer', hp: 30, patk: 5, parm: 1, marm: 1, reload: 2.0, range: 5 },
  count: 5,
};
export const SIMULATE_BODY = {
  side_a: ARCHER_SPEC,
  side_b: SKIRM_SPEC,
};

// v2 fixtures — civ-prefixed unit keys from units_v2.js
// Halberdiers have +32 vs cavalry — reliable winner vs Cavaliers/Paladins.
// Britons only reach Cavalier (no Paladin tech), so the key is britons_cavalier.
export const HALBERDIER_SPEC_V2 = { unit: 'britons_halberdier', count: 20 };
export const CAVALIER_SPEC_V2   = { unit: 'britons_cavalier',   count: 10 };
export const SIMULATE_BODY_V2 = {
  side_a: HALBERDIER_SPEC_V2,
  side_b: CAVALIER_SPEC_V2,
};
