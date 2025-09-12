import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import tokenRoutes from './api/tokenRoutes';
import transactionRoutes from './api/transactionRoutes';
import grokRoutes from './api/grokRoutes';
import adminRoutes from './api/adminRoutes';
import adminDashboardRoute from './routes/adminDashboard';
import { WebSocketService } from './api/websocket';
import { logger } from './utils/logger';
import { AnalyticsService } from './services/analyticsService';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS middleware
const allowedOrigins = [
    'https://illusio.xyz', 
    'https://www.illusio.xyz', 
    'https://illusio.vercel.app',
    'http://localhost:3000', 
    'http://localhost:3001', 
    'http://localhost:3002', 
    'http://localhost:3003', 
    'http://localhost:3004', 
    'http://localhost:3005', 
    'http://localhost:3006', 
    'http://localhost:3007', 
    'http://localhost:3008', 
    'http://localhost:8080'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            logger.info(`CORS allowing origin: ${origin} - Railway restart`);
            callback(null, true);
        } else {
            logger.warn(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Admin-Key', 'X-Session-ID'],
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Admin dashboard is now served via the embedded route in adminDashboard.ts

// Handle preflight requests
app.options('*', (req, res) => {
    logger.info(`Preflight request for ${req.path} from origin: ${req.get('Origin')}`);
    res.status(200).end();
});

// Analytics middleware
const analyticsService = AnalyticsService.getInstance();

app.use((req, res, next) => {
    const startTime = Date.now();
    const sessionId = req.headers['x-session-id'] as string || req.ip + '-' + Date.now();
    
    // Track session
    analyticsService.trackSession(sessionId, req.ip, req.get('User-Agent'));
    
    // Track API call
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        analyticsService.trackApiCall(
            sessionId,
            req.path,
            req.method,
            responseTime,
            res.statusCode,
            res.statusCode >= 400 ? 'Error' : undefined
        );
    });
    
    logger.info(`${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        origin: req.get('Origin'),
        referer: req.get('Referer')
    });
    next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API routes
app.use('/api/tokens', tokenRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/grok', grokRoutes);
app.use('/api/admin', adminRoutes);

// Admin dashboard route
app.use('/admin-dashboard', adminDashboardRoute);

// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        message: 'Solana Mint Discovery API',
        version: '2.0.0',
        endpoints: {
            health: '/health',
            fresh_tokens: '/api/tokens/fresh',
            active_tokens: '/api/tokens/active',
            all_tokens: '/api/tokens',
            token_transactions: '/api/transactions/:tokenMint'
        },
        features: {
            mint_discovery: 'Real-time InitializeMint detection via Helius WebSocket',
            marketcap_tracking: 'Automatic price updates every 5 seconds from Birdeye API',
            status_tracking: 'Tokens progress from fresh → active based on liquidity'
        },
        documentation: 'Simplified mint discovery and marketcap tracking system'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
    });
});

// Global error handler
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', error);
    
    // Don't leak error details in production
    const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message || 'Internal server error';
    
    res.status(error.status || 500).json({
        error: errorMessage,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });
});

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket service
const wsService = new WebSocketService(server);

// Export both app and server
export { wsService };
export default app;
export { server };
