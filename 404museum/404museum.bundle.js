
import * as patterns from './404museumPatterns.js';
import './404museum.js';

// Attach all pattern functions to window for global access
for (const [key, value] of Object.entries(patterns)) {
    window[key] = value;
}
