// Lightweight wrapper API for gradual modularization.
// Currently it just exposes a tiny shim to query readiness of the legacy script.

export function isGamePresent(){
  return typeof window.loop === 'function' || typeof window.gameStart === 'function' || !!window.gameLoaded;
}

export function waitForGame(timeout=3000){
  return new Promise((resolve, reject) => {
    const start = performance.now();
    function check(){
      if (isGamePresent()) return resolve(true);
      if (performance.now() - start > timeout) return reject(new Error('game not present'));
      requestAnimationFrame(check);
    }
    check();
  });
}
