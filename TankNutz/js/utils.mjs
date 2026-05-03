// Small utility helpers extracted for modularization
export function mod(n, m){ return ((n % m) + m) % m; }
export function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
export function randInt(a, b){ return (a + Math.floor(Math.random() * (b - a + 1))); }
export function randJunglePalette(){ const h = 110 + randInt(-10, 18); const s = 50 + randInt(-8, 18); const l = 18 + randInt(-4, 8); return { leafDark:  `hsl(${h} ${s+6}% ${Math.max(l-8,6)}%)`, leaf: `hsl(${h} ${s+10}% ${l}%)`, leafLight: `hsl(${h} ${s+18}% ${Math.min(l+12,72)}%)`, stem: `hsl(${h-30} ${Math.max(s-6,12)}% ${Math.max(l-12,5)}%)`, bloom:`hsl(${(h+260)%360} 64% 62%)`, fruit:`hsl(${(h+90)%360} 72% 52%)` }; }
