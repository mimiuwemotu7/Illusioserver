import { tokenRepository, marketCapRepository } from '../db/repository';
import { logger } from '../utils/logger';
import { WebSocketService } from '../api/websocket';

interface MarketData {
    price_usd: number;
    marketcap: number;
    volume_24h: number;
    liquidity: number;
}

export class MarketcapUpdaterService {
    private isRunning: boolean = false; 
    private intervalId: NodeJS.Timeout | null = null;
    private birdeyeApiKey: string;
    private wsService: WebSocketService;
    private requestQueue: Array<() => Promise<void>> = [];
    private isProcessingQueue: boolean = false;
    private lastRequestTime: number = 0;
    private currentBatchIndex: number = 0; // Track which batch we're processing
    private readonly RATE_LIMIT_MS = 2000; // 2 seconds between requests (30 RPM = 1 request per 2 seconds)

    constructor(birdeyeApiKey: string, wsService: WebSocketService) {
        this.birdeyeApiKey = birdeyeApiKey;
        this.wsService = wsService;
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.info('Marketcap updater is already running');
            return;
        }

        try {
            logger.info('🚀 Starting marketcap updater service...');
            logger.info(`🔑 Birdeye API Key configured: ${this.birdeyeApiKey ? 'YES' : 'NO'}`);
            
            // Start the update loop (30 seconds to avoid rate limits)
            this.intervalId = setInterval(async () => {
                logger.info('⏰ Marketcap update cycle triggered');
                await this.updateAllTokens();
            }, 30000); // 30 seconds to avoid rate limits

            this.isRunning = true;
            logger.info('✅ Marketcap updater service started successfully');
            
        } catch (error) {
            logger.error('❌ Failed to start marketcap updater service:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.info('Marketcap updater is not running');
            return;
        }

        try {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            
            this.isRunning = false;
            logger.info('Marketcap updater service stopped');
            
        } catch (error) {
            logger.error('Error stopping marketcap updater service:', error);
            throw error;
        }
    }

    private async updateAllTokens(): Promise<void> {
        try {
            logger.info('🔄 Starting marketcap update cycle...');
            
            // Get all tokens and process them in batches for continuous updates
            const allTokens = await tokenRepository.getAllTokens();
            logger.info(`📊 Total tokens in database: ${allTokens.length}`);
            
            const targetTokens = allTokens.filter(t => this.isTargetToken(t));
            logger.info(`🎯 Target tokens for pricing: ${targetTokens.length}`);
            
            // Prioritize fresh mints - always include them in the batch
            const freshTokens = targetTokens.filter(t => t.status === 'fresh');
            const otherTokens = targetTokens.filter(t => t.status !== 'fresh');
            
            // Process fresh tokens first, then other tokens in rotating batches
            const batchSize = 10; // Smaller batches to avoid rate limits
            let tokensToProcess: any[] = [];
            
            // Always include fresh tokens (up to batch size)
            if (freshTokens.length > 0) {
                tokensToProcess = freshTokens.slice(0, batchSize);
                logger.info(`🔥 Processing ${freshTokens.length} fresh mints first`);
            }
            
            // Fill remaining slots with other tokens
            if (tokensToProcess.length < batchSize && otherTokens.length > 0) {
                const remainingSlots = batchSize - tokensToProcess.length;
                const startIndex = (this.currentBatchIndex * remainingSlots) % otherTokens.length;
                const additionalTokens = otherTokens.slice(startIndex, startIndex + remainingSlots);
                tokensToProcess = [...tokensToProcess, ...additionalTokens];
                
                // Update batch index for next cycle
                this.currentBatchIndex = (this.currentBatchIndex + 1) % Math.ceil(otherTokens.length / remainingSlots);
            }
            
            logger.info(`🚀 Processing batch: ${tokensToProcess.length} tokens (${freshTokens.length} fresh, ${tokensToProcess.length - freshTokens.length} others)`);
            
            // Log some sample tokens
            if (tokensToProcess.length > 0) {
                logger.info(`📝 Sample tokens: ${tokensToProcess.slice(0, 3).map(t => t.mint).join(', ')}`);
            }
            
            // Update target tokens with price data using rate-limited queue
            if (tokensToProcess.length > 0) {
                logger.info(`🚀 Queuing ${tokensToProcess.length} tokens for marketcap updates (60 RPM limit)`);
                
                // Add all tokens to the rate-limited queue
                tokensToProcess.forEach(token => {
                    this.requestQueue.push(() => this.updateTokenMarketcap(token.mint, token.id));
                });
                
                // Start processing the queue if not already processing
                if (!this.isProcessingQueue) {
                    this.processQueue();
                }
            } else {
                logger.warn('⚠️ No target tokens found for marketcap updates');
            }
            
            logger.info('✅ Marketcap update cycle completed');
            
        } catch (error) {
            logger.error('❌ Error in marketcap update cycle:', error);
        }
    }

