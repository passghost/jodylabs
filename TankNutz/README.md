PixelArts

Quick start:

- Serve the project with npx (no install required):

```powershell
npx http-server -p 8080 .
```

- Or install http-server and use npm start:

```powershell
npm install -g http-server
npm start
```

Then open http://localhost:8080/pixel_tank_game.html in your browser.

Note: the game now includes a separate projectile channel for the kitten enemy ('pinkdot'). A global array `window.kittenBullets` is available and is used exclusively by kitten enemies so imported kitten projectile animations won't affect other enemy bullets.
