import { Router, Request, Response } from 'express';

const router = Router();

// Admin dashboard HTML route
router.get('/', (_req: Request, res: Response) => {
    const adminDashboardHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ILLUSIO Admin Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0a0a;
            color: #ffffff;
            line-height: 1.6;
        }

        .header {
            background: #1a1a1a;
            padding: 1rem 2rem;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .header h1 {
            color: #00ff88;
            font-size: 1.8rem;
        }

        .auth-section {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .auth-input {
            background: #2a2a2a;
            border: 1px solid #444;
            color: #fff;
            padding: 0.5rem;
            border-radius: 4px;
        }

        .auth-btn {
            background: #00ff88;
            color: #000;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        }

        .auth-btn:hover {
            background: #00cc6a;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
        }

        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }

        .card {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 1.5rem;
        }

        .card h3 {
            color: #00ff88;
            margin-bottom: 1rem;
            font-size: 1.2rem;
        }

        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
            border-bottom: 1px solid #333;
        }

        .metric:last-child {
            border-bottom: none;
        }

        .metric-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #00ff88;
        }

        .error {
            color: #ff4444;
            background: #2a1a1a;
            padding: 1rem;
            border-radius: 4px;
            margin: 1rem 0;
        }

        .loading {
            text-align: center;
            padding: 2rem;
            color: #888;
        }

        .hidden {
            display: none;
        }

        .status-online {
            color: #00ff88;
        }

        .status-offline {
            color: #ff4444;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 ILLUSIO Admin Dashboard</h1>
        <div class="auth-section">
            <input type="password" id="adminKey" class="auth-input" placeholder="Admin Key" />
            <button onclick="authenticate()" class="auth-btn">Login</button>
            <button onclick="logout()" class="auth-btn" style="background: #ff4444;">Logout</button>
        </div>
    </div>

    <div id="loginMessage" class="error hidden">
        Please enter the admin key to access the dashboard.
    </div>

    <div id="dashboard" class="container hidden">
        <div class="header">
            <h2>Real-time Analytics</h2>
            <button onclick="refreshData()" class="auth-btn">🔄 Refresh</button>
        </div>

        <div class="dashboard-grid">
            <!-- Real-time Metrics -->
            <div class="card">
                <h3>📊 Real-time Metrics</h3>
                <div id="realtimeMetrics">
                    <div class="loading">Loading...</div>
                </div>
            </div>

            <!-- System Health -->
            <div class="card">
                <h3>🏥 System Health</h3>
                <div id="systemHealth">
                    <div class="loading">Loading...</div>
                </div>
            </div>

            <!-- Token Discovery -->
            <div class="card">
                <h3>🪙 Token Discovery</h3>
                <div id="tokenMetrics">
                    <div class="loading">Loading...</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let adminKey = '';

        // Authentication
        function authenticate() {
            const key = document.getElementById('adminKey').value;
            if (!key) {
                showError('Please enter an admin key');
                return;
            }
            
            adminKey = key;
            document.getElementById('loginMessage').classList.add('hidden');
            document.getElementById('dashboard').classList.remove('hidden');
            loadDashboardData();
        }

        function logout() {
            adminKey = '';
            document.getElementById('adminKey').value = '';
            document.getElementById('loginMessage').classList.remove('hidden');
            document.getElementById('dashboard').classList.add('hidden');
        }

        function showError(message) {
            const errorDiv = document.getElementById('loginMessage');
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }

        // API calls
        async function apiCall(endpoint) {
            try {
                const response = await fetch(\`/api/admin\${endpoint}\`, {
                    headers: {
                        'X-Admin-Key': adminKey
                    }
                });
                
                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                return await response.json();
            } catch (error) {
                console.error('API call failed:', error);
                throw error;
            }
        }

        // Load dashboard data
        async function loadDashboardData() {
            try {
                const [realtime, health, tokens] = await Promise.all([
                    apiCall('/realtime'),
                    apiCall('/health'),
                    apiCall('/tokens?range=day')
                ]);

                updateRealtimeMetrics(realtime.data);
                updateSystemHealth(health.data);
                updateTokenMetrics(tokens.data);

            } catch (error) {
                console.error('Failed to load dashboard data:', error);
                showError('Failed to load dashboard data: ' + error.message);
            }
        }

        // Update real-time metrics
        function updateRealtimeMetrics(data) {
            const container = document.getElementById('realtimeMetrics');
            container.innerHTML = \`
                <div class="metric">
                    <span>Active Users (5min)</span>
                    <span class="metric-value">\${data.activeUsers}</span>
                </div>
                <div class="metric">
                    <span>API Calls/min</span>
                    <span class="metric-value">\${data.apiCallsPerMinute}</span>
                </div>
                <div class="metric">
                    <span>Last Updated</span>
                    <span>\${new Date(data.timestamp).toLocaleTimeString()}</span>
                </div>
            \`;
        }

        // Update system health
        function updateSystemHealth(data) {
            const container = document.getElementById('systemHealth');
            const uptime = Math.floor(data.uptime / 3600);
            const memory = Math.round(data.memory.heapUsed / 1024 / 1024);
            
            container.innerHTML = \`
                <div class="metric">
                    <span>Database</span>
                    <span class="status-online">✅ Healthy</span>
                </div>
                <div class="metric">
                    <span>Uptime</span>
                    <span>\${uptime}h</span>
                </div>
                <div class="metric">
                    <span>Memory Usage</span>
                    <span>\${memory}MB</span>
                </div>
                <div class="metric">
                    <span>Recent Errors</span>
                    <span>\${data.recentErrors.length}</span>
                </div>
            \`;
        }

        // Update token metrics
        function updateTokenMetrics(data) {
            const container = document.getElementById('tokenMetrics');
            container.innerHTML = \`
                <div class="metric">
                    <span>Tokens Discovered</span>
                    <span class="metric-value">\${data.totalDiscovered}</span>
                </div>
                <div class="metric">
                    <span>By Source</span>
                    <span>\${data.bySource.map(s => \`\${s.source}: \${s.count}\`).join(', ')}</span>
                </div>
                <div class="metric">
                    <span>By Status</span>
                    <span>\${data.byStatus.map(s => \`\${s.status}: \${s.count}\`).join(', ')}</span>
                </div>
            \`;
        }

        // Refresh data
        function refreshData() {
            loadDashboardData();
        }

        // Auto-refresh every 30 seconds
        setInterval(() => {
            if (adminKey) {
                loadDashboardData();
            }
        }, 30000);
    </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(adminDashboardHTML);
});

export default router;
