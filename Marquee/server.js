const http = require('http');
const fs = require('fs');
const path = require('path');

// Allow port to be set via environment variable or command line argument
const PORT = process.env.PORT || process.argv[2] || 8000;
const ROOT = __dirname;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.txt': 'text/plain',
};

http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  let filePath = path.join(__dirname, reqPath === '/' ? 'marquee.html' : reqPath.replace(/^\//, ''));
  console.log(`[${new Date().toISOString()}] GET ${req.url} -> ${filePath}`);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.log(`  404 Not Found: ${filePath}`);
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('404 Not Found');
    } else {
      const ext = path.extname(filePath);
      res.writeHead(200, {'Content-Type': mimeTypes[ext] || 'application/octet-stream'});
      res.end(data);
    }
  });
}).listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
