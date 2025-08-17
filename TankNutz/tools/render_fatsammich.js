// Node script to render the pixel sprite described in fatsammich.html into a PNG
// This avoids manual image extraction: it paints the 48x48 sprite into a PNG using pure JS and pngjs

const fs = require('fs');
const { PNG } = require('pngjs');

const out = new PNG({ width: 16, height: 16 });
// We'll reconstruct a simplified 16x16 map matching the in-game map used in js/game.js
const map = [
  '................',
  '................',
  '......HHHHHH....',
  '.....HSSSSSH....',
  '....HSSSSSSSH...',
  '...HSSSBBBSSSH..',
  '...HBBBBBBBBH...',
  '...HBBBBBBBBH...',
  '...HBBBBBLBH...',
  '...HBBBBBBBH...',
  '....HBBBBBH....',
  '....HBBMBBH....',
  '.....HHHHHH.....',
  '................',
  '................',
  '................'
];

const palette = {
  H: [46,42,42,255], // hair
  S: [241,194,125,255], // skin
  B: [55,65,81,255], // body/pants
  T: [59,130,246,255], // shirt (unused)
  L: [47,168,102,255], // lettuce
  M: [179,77,77,255], // meat
  D: [229,192,123,255], // bread
  O: [11,11,16,255] // outline
};

function setPixel(x,y,col){ const idx = (y*out.width + x) * 4; out.data[idx] = col[0]; out.data[idx+1] = col[1]; out.data[idx+2] = col[2]; out.data[idx+3] = col[3]; }

for (let y=0;y<16;y++){
  const row = map[y] || '................';
  for (let x=0;x<16;x++){
    const ch = row[x];
    if (ch === '.') continue;
    const col = palette[ch];
    if (!col) continue;
    setPixel(x,y,col);
  }
}

out.pack().pipe(fs.createWriteStream(__dirname + '/../assets/fatsammich.png'));
console.log('Wrote assets/fatsammich.png (16x16)');
