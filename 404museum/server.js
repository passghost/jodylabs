/**
 * 404Museum Backend API
 * Simple Node.js/Express server for logging 404 visits and serving art assets
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage for demo (use a real database in production)
let visits = [];

/**
 * Log 404 visits
 */
app.post('/api/404-log', (req, res) => {
    try {
        const visit = {
            id: Date.now().toString(),
            timestamp: req.body.timestamp || new Date().toISOString(),
            url: req.body.url,
            referrer: req.body.referrer || 'direct',
            userAgent: req.body.userAgent,
            viewport: req.body.viewport,
            ip: req.ip || req.connection.remoteAddress
        };
        
        visits.push(visit);
        
        // Keep only last 1000 visits for demo
        if (visits.length > 1000) {
            visits = visits.slice(-1000);
        }
        
        console.log('404 Visit logged:', {
            url: visit.url,
            timestamp: visit.timestamp,
            referrer: visit.referrer
        });
        
        res.json({ success: true, id: visit.id });
    } catch (error) {
        console.error('Error logging visit:', error);
        res.status(500).json({ error: 'Failed to log visit' });
    }
});

/**
 * Get 404 visit statistics
 */
app.get('/api/404-stats', (req, res) => {
    try {
        const now = new Date();
        const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const recentVisits = visits.filter(v => new Date(v.timestamp) >= day);
        const weeklyVisits = visits.filter(v => new Date(v.timestamp) >= week);
        const monthlyVisits = visits.filter(v => new Date(v.timestamp) >= month);
        
        // Top referring domains
        const referrers = visits
            .filter(v => v.referrer && v.referrer !== 'direct')
            .map(v => {
                try {
                    return new URL(v.referrer).hostname;
                } catch {
                    return v.referrer;
                }
            })
            .reduce((acc, ref) => {
                acc[ref] = (acc[ref] || 0) + 1;
                return acc;
            }, {});
        
        // Top 404 URLs
        const topUrls = visits
            .map(v => v.url)
            .reduce((acc, url) => {
                acc[url] = (acc[url] || 0) + 1;
                return acc;
            }, {});
        
        const stats = {
            total: visits.length,
            today: recentVisits.length,
            week: weeklyVisits.length,
            month: monthlyVisits.length,
            topReferrers: Object.entries(referrers)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([domain, count]) => ({ domain, count })),
            topUrls: Object.entries(topUrls)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([url, count]) => ({ url, count }))
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

/**
 * Get recent 404 visits
 */
app.get('/api/404-visits', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const recentVisits = visits
            .slice(-limit)
            .reverse()
            .map(visit => ({
                id: visit.id,
                timestamp: visit.timestamp,
                url: visit.url,
                referrer: visit.referrer,
                viewport: visit.viewport
            }));
        
        res.json(recentVisits);
    } catch (error) {
        console.error('Error getting visits:', error);
        res.status(500).json({ error: 'Failed to get visits' });
    }
});

/**
 * Serve random art images (for future enhancement)
 */
app.get('/api/art/random', (req, res) => {
    const artTypes = ['abstract', 'geometric', 'nature', 'space'];
    const randomType = artTypes[Math.floor(Math.random() * artTypes.length)];
    
    res.json({
        type: randomType,
        imageUrl: `/images/art/${randomType}/${Math.floor(Math.random() * 10) + 1}.jpg`,
        description: `Beautiful ${randomType} art piece`,
        artist: 'AI Generated',
        created: new Date().toISOString()
    });
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        visits: visits.length
    });
});

/**
 * Serve 404Museum dashboard
 */
app.get('/dashboard', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>404Museum Dashboard</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
                    color: white;
                    margin: 0;
                    padding: 20px;
                }
                .container { max-width: 1200px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 40px; }
                .header h1 { 
                    font-size: 2.5rem; 
                    background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
                .stat-card { 
                    background: rgba(255, 255, 255, 0.05); 
                    padding: 20px; 
                    border-radius: 10px; 
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    text-align: center;
                }
                .stat-number { font-size: 2rem; font-weight: bold; color: #4ecdc4; }
                .stat-label { opacity: 0.8; margin-top: 5px; }
                .visits { background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); }
                .visit { padding: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
                .visit:last-child { border-bottom: none; }
                button { 
                    background: linear-gradient(45deg, #ff6b6b, #4ecdc4); 
                    border: none; 
                    color: white; 
                    padding: 10px 20px; 
                    border-radius: 5px; 
                    cursor: pointer; 
                    margin: 10px 5px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>404Museum Dashboard</h1>
                    <p>Analytics and monitoring for your 404 art galleries</p>
                </div>
                
                <div class="stats" id="stats">
                    <div class="stat-card">
                        <div class="stat-number" id="totalVisits">-</div>
                        <div class="stat-label">Total Visits</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="todayVisits">-</div>
                        <div class="stat-label">Today</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="weekVisits">-</div>
                        <div class="stat-label">This Week</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="monthVisits">-</div>
                        <div class="stat-label">This Month</div>
                    </div>
                </div>
                
                <div class="visits">
                    <h2>Recent 404 Visits</h2>
                    <button onclick="loadVisits()">Refresh</button>
                    <button onclick="loadStats()">Update Stats</button>
                    <div id="visitsList">Loading...</div>
                </div>
            </div>
            
            <script>
                async function loadStats() {
                    try {
                        const response = await fetch('/api/404-stats');
                        const stats = await response.json();
                        
                        document.getElementById('totalVisits').textContent = stats.total;
                        document.getElementById('todayVisits').textContent = stats.today;
                        document.getElementById('weekVisits').textContent = stats.week;
                        document.getElementById('monthVisits').textContent = stats.month;
                    } catch (error) {
                        console.error('Error loading stats:', error);
                    }
                }
                
                async function loadVisits() {
                    try {
                        const response = await fetch('/api/404-visits?limit=20');
                        const visits = await response.json();
                        
                        const visitsList = document.getElementById('visitsList');
                        visitsList.innerHTML = visits.map(visit => \`
                            <div class="visit">
                                <strong>\${new URL(visit.url).pathname}</strong><br>
                                <small>
                                    \${new Date(visit.timestamp).toLocaleString()} | 
                                    Referrer: \${visit.referrer || 'Direct'} |
                                    Viewport: \${visit.viewport ? visit.viewport.width + 'x' + visit.viewport.height : 'Unknown'}
                                </small>
                            </div>
                        \`).join('');
                    } catch (error) {
                        console.error('Error loading visits:', error);
                        document.getElementById('visitsList').innerHTML = 'Error loading visits';
                    }
                }
                
                // Load data on page load
                loadStats();
                loadVisits();
                
                // Auto-refresh every 30 seconds
                setInterval(() => {
                    loadStats();
                    loadVisits();
                }, 30000);
            </script>
        </body>
        </html>
    `);
});

// Start server
app.listen(PORT, () => {
    console.log(\`404Museum API server running on port \${PORT}\`);
    console.log(\`Dashboard available at: http://localhost:\${PORT}/dashboard\`);
    console.log(\`API endpoints:\`);
    console.log(\`  POST /api/404-log - Log a 404 visit\`);
    console.log(\`  GET  /api/404-stats - Get visit statistics\`);
    console.log(\`  GET  /api/404-visits - Get recent visits\`);
    console.log(\`  GET  /api/art/random - Get random art\`);
});

module.exports = app;
