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
<script src="https://jodylabs.surge.sh/404museum/404museum.min.js"></script>
```

That's it! 404Museum will automatically detect and transform any 404 pages on your site.

## 📖 Demo

- **Live Demo**: [https://jodylabs.surge.sh/404museum/demo.html](https://jodylabs.surge.sh/404museum/demo.html)
- **Project Page**: [https://jodylabs.surge.sh/404museum/](https://jodylabs.surge.sh/404museum/)

## ⚙️ Configuration

Customize 404Museum by defining configuration before loading the script:

```html
<script>
window.Museum404Config = {
    theme: 'dark', // 'light' or 'dark'
    artTypes: ['generative', 'particles', 'fractals', 'abstract'],
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
    animationSpeed: 1,
    apiEndpoint: 'https://your-api.com/404-logs' // Optional analytics endpoint
};
</script>
<script src="https://jodylabs.surge.sh/404museum/404museum.min.js"></script>
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
3. **Fractal Trees** (`'fractals'`) - Recursive branching patterns
4. **Abstract Patterns** (`'abstract'`) - Geometric orbital designs

## 📊 Analytics Backend

The project includes a Node.js backend for logging 404 visits:

### Setup

```bash
cd 404museum
npm install
npm start
```

### API Endpoints

- `POST /api/404-log` - Log a 404 visit
- `GET /api/404-stats` - Get visit statistics
- `GET /api/404-visits` - Get recent visits
- `GET /dashboard` - View analytics dashboard

### Example Analytics Payload

```javascript
{
    "timestamp": "2025-07-02T10:30:00.000Z",
    "url": "https://example.com/missing-page",
    "referrer": "https://google.com",
    "userAgent": "Mozilla/5.0...",
    "viewport": {
        "width": 1920,
        "height": 1080
    }
}
```

## 🔧 Development

### Files Structure

```
404museum/
├── index.html          # Project homepage
├── demo.html           # Interactive demo
├── 404museum.js        # Main library (development)
├── 404museum.min.js    # Minified library (production)
├── server.js           # Node.js backend API
├── package.json        # Backend dependencies
└── README.md           # This file
```

### Building

The library is written in vanilla JavaScript with no build process required. To minify:

1. Use any JavaScript minifier
2. Or use the provided `404museum.min.js`

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
    <script src="https://jodylabs.surge.sh/404museum/404museum.min.js"></script>
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
    <script src="https://jodylabs.surge.sh/404museum/404museum.min.js"></script>
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

- **Project Page**: [https://jodylabs.surge.sh/404museum/](https://jodylabs.surge.sh/404museum/)
- **Demo**: [https://jodylabs.surge.sh/404museum/demo.html](https://jodylabs.surge.sh/404museum/demo.html)
- **Issues**: Create an issue on the repository

---

Made with ❤️ by [JodyLabs](https://jodylabs.surge.sh)

Transform your 404 errors into art experiences! 🎨
