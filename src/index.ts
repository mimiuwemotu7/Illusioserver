import dotenv from 'dotenv';
import { Connection } from '@solana/web3.js';
import { server, wsService } from './app';
import { MintWatcherService } from './services/mintWatcher';
import { MarketcapUpdaterService } from './services/marketcapUpdater';
import { MetadataEnricherService } from './services/metadataEnricherService';
import { TokenStatusUpdaterService } from './services/tokenStatusUpdater';
import { HolderIndexer } from './services/holderIndexer';
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
        // Test database connection
        const dbConnected = await db.testConnection();
        if (!dbConnected) {
            logger.error('Failed to connect to database. Exiting...');
            process.exit(1);
        }

        // Database schema already fixed manually - skipping ensureSchema
        // await db.ensureSchema();
        logger.info('✅ Database schema already fixed manually');

        // Start background services
        logger.info('Starting Solana Mint Discovery System...');
        
        // Start mint watcher service
        await mintWatcher.start();
        logger.info('✅ Mint Watcher: Real-time InitializeMint detection');
        
        // Start marketcap updater service
        await marketcapUpdater.start();
        logger.info('✅ Marketcap Updater: Rate-limited updates (60 RPM) every 10 seconds');
        
        // Start metadata enricher service
        await metadataEnricher.start();
        logger.info('✅ Metadata Enricher: Enriching tokens every 5 seconds');
        
        // Start token status updater service
        await tokenStatusUpdater.start();
        logger.info('✅ Token Status Updater: Moving tokens between categories every 10 seconds');
        
        // Start holder indexer service
        holderIndexer.start();
        logger.info('✅ Holder Indexer: Indexing token holders every 2 minutes');
        
        logger.info('🚀 Solana Mint Discovery System started successfully!');
        logger.info('🔍 Watching for new token mints via Helius WebSocket');
        logger.info('💰 Tracking marketcap from Birdeye API (60 RPM rate limit, 10s updates)');
        logger.info('📊 Tokens progress: fresh → curve → active (when migrating to AMM)');

                // Check if port is already in use and free it
        const checkAndFreePort = async () => {
            try {
                const { exec } = require('child_process');
                const util = require('util');
                const execAsync = util.promisify(exec);
                
                // Check if port is in use
                const { stdout } = await execAsync(`lsof -ti:${PORT}`);
                if (stdout.trim()) {
                    const pids = stdout.trim().split('\n');
                    const currentPid = process.pid.toString();
                    const otherPids = pids.filter((pid: string) => pid !== currentPid);
                    
                    if (otherPids.length > 0) {
                        logger.info(`Port ${PORT} is in use by PIDs: ${otherPids.join(', ')}. Freeing port...`);
                        
                        // Kill processes using the port (excluding current process)
                        for (const pid of otherPids) {
                            try {
                                process.kill(parseInt(pid), 'SIGTERM');
                                logger.info(`Killed process ${pid}`);
                            } catch (error) {
                                logger.warn(`Failed to kill process ${pid}:`, error);
                            }
                        }
                    } else {
                        logger.info(`Port ${PORT} is in use by current process only. Continuing...`);
                    }
                    
                    // Wait a moment for processes to terminate
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (error) {
                // Port is not in use, which is fine
                logger.debug(`Port ${PORT} is available`);
            }
        };
        
        // Free port and start server
        await checkAndFreePort();
        
        server.listen(PORT, () => {
            logger.info(`🚀 Solana Mint Discovery System is running on port ${PORT}`);
            logger.info(`📊 API available at http://localhost:${PORT}`);
            logger.info(`🐘 Database connection established`);
            logger.info(`🔍 Fresh mints: /api/tokens/fresh`);
            logger.info(`💰 Active tokens: /api/tokens/active`);
        });

    } catch (error) {
        logger.error('Error starting server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();
