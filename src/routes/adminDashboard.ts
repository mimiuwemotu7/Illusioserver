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
            background: transparent;
            color: #ffffff;
            line-height: 1.6;
            overflow: hidden;
            height: 100vh;
        }

        .admin-container {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.95);
            backdrop-filter: blur(8px);
            z-index: 50;
            display: flex;
            flex-direction: column;
        }

        .header {
            background: rgba(0, 0, 0, 0.2);
            padding: 1rem 2rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            backdrop-filter: blur(10px);
        }

        .header h1 {
            color: #00ff88;
            font-size: 1.8rem;
            text-shadow: 0 0 10px rgba(0, 255, 136, 0.3);
        }

        .auth-section {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .auth-btn {
            background: rgba(0, 255, 136, 0.15);
            color: #00ff88;
            border: 1px solid rgba(0, 255, 136, 0.3);
            padding: 0.5rem 1rem;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        }

        .auth-btn:hover {
            background: rgba(0, 255, 136, 0.25);
            border-color: rgba(0, 255, 136, 0.5);
            box-shadow: 0 0 15px rgba(0, 255, 136, 0.2);
        }

        .logout-btn {
            background: rgba(255, 68, 68, 0.15);
            color: #ff4444;
            border: 1px solid rgba(255, 68, 68, 0.3);
        }

        .logout-btn:hover {
            background: rgba(255, 68, 68, 0.25);
            border-color: rgba(255, 68, 68, 0.5);
            box-shadow: 0 0 15px rgba(255, 68, 68, 0.2);
        }

        .container {
            flex: 1;
            padding: 2rem;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.15);
        }

        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }

        .card {
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 1.5rem;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .card h3 {
            color: #00ff88;
            margin-bottom: 1rem;
            font-size: 1.2rem;
            text-shadow: 0 0 10px rgba(0, 255, 136, 0.3);
        }

        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .metric:last-child {
            border-bottom: none;
        }

        .metric-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #00ff88;
            text-shadow: 0 0 10px rgba(0, 255, 136, 0.3);
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
            text-shadow: 0 0 10px rgba(0, 255, 136, 0.3);
        }

        .status-offline {
            color: #ff4444;
            text-shadow: 0 0 10px rgba(255, 68, 68, 0.3);
        }

        /* Login Popup */
        .login-popup {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            z-index: 60;
            display: flex;
            items-center;
            justify-content: center;
        }

        .login-popup.hidden {
            display: none;
        }

        .login-modal {
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 2rem;
            max-width: 400px;
            width: 90%;
            position: relative;
            z-index: 70;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(20px);
        }

        .login-modal h2 {
            color: #00ff88;
            text-align: center;
            margin-bottom: 1.5rem;
            font-size: 1.5rem;
            text-shadow: 0 0 10px rgba(0, 255, 136, 0.3);
        }

        .login-input {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #fff;
            padding: 0.75rem;
            border-radius: 8px;
            width: 100%;
            margin-bottom: 1rem;
            backdrop-filter: blur(10px);
        }

        .login-input:focus {
            outline: none;
            border-color: rgba(0, 255, 136, 0.5);
            box-shadow: 0 0 15px rgba(0, 255, 136, 0.2);
        }

        .login-btn {
            background: rgba(0, 255, 136, 0.15);
            color: #00ff88;
            border: 1px solid rgba(0, 255, 136, 0.3);
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            width: 100%;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        }

        .login-btn:hover {
            background: rgba(0, 255, 136, 0.25);
            border-color: rgba(0, 255, 136, 0.5);
            box-shadow: 0 0 15px rgba(0, 255, 136, 0.2);
        }

        .error-message {
            color: #ff4444;
            background: rgba(255, 68, 68, 0.1);
            border: 1px solid rgba(255, 68, 68, 0.3);
            padding: 0.75rem;
            border-radius: 8px;
            margin-top: 1rem;
            text-align: center;
            backdrop-filter: blur(10px);
        }

        .refresh-btn {
            background: rgba(0, 255, 136, 0.15);
            color: #00ff88;
            border: 1px solid rgba(0, 255, 136, 0.3);
            padding: 0.5rem 1rem;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        }

        .refresh-btn:hover {
            background: rgba(0, 255, 136, 0.25);
            border-color: rgba(0, 255, 136, 0.5);
            box-shadow: 0 0 15px rgba(0, 255, 136, 0.2);
        }
    </style>
</head>
<body>
    <!-- Login Popup -->
    <div id="loginPopup" class="login-popup">
        <div class="login-modal">
            <h2>🔐 Admin Access</h2>
            <input type="password" id="adminKey" class="login-input" placeholder="Enter Admin Key" />
            <button onclick="authenticate()" class="login-btn">Login</button>
            <div id="loginError" class="error-message hidden"></div>
        </div>
    </div>

    <!-- Main Dashboard -->
    <div id="dashboard" class="admin-container hidden">
        <div class="header">
            <h1>🚀 ILLUSIO Admin Dashboard</h1>
            <div class="auth-section">
                <button onclick="refreshData()" class="refresh-btn">🔄 Refresh</button>
                <button onclick="logout()" class="auth-btn logout-btn">Logout</button>
            </div>
        </div>

        <div class="container">
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
    </div>

    <script>
        let adminKey = '';

        // Authentication
        function authenticate() {
            const key = document.getElementById('adminKey').value;
            if (!key) {
                showLoginError('Please enter an admin key');
                return;
            }
            
            adminKey = key;
            document.getElementById('loginPopup').classList.add('hidden');
            document.getElementById('dashboard').classList.remove('hidden');
            loadDashboardData();
        }

        function logout() {
            adminKey = '';
            document.getElementById('adminKey').value = '';
            document.getElementById('loginPopup').classList.remove('hidden');
            document.getElementById('dashboard').classList.add('hidden');
            hideLoginError();
        }

        function showLoginError(message) {
            const errorDiv = document.getElementById('loginError');
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }

        function hideLoginError() {
            const errorDiv = document.getElementById('loginError');
            errorDiv.classList.add('hidden');
        }

        // API calls
        async function apiCall(endpoint) {
            try {
                const response = await fetch(\`https://server-production-d3da.up.railway.app/api/admin\${endpoint}\`, {
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
                // Show error in dashboard instead of popup
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = 'Failed to load dashboard data: ' + error.message;
                document.querySelector('.container').prepend(errorDiv);
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
