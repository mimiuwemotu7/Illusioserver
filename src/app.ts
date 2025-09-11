import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import tokenRoutes from './api/tokenRoutes';
import transactionRoutes from './api/transactionRoutes';
import grokRoutes from './api/grokRoutes';
import { WebSocketService } from './api/websocket';
import { logger } from './utils/logger';

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
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((_req, _res, next) => {
    logger.info(`${_req.method} ${_req.path}`, {
        method: _req.method,
        path: _req.path,
        query: _req.query,
        ip: _req.ip,
        userAgent: _req.get('User-Agent'),
        origin: _req.get('Origin'),
        referer: _req.get('Referer')
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
