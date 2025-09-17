import dotenv from 'dotenv';
import { Connection } from '@solana/web3.js';
import { server, wsService } from './app';
import { MintWatcherService } from './services/mintWatcher';
import { MarketcapUpdaterService } from './services/marketcapUpdater';
import { MetadataEnricherService } from './services/metadataEnricherService';
import { TokenStatusUpdaterService } from './services/tokenStatusUpdater';
import { HolderIndexer } from './services/holderIndexer';
import { AnalyticsService } from './services/analyticsService';
import db from './db/connection';
import { tokenRepository } from './db/repository';
import { logger } from './utils/logger';

dotenv.config();

const PORT = process.env.PORT || 8080;

// Server is now imported from app.ts with WebSocket support

// Get required environment variables
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL;
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || '';

if (!HELIUS_RPC_URL) {
    logger.error('HELIUS_RPC_URL environment variable is required');
    process.exit(1);
}

if (!BIRDEYE_API_KEY) {
    logger.error('BIRDEYE_API_KEY environment variable is required');
    process.exit(1);
}

// Initialize services
const connection = new Connection(HELIUS_RPC_URL, 'confirmed');
const mintWatcher = new MintWatcherService(HELIUS_RPC_URL);
const marketcapUpdater = new MarketcapUpdaterService(BIRDEYE_API_KEY, wsService);
const metadataEnricher = new MetadataEnricherService(connection, tokenRepository);
const tokenStatusUpdater = new TokenStatusUpdaterService();
const holderIndexer = new HolderIndexer(connection, tokenRepository);

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Don't exit, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit, just log the error
});

// Graceful shutdown function
let isShuttingDown = false;
const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
        logger.info('Shutdown already in progress, ignoring signal:', signal);
        return;
    }
    
    isShuttingDown = true;
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    try {
        // Stop all services
        await mintWatcher.stop();
        await marketcapUpdater.stop();
        await metadataEnricher.stop();
        await tokenStatusUpdater.stop();
        holderIndexer.stop();
        
        // Close database connections
        await db.close();
        
        // Close HTTP server
        server.close(() => {
            logger.info('HTTP server closed');
            process.exit(0);
        });
        
        // Force exit after 10 seconds
        setTimeout(() => {
            logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
        
    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Remove duplicate handlers - they're already defined above

// Start the server
const startServer = async () => {
    try {
        // Start HTTP server immediately for healthcheck
        server.listen(PORT, () => {
            logger.info(`🚀 HTTP Server started on port ${PORT}`);
            logger.info(`📊 API available at http://localhost:${PORT}`);
            logger.info(`🔐 Admin Dashboard: http://localhost:${PORT}/admin-dashboard`);
            logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`🔑 Admin Key configured: ${process.env.ADMIN_KEY ? 'YES' : 'NO'}`);
            logger.info(`🔗 Helius RPC configured: ${process.env.HELIUS_RPC_URL ? 'YES' : 'NO'}`);
        });

        // Initialize services in background (non-blocking)
        const initializeServices = async () => {
            try {
                // Test database connection
                const dbConnected = await db.testConnection();
                if (!dbConnected) {
                    logger.error('Failed to connect to database. Services will not start.');
                    return;
                }

                // Ensure database schema exists
                await db.ensureSchema();
                logger.info('✅ Database schema ensured');

                // Start background services
                logger.info('Starting Solana Mint Discovery System...');
                
                // Start mint watcher service
                await mintWatcher.start();
                logger.info('✅ Mint Watcher: Real-time InitializeMint detection');
                
                // Start marketcap updater service
                await marketcapUpdater.start();
                logger.info('✅ Marketcap Updater: ULTRA-FAST updates every 2 seconds (100 fresh tokens)');
                
                // Start metadata enricher service
                await metadataEnricher.start();
                logger.info('✅ Metadata Enricher: ULTRA-FAST enrichment every 2 seconds (100 tokens)');
                
                // TEMPORARILY DISABLED - Fixing database issues
                // await tokenStatusUpdater.start();
                // logger.info('✅ Token Status Updater: Moving tokens between categories every 10 seconds');
                
                // Start holder indexer service
                holderIndexer.start();
                logger.info('✅ Holder Indexer: ULTRA-FAST holder indexing every 30 seconds (50 fresh tokens)');
                
                // Start analytics service
                const analyticsService = AnalyticsService.getInstance();
                await analyticsService.start();
                logger.info('✅ Analytics Service: Tracking user activity and system metrics');
                
                // Admin dashboard is now embedded in the route
                logger.info('✅ Admin Dashboard: Embedded route ready');
                
                logger.info('🚀 Solana Mint Discovery System started successfully!');
                logger.info('🔍 Watching for new token mints via Helius WebSocket');
                logger.info('💰 Tracking marketcap from Birdeye API (50 req/sec rate limit, 3s updates)');
                logger.info('📊 Tokens progress: fresh → curve → active (when migrating to AMM)');
                logger.info(`🐘 Database connection established`);
                logger.info(`🔍 Fresh mints: /api/tokens/fresh`);
                logger.info(`💰 Active tokens: /api/tokens/active`);

            } catch (error) {
                logger.error('Error initializing services:', error);
                // Don't exit, just log the error and continue with basic server functionality
            }
        };

        // Start services in background
        initializeServices();

    } catch (error) {
        logger.error('Error starting server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();
