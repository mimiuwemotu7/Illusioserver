import { tokenRepository } from '../db/repository';
import { logger } from '../utils/logger';
import { MarketDataService } from './marketDataService';

export class SimpleMarketcapUpdaterService {
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    private marketDataService: MarketDataService;

    constructor(birdeyeApiKey: string, heliusApiKey: string) {
        this.marketDataService = new MarketDataService(birdeyeApiKey, heliusApiKey);
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.info('Simple marketcap updater is already running');
            return;
        }

        try {
            console.log('🚀 Starting SIMPLE marketcap updater service...');
            logger.info('🚀 Starting SIMPLE marketcap updater service...');
            
            // Start the update loop - much slower for background updates
            this.intervalId = setInterval(async () => {
                try {
                    await this.updateExistingTokens();
                } catch (error) {
                    console.error('❌ Error in simple marketcap update cycle:', error);
                    logger.error('❌ Error in simple marketcap update cycle:', error);
                }
            }, 30000); // 30 seconds - much slower for background updates

            this.isRunning = true;
            console.log('✅ Simple marketcap updater service started successfully');
            logger.info('✅ Simple marketcap updater service started successfully');
            
        } catch (error) {
            logger.error('❌ Failed to start simple marketcap updater service:', error);
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.info('Simple marketcap updater is not running');
            return;
        }

        try {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            
            this.isRunning = false;
            logger.info('Simple marketcap updater service stopped');
            
        } catch (error) {
            logger.error('Error stopping simple marketcap updater service:', error);
            throw error;
        }
    }

    private async updateExistingTokens(): Promise<void> {
        try {
            console.log('🔄 Starting background marketcap update cycle...');
            logger.info('🔄 Starting background marketcap update cycle...');
            
            // Get tokens that need market data updates (older than 5 minutes)
            const tokensToUpdate = await tokenRepository.findTokensNeedingUpdate(20); // Only 20 tokens at a time
            
            if (tokensToUpdate.length === 0) {
                console.log('✅ No tokens need background updates');
                logger.info('✅ No tokens need background updates');
                return;
            }
            
            console.log(`🎯 Background updating ${tokensToUpdate.length} tokens`);
            logger.info(`🎯 Background updating ${tokensToUpdate.length} tokens`);
            
            // Process tokens one by one with rate limiting
            for (const token of tokensToUpdate) {
                try {
                    console.log(`🔄 Background updating ${token.mint.slice(0, 8)}...`);
                    
                    // Use the same market data service but for background updates
                    const success = await this.marketDataService.fetchMarketDataImmediately(token.mint, token.id);
                    
                    if (success) {
                        console.log(`✅ Background update success for ${token.mint.slice(0, 8)}`);
                        logger.info(`✅ Background update success for ${token.mint.slice(0, 8)}`);
                    } else {
                        console.log(`❌ Background update failed for ${token.mint.slice(0, 8)}`);
                        logger.warn(`❌ Background update failed for ${token.mint.slice(0, 8)}`);
                    }
                    
                    // Small delay between tokens to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between tokens
                    
                } catch (error) {
                    console.error(`❌ Error updating ${token.mint}:`, error);
                    logger.error(`❌ Error updating ${token.mint}:`, error);
                }
            }
            
            console.log('✅ Background marketcap update cycle completed');
            logger.info('✅ Background marketcap update cycle completed');
            
        } catch (error) {
            logger.error('❌ Error in background marketcap update cycle:', error);
        }
    }
}
