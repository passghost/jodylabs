# JodyLabs Presentation

Files added:

- `index.html` — main page
- `styles.css` — styles and animations
- `script.js` — autoplay handling and animation trigger

Place the media files in an `assets` folder next to these files:

- `assets/JodyLabs.png`
- `assets/CathSonauto.wav`
 - `assets/proud-fart.mp3` (will play once the logo reaches center)

How to use:

1. Create a folder named `assets` in this directory and put `JodyLabs.png` and `CathSonauto.wav` there.
2. Open `index.html` in your browser. If the browser blocks autoplay, click the displayed "Play" button to start the music and the floating animation.

Notes:

- Modern browsers often block audio autoplay; the page provides a visible fallback play button.
- If you want the music to loop, open `index.html` and set the `loop` attribute on the `<audio>` element.