    private isTargetToken(_token: any): boolean {
        // Prioritize fresh mints and active tokens
        // Process ALL tokens but prioritize fresh mints for immediate market cap data
        return true;
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;
        logger.info(`Processing rate-limited queue: ${this.requestQueue.length} requests pending`);

        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            if (request) {
                try {
                    // Ensure we respect the rate limit (1 request per second)
                    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
                    if (timeSinceLastRequest < this.RATE_LIMIT_MS) {
                        const waitTime = this.RATE_LIMIT_MS - timeSinceLastRequest;
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }

                    await request();
                    this.lastRequestTime = Date.now();
                    
                    // Log progress every 10 requests
                    if (this.requestQueue.length % 10 === 0) {
                        logger.info(`Queue progress: ${this.requestQueue.length} requests remaining`);
                    }
                } catch (error) {
                    logger.error('Error processing rate-limited request:', error);
                }
            }
        }

        this.isProcessingQueue = false;
        logger.info('Rate-limited queue processing completed');
    }

    private async updateTokenMarketcap(contractAddress: string, tokenId: number): Promise<void> {
        try {
            // Try to get market data from multiple sources
            let marketData: MarketData | null = null;
            
            // Use ONLY Birdeye API for marketcap data
            marketData = await this.getBirdeyeMarketData(contractAddress);
            
            if (marketData) {
                // Get previous marketcap data for price change detection
                const previousMarketcap = await marketCapRepository.getLatestMarketCap(tokenId);
                
                // Save marketcap data
                try {
                    await marketCapRepository.createMarketCap(
                        tokenId,
                        marketData.price_usd,
                        marketData.marketcap,
                        marketData.volume_24h,
                        marketData.liquidity
                    );
                    logger.info(`✅ Saved marketcap data for ${contractAddress}: $${marketData.marketcap}`);
                } catch (saveError: any) {
                    // Check if it's a database connection error
                    if (saveError.message && saveError.message.includes('pool')) {
                        logger.warn(`⚠️ Database connection issue for ${contractAddress}, skipping this update`);
                        return; // Skip this update but don't crash the service
                    }
                    logger.error(`❌ Failed to save marketcap data for ${contractAddress}:`, saveError);
                }
                
                // Check for significant price changes (>5%)
                if (previousMarketcap && previousMarketcap.price_usd > 0) {
                    const priceChangePercent = ((marketData.price_usd - previousMarketcap.price_usd) / previousMarketcap.price_usd) * 100;
                    
                    if (Math.abs(priceChangePercent) > 5) {
                        logger.info(`🚨 SIGNIFICANT PRICE CHANGE: ${contractAddress} ${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}% ($${previousMarketcap.price_usd} → $${marketData.price_usd})`);
                        
                        // Broadcast significant price change via WebSocket
                        this.wsService.broadcastPriceAlert({
                            mint: contractAddress,
                            previousPrice: previousMarketcap.price_usd,
                            currentPrice: marketData.price_usd,
                            changePercent: priceChangePercent,
                            marketcap: marketData.marketcap,
                            volume24h: marketData.volume_24h,
                            timestamp: new Date()
                        });
                    }
                }
                
                // DISABLED: Do not move fresh mints to active status
                // Fresh mints should stay fresh and visible in the fresh mints column
                // Only update market data, do not change status
                logger.debug(`Token ${contractAddress} market data updated but status unchanged (liquidity: $${marketData.liquidity.toLocaleString()})`);
                
                // Check for AMM migration (token moving from curve to AMM)
                await this.checkAMMMigration(contractAddress, tokenId);
                
                // Broadcast marketcap update via WebSocket
                const updatedToken = await tokenRepository.findByMint(contractAddress);
                if (updatedToken) {
                    this.wsService.broadcastTokenUpdate(updatedToken);
                }
                
                logger.debug(`Updated marketcap for ${contractAddress}: $${marketData.marketcap.toLocaleString()}`);
            } else {
                logger.debug(`No market data available for ${contractAddress}`);
            }
            
        } catch (error) {
            logger.error(`Error updating marketcap for ${contractAddress}:`, error);
        }
    }

    private async getBirdeyeMarketData(contractAddress: string, retryCount: number = 0): Promise<MarketData | null> {
        try {
            if (!this.birdeyeApiKey) {
                logger.warn('Birdeye API key not configured');
                return null;
            }
            
            logger.debug(`Fetching Birdeye data for ${contractAddress}`);
            const response = await fetch(`https://public-api.birdeye.so/defi/price?address=${contractAddress}&ui_amount_mode=raw`, {
                headers: { 
                    'X-API-KEY': this.birdeyeApiKey,
                    'x-chain': 'solana',
                    'accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 429 && retryCount < 3) {
                    // Rate limited - wait and retry
                    const waitTime = Math.pow(2, retryCount) * 2000; // Exponential backoff: 2s, 4s, 8s
                    logger.warn(`Birdeye rate limited for ${contractAddress}, retrying in ${waitTime}ms (attempt ${retryCount + 1}/3)`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    return this.getBirdeyeMarketData(contractAddress, retryCount + 1);
                }
                logger.warn(`Birdeye API error for ${contractAddress}: ${response.status} ${response.statusText}`);
                return null;
            }
            
            const data: any = await response.json();
            
            if (!data.success || !data.data) {
                logger.debug(`No Birdeye data for ${contractAddress}: ${JSON.stringify(data)}`);
                return null;
            }
            
            // Calculate marketcap using price and total supply
            // For now, we'll use a default supply of 1 billion tokens
            // In a real implementation, you'd fetch the actual total supply from the token
            const defaultSupply = 1000000000; // 1 billion tokens
            const calculatedMarketcap = data.data.value * defaultSupply;
            
            const marketData = {
                price_usd: data.data.value,
                marketcap: calculatedMarketcap,
                volume_24h: 0, // Birdeye price endpoint doesn't provide volume directly
                liquidity: data.data.liquidity || 0
            };
            
            logger.debug(`Birdeye data for ${contractAddress}: $${marketData.price_usd}, MC: $${marketData.marketcap}`);
            return marketData;
            
        } catch (error: any) {
            if (error?.cause?.code === "ENOTFOUND") {
                logger.debug("Birdeye DNS unavailable, skipping this tick");
                return null;
            }
            logger.error(`Birdeye API failed for ${contractAddress}:`, error);
            return null;
        }
    }


    private async checkAMMMigration(contractAddress: string, tokenId: number): Promise<void> {
        try {
            // Check if this token was previously on a curve and now has AMM data
            const token = await tokenRepository.findByMint(contractAddress);
            if (!token || !token.is_on_curve) return;

            // If we have marketcap data, the token has migrated to AMM
            await tokenRepository.updateTokenMetadata(
                tokenId,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                false // is_on_curve = false
            );
            
            logger.info(`AMM migration detected: ${contractAddress} → status=active (moved from curve to AMM)`);
            
        } catch (error) {
            logger.debug(`Error checking AMM migration for ${contractAddress}:`, error);
        }
    }
}
