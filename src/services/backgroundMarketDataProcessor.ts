import { logger } from '../utils/logger';
import { tokenRepository } from '../db/repository';
import { MarketDataService } from './marketDataService';

export class BackgroundMarketDataProcessor {
    private marketDataService: MarketDataService;
    private isRunning: boolean = false;
    private processingInterval: NodeJS.Timeout | null = null;
    private readonly PROCESSING_INTERVAL = 5000; // Process every 5 seconds
    private readonly BATCH_SIZE = 10; // Process 10 tokens at a time
    private readonly MAX_TOKEN_AGE = 300000; // Only process tokens less than 5 minutes old (300 seconds)

    constructor(birdeyeApiKey: string, heliusApiKey: string) {
        this.marketDataService = new MarketDataService(birdeyeApiKey, heliusApiKey);
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.info('Background market data processor is already running');
            return;
        }

        this.isRunning = true;
        logger.info('🚀 Starting background market data processor...');

        // Start processing immediately
        this.processTokensNeedingMarketData();

        // Set up interval for continuous processing
        this.processingInterval = setInterval(() => {
            this.processTokensNeedingMarketData();
        }, this.PROCESSING_INTERVAL);

        logger.info('✅ Background market data processor started');
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.info('Background market data processor is not running');
            return;
        }

        this.isRunning = false;

        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }

        logger.info('Background market data processor stopped');
    }

    private async processTokensNeedingMarketData(): Promise<void> {
        try {
            // Get tokens that need market data (no batching, process all in parallel)
            const tokensNeedingData = await tokenRepository.findTokensNeedingMarketData(this.BATCH_SIZE);
            
            if (tokensNeedingData.length === 0) {
                return; // No tokens need processing
            }

            console.log(`🔄 BACKGROUND PROCESSOR: Processing ${tokensNeedingData.length} tokens needing market data`);
            logger.info(`🔄 BACKGROUND PROCESSOR: Processing ${tokensNeedingData.length} tokens needing market data`);

            // Filter tokens by age - only process recent tokens (guardrail)
            const recentTokens = tokensNeedingData.filter((token: any) => {
                const tokenAge = Date.now() - new Date(token.created_at).getTime();
                const isRecent = tokenAge <= this.MAX_TOKEN_AGE;
                
                if (!isRecent) {
                    console.log(`⏰ BACKGROUND: Token ${token.mint.slice(0, 8)}... too old (${Math.round(tokenAge / 1000)}s), skipping`);
                }
                
                return isRecent;
            });

            if (recentTokens.length === 0) {
                console.log(`⏰ BACKGROUND: No recent tokens to process (all older than ${this.MAX_TOKEN_AGE / 1000}s)`);
                return;
            }

            console.log(`🔄 BACKGROUND: Processing ${recentTokens.length} recent tokens (filtered from ${tokensNeedingData.length})`);

            // Process all recent tokens in parallel for maximum speed
            const results = await Promise.allSettled(
                recentTokens.map(async (token: any) => {
                    try {
                        console.log(`🔍 BACKGROUND: Fetching market data for ${token.mint.slice(0, 8)}...`);
                        
                        // Add a small delay based on token age to allow indexing
                        const tokenAge = Date.now() - new Date(token.created_at).getTime();
                        const minAge = 2000; // 2 seconds minimum age
                        
                        if (tokenAge < minAge) {
                            console.log(`⏳ BACKGROUND: Token ${token.mint.slice(0, 8)}... too new (${tokenAge}ms), skipping`);
                            return;
                        }

                        const success = await this.marketDataService.fetchMarketDataImmediately(token.mint, token.id);
                        
                        if (success) {
                            console.log(`✅ BACKGROUND SUCCESS: Market data fetched for ${token.mint.slice(0, 8)}...`);
                            logger.info(`✅ BACKGROUND SUCCESS: Market data fetched for ${token.mint.slice(0, 8)}...`);
                        } else {
                            console.log(`⚠️ BACKGROUND FAILED: No market data for ${token.mint.slice(0, 8)}...`);
                        }
                    } catch (error) {
                        console.error(`❌ BACKGROUND ERROR for ${token.mint.slice(0, 8)}...:`, error);
                        logger.error(`❌ BACKGROUND ERROR for ${token.mint.slice(0, 8)}...:`, error);
                    }
                })
            );

            const successCount = results.filter(r => r.status === 'fulfilled').length;
            console.log(`✅ BACKGROUND PROCESSOR: Completed ${successCount}/${tokensNeedingData.length} tokens`);
            logger.info(`✅ BACKGROUND PROCESSOR: Completed ${successCount}/${tokensNeedingData.length} tokens`);

        } catch (error) {
            console.error('❌ Background market data processor error:', error);
            logger.error('❌ Background market data processor error:', error);
        }
    }
}
