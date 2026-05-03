// Minimal bootstrap module to load the legacy game script in a safe way
// This file intentionally keeps the original `js/game.js` intact and loads it
// into the page so behavior is unchanged while moving toward an ES module layout.

// Dynamically create a classic script tag to load the original file
import * as utils from './utils.mjs';
import * as draw from './draw.mjs';
import * as input from './input.mjs';

// attach modules to a stable namespace for the legacy script to consume during
// incremental refactor. This avoids breaking global code while we move helpers.
window.__game_modules = window.__game_modules || {};
window.__game_modules.utils = utils;
window.__game_modules.draw = draw;
window.__game_modules.input = input;

export function loadLegacyGame(){
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/game.js';
    s.defer = true;
    s.onload = () => { console.log('legacy game.js loaded'); resolve(); };
    s.onerror = (e) => { console.error('failed to load legacy game.js', e); reject(e); };
    document.body.appendChild(s);
  });
}

// simple init: attach modules, then load the legacy script
(async function(){
  try{
    console.log('bootstrap: modules attached');
    await loadLegacyGame();
    console.log('bootstrap: game ready');
  }catch(err){ console.error('bootstrap error', err); }
})();
