// build-404museum.js
// Build script to bundle 404museum.js and 404museumPatterns.js into 404museum.min.js
// Usage: node build-404museum.js

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const entryPoints = [
  path.join(__dirname, '404museum.js'),
  path.join(__dirname, '404museumPatterns.js')
];

esbuild.build({
  entryPoints,
  bundle: true,
  minify: true,
  outfile: path.join(__dirname, '404museum.min.js'),
  format: 'iife',
  target: ['es2018'],
  globalName: 'Museum404',
  logLevel: 'info',
}).then(() => {
  console.log('404museum.min.js built successfully with custom patterns!');
}).catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
