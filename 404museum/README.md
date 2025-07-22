# 404Museum 🏛️

Transform boring 404 error pages into stunning interactive art galleries with this lightweight JavaScript library.

## ✨ Features

- **🎯 Auto-Detection**: Automatically detects 404 error pages
- **🎨 Generative Art**: Multiple art styles including waves, particles, fractals, and abstract patterns
- **📊 Analytics**: Optional logging of 404 hits with timestamp and referrer data
- **⚡ Lightweight**: Less than 15KB minified
- **📱 Responsive**: Works beautifully on all devices
- **🔧 Easy Setup**: Single script tag installation
- **🎮 Interactive**: Users can navigate between different art styles
- **🎨 Customizable**: Configurable colors, messages, and art types

## 🚀 Quick Start

Add this single line to your website's `<head>` section:


```html
<script src="https://passghost.github.io/jodylabs/404museum/404museum.min.js"></script>
```

That's it! 404Museum will automatically detect and transform any 404 pages on your site.


## 📖 Demo

- **Live Demo**: [https://passghost.github.io/jodylabs/404museum/demo.html](https://passghost.github.io/jodylabs/404museum/demo.html)
- **Project Page**: [https://passghost.github.io/jodylabs/404museum/](https://passghost.github.io/jodylabs/404museum/)

## ⚙️ Configuration

Customize 404Museum by defining configuration before loading the script:


```html
<script>
window.Museum404Config = {
    theme: 'dark', // 'light' or 'dark'
    artTypes: [
        'generative',      // Generative Waves
        'particles',       // Particle System
        'fractals',        // Fractal Tree
        'orbitals',        // Orbitals Art
        'neonGrid',        // Neon Grid
        'plasmaField'      // Plasma Field
    ],
    customMessage: 'Page not found, but enjoy this art instead!',
    colors: {
        primary: '#4ecdc4',
        secondary: '#ff6b6b',
        background: '#0a0a0a',
        text: '#ffffff'
    },
    showNavigation: true,
    showBranding: true,
    artDuration: 30000, // Switch art every 30 seconds (0 = manual only)
    particleCount: 100,
    animationSpeed: 1
};
</script>
<script src="https://passghost.github.io/jodylabs/404museum/404museum.min.js"></script>
```

## 🎮 Manual Control

You can also manually control 404Museum with JavaScript:

```javascript
// Manually activate the art gallery
window.Museum404.activate();

// Switch to specific art type
window.Museum404.switchArt('particles');

// Deactivate and return to original page
window.Museum404.deactivate();

// Check if currently active
if (window.Museum404.isActive()) {
    console.log('Art gallery is active');
}
```

## 🎨 Art Types


404Museum includes several beautiful art generators:

1. **Generative Waves** (`'generative'`) - Flowing sine wave patterns
2. **Particle System** (`'particles'`) - Animated floating particles
3. **Fractal Tree** (`'fractals'`) - Recursive branching patterns
4. **Orbitals Art** (`'orbitals'`) - Geometric orbital designs
5. **Neon Grid** (`'neonGrid'`) - Retro-futuristic grid patterns
6. **Plasma Field** (`'plasmaField'`) - Dynamic plasma-like patterns


## 📊 Analytics (Optional)

You can optionally log 404 hits by specifying an `apiEndpoint` in the config. This is not required for normal use.

## 🔧 Development


### File Structure

```
404museum/
├── index.html          # Project homepage
├── demo.html           # Interactive demo
├── 404museum.js        # Main library (development)
├── 404museumPatterns.js # Art pattern functions (modular)
├── 404museum.bundle.js # Bundle entry for all code
├── 404museum.min.js    # Minified bundle (production)
├── server.js           # Node.js backend API
├── package.json        # Backend dependencies
└── README.md           # This file
```

### Building


The library is written in vanilla JavaScript. To build the minified bundle:

1. Run `npm install` (if not already)
2. Run `node build-404museum.js` to generate `404museum.min.js`

### Testing

Test the library by:

1. Opening `demo.html` in a browser
2. Clicking "Launch 404Museum" button
3. Or creating a real 404 page and including the script

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

MIT License - feel free to use in personal and commercial projects.

## 🌟 Examples


### Basic Implementation

```html
<!DOCTYPE html>
<html>
<head>
    <title>404 - Page Not Found</title>
    <script src="https://passghost.github.io/jodylabs/404museum/404museum.min.js"></script>
</head>
<body>
    <h1>404 - Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
</body>
</html>
```

### Custom Configuration

```html
<!DOCTYPE html>
<html>
<head>
    <title>404 - Page Not Found</title>
    <script>
    window.Museum404Config = {
        customMessage: 'Oops! But look at this amazing art!',
        colors: {
            primary: '#ff4757',
            secondary: '#3742fa'
        },
        artTypes: ['particles', 'fractals'],
        apiEndpoint: 'https://api.mysite.com/404-log'
    };
    </script>
    <script src="https://passghost.github.io/jodylabs/404museum/404museum.min.js"></script>
</head>
<body>
    <h1>404 - Page Not Found</h1>
</body>
</html>
```

## 🎯 Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile browsers with Canvas support

## 📞 Support


- **Project Page**: [https://passghost.github.io/jodylabs/404museum/](https://passghost.github.io/jodylabs/404museum/)
- **Demo**: [https://passghost.github.io/jodylabs/404museum/demo.html](https://passghost.github.io/jodylabs/404museum/demo.html)
- **Issues**: Create an issue on the repository

---


Made with ❤️ by [JodyLabs](https://github.com/JodyLabs/404museum)

Transform your 404 errors into art experiences! 🎨
