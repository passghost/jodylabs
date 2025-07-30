// enemy_balance.js
// Handles enemy/enemy weapon scaling per level and weapon damage logic

// Enemy base stats by type
export const ENEMY_BASE_STATS = {
    small:   { baseHp: 4,   baseDamage: 1,  baseScore: 100 },
    medium:  { baseHp: 10,  baseDamage: 2,  baseScore: 250 },
    large:   { baseHp: 20,  baseDamage: 4,  baseScore: 500 }
};

// Weapon base damage (by type, can be expanded)
export const WEAPON_BASE_DAMAGE = {
    normal: 2,
    double: 3,
    spread: 2,
    piercing: 4,
    giant: 8
};

// Get enemy HP for a given type and level
export function getEnemyHp(type, level) {
    const base = ENEMY_BASE_STATS[type]?.baseHp || 4;
    // HP increases by 20% per level, rounded up
    return Math.ceil(base * Math.pow(1.2, level - 1));
}

// Get weapon damage for a given weapon type, tier, and enemy type/level
export function getWeaponDamage(weaponType, tier, enemyType, level) {
    let base = WEAPON_BASE_DAMAGE[weaponType] || 2;
    // Weapon power increases with tier
    let dmg = base + (tier-1) * base * 0.6;
    // Optionally, scale down vs. large enemies
    if (enemyType === 'large') dmg *= 0.85;
    // Optionally, scale up for higher levels
    dmg *= 1 + (level-1)*0.08;
    return Math.round(dmg);
}

// Get enemy score value for a given type and level
export function getEnemyScore(type, level) {
    const base = ENEMY_BASE_STATS[type]?.baseScore || 100;
    return Math.ceil(base * Math.pow(1.15, level-1));
}
