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
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #000;
            color: #ffffff;
            line-height: 1.6;
            overflow: hidden;
            height: 100vh;
            font-weight: 400;
        }

        .admin-container {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.95);
            backdrop-filter: blur(20px);
            z-index: 50;
            display: flex;
            flex-direction: column;
        }

        .header {
            background: rgba(0, 0, 0, 0.4);
            padding: 1.5rem 2rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
            backdrop-filter: blur(20px);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .header h1 {
            color: #ffffff;
            font-size: 1.75rem;
            font-weight: 600;
            letter-spacing: -0.02em;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
        }

        .auth-section {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .auth-btn {
            background: rgba(255, 255, 255, 0.05);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 0.75rem 1.5rem;
            border-radius: 12px;
            cursor: pointer;
            font-weight: 500;
            font-size: 0.875rem;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .auth-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.3);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            transform: translateY(-1px);
        }

        .logout-btn {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .logout-btn:hover {
            background: rgba(239, 68, 68, 0.2);
            border-color: rgba(239, 68, 68, 0.5);
            box-shadow: 0 8px 24px rgba(239, 68, 68, 0.2);
        }

        .container {
            flex: 1;
            padding: 2rem;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.1);
        }

        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }

        .card {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 2rem;
            backdrop-filter: blur(20px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .card:hover {
            border-color: rgba(255, 255, 255, 0.2);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
            transform: translateY(-2px);
        }

        .card h3 {
            color: #ffffff;
            margin-bottom: 1.5rem;
            font-size: 1.25rem;
            font-weight: 600;
            letter-spacing: -0.01em;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
        }

        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.2s ease;
        }

        .metric:hover {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 8px;
            padding-left: 0.5rem;
            padding-right: 0.5rem;
        }

        .metric:last-child {
            border-bottom: none;
        }

        .metric-label {
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.875rem;
            font-weight: 500;
        }

        .metric-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #ffffff;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
            letter-spacing: -0.02em;
        }

        .metric-value.success {
            color: #10b981;
            text-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
        }

        .metric-value.warning {
            color: #f59e0b;
            text-shadow: 0 0 20px rgba(245, 158, 11, 0.3);
        }

        .metric-value.error {
            color: #ef4444;
            text-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
        }

        .loading {
            text-align: center;
            padding: 3rem 2rem;
            color: rgba(255, 255, 255, 0.5);
            font-size: 0.875rem;
            font-weight: 500;
        }

        .hidden {
            display: none;
        }

        .status-online {
            color: #10b981;
            text-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
        }

        .status-offline {
            color: #ef4444;
            text-shadow: 0 0 20px rgba(239, 68, 68, 0.3);
        }

        /* Login Popup */
        .login-popup {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(20px);
            z-index: 60;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .login-popup.hidden {
            display: none;
        }

        .login-modal {
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 16px;
            padding: 2.5rem;
            max-width: 420px;
            width: 90%;
            position: relative;
            z-index: 70;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(20px);
        }

        .login-modal h2 {
            color: #ffffff;
            text-align: center;
            margin-bottom: 2rem;
            font-size: 1.5rem;
            font-weight: 600;
            letter-spacing: -0.02em;
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
        }

        .login-input {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #ffffff;
            padding: 1rem;
            border-radius: 12px;
            width: 100%;
            margin-bottom: 1.5rem;
            backdrop-filter: blur(10px);
            font-size: 0.875rem;
            font-weight: 500;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .login-input:focus {
            outline: none;
            border-color: rgba(255, 255, 255, 0.4);
            box-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.08);
        }

        .login-input::placeholder {
            color: rgba(255, 255, 255, 0.5);
        }

        .login-btn {
            background: rgba(255, 255, 255, 0.1);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 1rem 1.5rem;
            border-radius: 12px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.875rem;
            width: 100%;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .login-btn:hover {
            background: rgba(255, 255, 255, 0.15);
            border-color: rgba(255, 255, 255, 0.4);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            transform: translateY(-1px);
        }

        .error-message {
            color: #ef4444;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            padding: 1rem;
            border-radius: 12px;
            margin-top: 1.5rem;
            text-align: center;
            backdrop-filter: blur(10px);
            font-size: 0.875rem;
            font-weight: 500;
        }

        .refresh-btn {
            background: rgba(255, 255, 255, 0.05);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 0.75rem 1.5rem;
            border-radius: 12px;
            cursor: pointer;
            font-weight: 500;
            font-size: 0.875rem;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .refresh-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.3);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            transform: translateY(-1px);
        }
    </style>
</head>
<body>
    <!-- Login Popup -->
    <div id="loginPopup" class="login-popup">
        <div class="login-modal">
            <h2>🔐 Admin Access</h2>
            <input type="password" id="adminKey" class="login-input" placeholder="Enter Admin Key" />
            <button class="login-btn" id="loginButton">Login</button>
            <div id="loginError" class="error-message hidden"></div>
        </div>
    </div>

    <!-- Main Dashboard -->
    <div id="dashboard" class="admin-container hidden">
        <div class="header">
            <h1>🚀 ILLUSIO Admin Dashboard</h1>
            <div class="auth-section">
                <button class="refresh-btn" id="refreshButton">🔄 Refresh</button>
                <button class="auth-btn logout-btn" id="logoutButton">Logout</button>
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
            console.log('🔐 Authenticate function called');
            try {
                const key = document.getElementById('adminKey').value;
                console.log('🔑 Admin key length:', key ? key.length : 0);
                
                if (!key) {
                    showLoginError('Please enter an admin key');
                    return;
                }
                
                adminKey = key;
                console.log('✅ Admin key set, hiding popup and showing dashboard');
                
                document.getElementById('loginPopup').classList.add('hidden');
                document.getElementById('dashboard').classList.remove('hidden');
                
                console.log('📊 Loading dashboard data...');
                loadDashboardData();
            } catch (error) {
                console.error('❌ Authentication error:', error);
                showLoginError('Authentication failed: ' + error.message);
            }
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
                // Use relative URL if accessed through proxy, otherwise use full URL
                const baseUrl = window.location.hostname === 'www.illusio.xyz' 
                    ? 'https://server-production-d3da.up.railway.app/api/admin' 
                    : 'https://server-production-d3da.up.railway.app/api/admin';
                
                const response = await fetch(\`\${baseUrl}\${endpoint}\`, {
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
                    <span class="metric-label">Active Users (5min)</span>
                    <span class="metric-value success">\${data.activeUsers}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">API Calls/min</span>
                    <span class="metric-value">\${data.apiCallsPerMinute}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Last Updated</span>
                    <span class="metric-value">\${new Date(data.timestamp).toLocaleTimeString()}</span>
                </div>
            \`;
        }

        // Update system health
        function updateSystemHealth(data) {
            const container = document.getElementById('systemHealth');
            const uptime = Math.floor(data.uptime / 3600);
            const memory = Math.round(data.memory.heapUsed / 1024 / 1024);
            const errorCount = data.recentErrors.length;
            
            container.innerHTML = \`
                <div class="metric">
                    <span class="metric-label">Database</span>
                    <span class="metric-value success">✅ Healthy</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Uptime</span>
                    <span class="metric-value">\${uptime}h</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Memory Usage</span>
                    <span class="metric-value">\${memory}MB</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Recent Errors</span>
                    <span class="metric-value \${errorCount > 0 ? 'error' : 'success'}">\${errorCount}</span>
                </div>
            \`;
        }

        // Update token metrics
        function updateTokenMetrics(data) {
            const container = document.getElementById('tokenMetrics');
            container.innerHTML = \`
                <div class="metric">
                    <span class="metric-label">Tokens Discovered</span>
                    <span class="metric-value success">\${data.totalDiscovered.toLocaleString()}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">By Source</span>
                    <span class="metric-value">\${data.bySource.map(s => \`\${s.source}: \${s.count}\`).join(', ')}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">By Status</span>
                    <span class="metric-value">\${data.byStatus.map(s => \`\${s.status}: \${s.count}\`).join(', ')}</span>
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

        // Initialize all event listeners
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 Admin dashboard loaded');
            
            // Login button
            const loginButton = document.getElementById('loginButton');
            if (loginButton) {
                console.log('✅ Login button found');
                loginButton.addEventListener('click', function(e) {
                    console.log('🖱️ Login button clicked!');
                    e.preventDefault();
                    authenticate();
                });
            } else {
                console.error('❌ Login button not found');
            }
            
            // Refresh button
            const refreshButton = document.getElementById('refreshButton');
            if (refreshButton) {
                console.log('✅ Refresh button found');
                refreshButton.addEventListener('click', function(e) {
                    console.log('🖱️ Refresh button clicked!');
                    e.preventDefault();
                    refreshData();
                });
            } else {
                console.error('❌ Refresh button not found');
            }
            
            // Logout button
            const logoutButton = document.getElementById('logoutButton');
            if (logoutButton) {
                console.log('✅ Logout button found');
                logoutButton.addEventListener('click', function(e) {
                    console.log('🖱️ Logout button clicked!');
                    e.preventDefault();
                    logout();
                });
            } else {
                console.error('❌ Logout button not found');
            }
            
            // Admin key input
            const adminKeyInput = document.getElementById('adminKey');
            if (adminKeyInput) {
                console.log('✅ Admin key input found');
                adminKeyInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        console.log('⌨️ Enter key pressed');
                        authenticate();
                    }
                });
            } else {
                console.error('❌ Admin key input not found');
            }
        });
    </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(adminDashboardHTML);
});

export default router;
