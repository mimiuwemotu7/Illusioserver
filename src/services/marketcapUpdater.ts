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
    private readonly RATE_LIMIT_MS = 10; // 10ms between requests (100 req/sec - Birdeye Business plan limit)
    
    // Smart caching for 200+ users
    private marketDataCache: Map<string, { data: MarketData; timestamp: number }> = new Map();
    private readonly CACHE_TTL_MS = 5000; // 5 seconds cache for fresh mints

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
            console.log('🚀 Starting marketcap updater service...');
            logger.info('🚀 Starting marketcap updater service...');
            console.log(`🔑 Birdeye API Key configured: ${this.birdeyeApiKey ? 'YES' : 'NO'}`);
            logger.info(`🔑 Birdeye API Key configured: ${this.birdeyeApiKey ? 'YES' : 'NO'}`);
            console.log(`🔑 Birdeye API Key (first 10 chars): ${this.birdeyeApiKey ? this.birdeyeApiKey.substring(0, 10) + '...' : 'NOT SET'}`);
            logger.info(`🔑 Birdeye API Key (first 10 chars): ${this.birdeyeApiKey ? this.birdeyeApiKey.substring(0, 10) + '...' : 'NOT SET'}`);
            
            if (!this.birdeyeApiKey || this.birdeyeApiKey === 'your_birdeye_api_key_here') {
                logger.warn('⚠️ No Birdeye API key - marketcap updater will not fetch market data');
                logger.warn('⚠️ Set BIRDEYE_API_KEY environment variable to enable market data fetching');
                // Don't return - start the service anyway for fallback APIs
            }
            
            // Start the update loop (ULTRA FAST for fresh mints)
            this.intervalId = setInterval(async () => {
                try {
                    console.log('⏰ Marketcap update cycle triggered');
                    logger.info('⏰ Marketcap update cycle triggered');
                    await this.updateAllTokens();
                    
                    // Clean up expired cache entries
                    this.cleanupCache();
                } catch (error) {
                    console.error('❌ Error in marketcap update cycle:', error);
                    logger.error('❌ Error in marketcap update cycle:', error);
                }
            }, 500); // 500ms - ULTRA FAST updates for fresh mints

            this.isRunning = true;
            console.log('✅ Marketcap updater service started successfully');
            logger.info('✅ Marketcap updater service started successfully');
            
        } catch (error) {
            logger.error('❌ Failed to start marketcap updater service:', error);
            // Don't throw error - let other services start
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
            console.log('🔄 Starting marketcap update cycle...');
            logger.info('🔄 Starting marketcap update cycle...');
            
            // PRIORITY: Get the 50 most recent fresh tokens that match the frontend display logic
            // This ensures we update exactly what users see in the fresh mints column
            const freshTokens = await tokenRepository.findFreshTokens(50, 0); // Get exactly 50 most recent fresh tokens
            
            // Focus ONLY on fresh tokens for maximum speed and coverage
            const targetTokens = freshTokens;
            console.log(`🎯 Target tokens for pricing: ${targetTokens.length} fresh tokens`);
            logger.info(`🎯 Target tokens for pricing: ${targetTokens.length} fresh tokens`);
            
            // Process ALL 50 fresh tokens every cycle for maximum coverage
            const tokensToProcess = targetTokens.slice(0, 50); // Process exactly 50 fresh tokens every cycle
            console.log(`🚀 Processing ${tokensToProcess.length} fresh tokens every 500ms`);
            logger.info(`🚀 Processing ${tokensToProcess.length} fresh tokens every 500ms`);
            
            // Log some sample tokens with their current marketcap status
            if (tokensToProcess.length > 0) {
                const sampleTokens = tokensToProcess.slice(0, 3);
                const sampleInfo = sampleTokens.map(t => `${t.mint.slice(0,8)}... (MC: ${(t as any).marketcap ? `$${(t as any).marketcap}` : 'N/A'})`).join(', ');
                logger.info(`📝 Sample tokens: ${sampleInfo}`);
                
                // Count tokens with and without market data
                const tokensWithData = tokensToProcess.filter(t => (t as any).marketcap && (t as any).marketcap > 0).length;
                const tokensWithoutData = tokensToProcess.length - tokensWithData;
                logger.info(`📊 Market data status: ${tokensWithData} tokens with data, ${tokensWithoutData} tokens without data`);
            }
            
            // Update target tokens with price data using BATCH API CALLS for maximum speed
            if (tokensToProcess.length > 0) {
                console.log(`🚀 BATCH PROCESSING ${tokensToProcess.length} tokens for marketcap updates (100 req/sec limit)`);
                logger.info(`🚀 BATCH PROCESSING ${tokensToProcess.length} tokens for marketcap updates (100 req/sec limit)`);
                
                // Process tokens in batches of 20 for optimal API usage
                const batchSize = 20;
                const batches = [];
                for (let i = 0; i < tokensToProcess.length; i += batchSize) {
                    batches.push(tokensToProcess.slice(i, i + batchSize));
                }
                
                // Process each batch with rate limiting
                batches.forEach((batch, batchIndex) => {
                    this.requestQueue.push(async () => {
                        logger.info(`🔄 Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} tokens`);
                        await this.updateBatchMarketcap(batch);
                    });
                });
                
                // Start processing the queue if not already processing
                if (!this.isProcessingQueue) {
                    this.processQueue();
                }
            } else {
                console.log('⚠️ No target tokens found for marketcap updates');
                logger.warn('⚠️ No target tokens found for marketcap updates');
            }
            
            logger.info('✅ Marketcap update cycle completed');
            
        } catch (error) {
            logger.error('❌ Error in marketcap update cycle:', error);
        }
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

    // Immediate update for fresh mints (bypasses queue for speed)
    public async updateTokenMarketcapImmediately(contractAddress: string, tokenId: number): Promise<void> {
        try {
            logger.info(`🚀 IMMEDIATE marketcap update for fresh mint: ${contractAddress}`);
            
            // Add to high priority queue for immediate processing
            this.requestQueue.unshift(async () => {
                await this.updateTokenMarketcap(contractAddress, tokenId);
            });
            
            // Process queue immediately if not already processing
            if (!this.isProcessingQueue) {
                this.processQueue();
            }
            
        } catch (error) {
            logger.error(`❌ Immediate marketcap update failed for ${contractAddress}:`, error);
        }
    }

    private async updateTokenMarketcap(contractAddress: string, tokenId: number): Promise<void> {
        try {
            logger.info(`🔍 Starting marketcap update for ${contractAddress.slice(0,8)}...`);
            
            // Try to get market data from multiple sources
            let marketData: MarketData | null = null;
            
            // Try Birdeye API first for comprehensive market data
            logger.info(`🌐 Attempting Birdeye API for ${contractAddress.slice(0,8)}...`);
            marketData = await this.getBirdeyeMarketData(contractAddress);
            
            // If Birdeye fails or returns no data, try Jupiter as fallback
            if (!marketData || marketData.price_usd === 0) {
                logger.info(`🔄 Birdeye failed for ${contractAddress.slice(0,8)}..., trying Jupiter fallback...`);
                marketData = await this.getJupiterMarketData(contractAddress);
            }
            
            // If Jupiter also fails, try Helius as final fallback
            if (!marketData || marketData.price_usd === 0) {
                logger.info(`🔄 Jupiter failed for ${contractAddress.slice(0,8)}..., trying Helius fallback...`);
                marketData = await this.getHeliusMarketData(contractAddress);
            }
            
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
                    logger.info(`💾 SAVED MARKET DATA for ${contractAddress}: MC: $${marketData.marketcap}, Vol: $${marketData.volume_24h}, Price: $${marketData.price_usd}`);
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
                logger.warn(`❌ No market data available for ${contractAddress.slice(0,8)}... from any source (Birdeye, Jupiter, Helius all failed)`);
            }
            
        } catch (error) {
            logger.error(`Error updating marketcap for ${contractAddress}:`, error);
        }
    }

    private async getBirdeyeMarketData(contractAddress: string, retryCount: number = 0): Promise<MarketData | null> {
        try {
            if (!this.birdeyeApiKey || this.birdeyeApiKey === 'your_birdeye_api_key_here') {
                logger.warn('Birdeye API key not configured properly - skipping Birdeye');
                return null;
            }
            
            logger.info(`🔍 FETCHING BIRDEYE DATA for ${contractAddress} (attempt ${retryCount + 1})`);
            
            // Use the CORRECT endpoint for COMPLETE market data (price, volume, marketcap, liquidity)
            logger.info(`🌐 MAKING BIRDEYE API CALL to: https://public-api.birdeye.so/defi/token_overview`);
            const response = await fetch(`https://public-api.birdeye.so/defi/token_overview?address=${contractAddress}`, {
                method: 'GET',
                headers: { 
                    'X-API-KEY': this.birdeyeApiKey,
                    'accept': 'application/json',
                    'x-chain': 'solana'
                }
            });
            
            logger.info(`📡 BIRDEYE API RESPONSE STATUS: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                if (response.status === 429 && retryCount < 3) {
                    // Rate limited - wait and retry
                    const waitTime = Math.pow(2, retryCount) * 2000; // Exponential backoff: 2s, 4s, 8s
                    logger.warn(`Birdeye rate limited for ${contractAddress}, retrying in ${waitTime}ms (attempt ${retryCount + 1}/3)`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    return this.getBirdeyeMarketData(contractAddress, retryCount + 1);
                }
                
                // No fallback needed - we're using the correct endpoint
                
                if (!response.ok) {
                logger.error(`❌ BIRDEYE API ERROR for ${contractAddress}: ${response.status} ${response.statusText}`);
                logger.error(`❌ Response body: ${await response.text()}`);
                return null;
                }
            }
            
            const data: any = await response.json();
            
            // DEBUG: Log the actual Birdeye response structure
            logger.info(`🔍 BIRDEYE RESPONSE STRUCTURE for ${contractAddress}:`, JSON.stringify(data, null, 2));
            
            if (!data.success || !data.data) {
                logger.debug(`No Birdeye data for ${contractAddress}: ${JSON.stringify(data)}`);
                return null;
            }
            
            const tokenData = data.data;
            
            if (!tokenData) {
                logger.warn(`❌ No data found for token ${contractAddress} in Birdeye response`);
                return null;
            }
            
            // Extract market data from the token_overview endpoint response
            const marketData: MarketData = {
                price_usd: tokenData.price || 0,
                marketcap: tokenData.marketCap || 0, // REAL MARKETCAP FROM API!
                volume_24h: tokenData.v24hUSD || 0, // 24h volume in USD
                liquidity: tokenData.liquidity || 0 // REAL LIQUIDITY FROM API!
            };
            
            // Debug: Log all available fields from Birdeye response
            logger.info(`🔍 BIRDEYE FIELDS for ${contractAddress}:`, Object.keys(tokenData));
            
            logger.info(`📊 EXTRACTED DATA: Price=${marketData.price_usd}, MC=${marketData.marketcap}, Vol=${marketData.volume_24h}, Liq=${marketData.liquidity}`);
            
            // Only return data if we have meaningful values
            if (marketData.price_usd > 0 || marketData.marketcap > 0 || marketData.volume_24h > 0) {
                logger.info(`✅ BIRDEYE SUCCESS for ${contractAddress}: Price: $${marketData.price_usd}, MC: $${marketData.marketcap}, Vol: $${marketData.volume_24h}`);
                return marketData;
            } else {
                logger.warn(`⚠️ BIRDEYE DATA INSUFFICIENT for ${contractAddress}: Price: $${marketData.price_usd}, MC: $${marketData.marketcap}, Vol: $${marketData.volume_24h}`);
                return null;
            }
            
        } catch (error: any) {
            if (error?.cause?.code === "ENOTFOUND") {
                logger.debug("Birdeye DNS unavailable, skipping this tick");
                return null;
            }
            logger.error(`Birdeye API failed for ${contractAddress}:`, error);
            return null;
        }
    }

    private async getJupiterMarketData(contractAddress: string): Promise<MarketData | null> {
        try {
            logger.info(`🔍 FETCHING JUPITER DATA for ${contractAddress}`);
            
            // Use Jupiter's price API as fallback with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            const response = await fetch(`https://price.jup.ag/v4/price?ids=${contractAddress}`, {
                method: 'GET',
                headers: { 
                    'accept': 'application/json',
                    'User-Agent': 'Solana-Token-Tracker/1.0'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                logger.debug(`Jupiter API failed for ${contractAddress}: ${response.status}`);
                return null;
            }
            
            const data: any = await response.json();
            
            if (!data.data || !data.data[contractAddress]) {
                logger.debug(`No Jupiter data for ${contractAddress}`);
                return null;
            }
            
            const tokenData = data.data[contractAddress];
            
            // Jupiter only provides price, we'll calculate marketcap with default supply
            const marketData: MarketData = {
                price_usd: tokenData.price || 0,
                marketcap: 0, // Will calculate below
                volume_24h: 0, // Jupiter doesn't provide volume
                liquidity: 0 // Jupiter doesn't provide liquidity
            };
            
            // Calculate marketcap with default supply (1 billion tokens)
            if (marketData.price_usd > 0) {
                const defaultSupply = 1000000000; // 1 billion tokens
                marketData.marketcap = marketData.price_usd * defaultSupply;
                logger.info(`📊 JUPITER SUCCESS for ${contractAddress}: Price: $${marketData.price_usd}, Estimated MC: $${marketData.marketcap}`);
            } else {
                logger.debug(`Jupiter returned zero price for ${contractAddress}`);
                return null;
            }
            
            return marketData;
            
        } catch (error: any) {
            if (error.name === 'AbortError') {
                logger.debug(`Jupiter API timeout for ${contractAddress}`);
            } else {
                logger.debug(`Jupiter API failed for ${contractAddress}:`, error.message);
            }
            return null;
        }
    }

    private async getHeliusMarketData(contractAddress: string): Promise<MarketData | null> {
        try {
            logger.info(`🔍 FETCHING HELIUS DATA for ${contractAddress}`);
            
            const heliusApiKey = process.env.HELIUS_API_KEY;
            if (!heliusApiKey) {
                logger.debug('Helius API key not configured');
                return null;
            }
            
            // Use Helius token price API as final fallback
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            const response = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${heliusApiKey}`, {
                method: 'POST',
                headers: { 
                    'accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mintAccounts: [contractAddress],
                    includeOffChain: false,
                    disableCache: false
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                logger.debug(`Helius API failed for ${contractAddress}: ${response.status}`);
                return null;
            }
            
            const data: any = await response.json();
            
            if (!data || !data[0] || !data[0].price) {
                logger.debug(`No Helius price data for ${contractAddress}`);
                return null;
            }
            
            const tokenData = data[0];
            
            // Helius provides price data
            const marketData: MarketData = {
                price_usd: tokenData.price || 0,
                marketcap: 0, // Will calculate below
                volume_24h: 0, // Helius doesn't provide volume in this endpoint
                liquidity: 0 // Helius doesn't provide liquidity in this endpoint
            };
            
            // Calculate marketcap with default supply (1 billion tokens)
            if (marketData.price_usd > 0) {
                const defaultSupply = 1000000000; // 1 billion tokens
                marketData.marketcap = marketData.price_usd * defaultSupply;
                logger.info(`📊 HELIUS SUCCESS for ${contractAddress}: Price: $${marketData.price_usd}, Estimated MC: $${marketData.marketcap}`);
            } else {
                logger.debug(`Helius returned zero price for ${contractAddress}`);
                return null;
            }
            
            return marketData;
            
        } catch (error: any) {
            if (error.name === 'AbortError') {
                logger.debug(`Helius API timeout for ${contractAddress}`);
            } else {
                logger.debug(`Helius API failed for ${contractAddress}:`, error.message);
            }
            return null;
        }
    }

    private async updateBatchMarketcap(tokens: any[]): Promise<void> {
        try {
            if (tokens.length === 0) return;
            
            logger.info(`🚀 BATCH UPDATE for ${tokens.length} tokens`);
            
            // Check cache first for instant results
            const cachedTokens: any[] = [];
            const uncachedTokens: any[] = [];
            
            for (const token of tokens) {
                const cached = this.marketDataCache.get(token.mint);
                if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
                    cachedTokens.push(token);
                    // Use cached data immediately
                    await this.saveMarketData(token.mint, token.id, cached.data);
                } else {
                    uncachedTokens.push(token);
                }
            }
            
            if (cachedTokens.length > 0) {
                logger.info(`⚡ CACHE HIT: ${cachedTokens.length} tokens served instantly`);
            }
            
            if (uncachedTokens.length === 0) {
                logger.info(`✅ All ${tokens.length} tokens served from cache`);
                return;
            }
            
            logger.info(`🔍 FETCHING FRESH DATA for ${uncachedTokens.length} tokens`);
            
            // Extract mint addresses for batch API call (only uncached tokens)
            const mintAddresses = uncachedTokens.map(token => token.mint);
            
            // Try batch Birdeye API call first
            let batchData = await this.getBirdeyeBatchData(mintAddresses);
            
            // If Birdeye batch fails, fall back to individual calls
            if (!batchData || Object.keys(batchData).length === 0) {
                logger.info(`🔄 Birdeye batch failed, falling back to individual calls`);
                for (const token of tokens) {
                    await this.updateTokenMarketcap(token.mint, token.id);
                }
                return;
            }
            
            // Process batch results and cache them
            for (const token of uncachedTokens) {
                const marketData = batchData[token.mint];
                if (marketData) {
                    // Cache the data for instant future access
                    this.marketDataCache.set(token.mint, {
                        data: marketData,
                        timestamp: Date.now()
                    });
                    await this.saveMarketData(token.mint, token.id, marketData);
                } else {
                    // Fallback to individual call for this token
                    await this.updateTokenMarketcap(token.mint, token.id);
                }
            }
            
            logger.info(`✅ BATCH UPDATE completed for ${tokens.length} tokens`);
            
        } catch (error) {
            logger.error(`❌ Batch update failed:`, error);
            // Fallback to individual calls
            for (const token of tokens) {
                try {
                    await this.updateTokenMarketcap(token.mint, token.id);
                } catch (individualError) {
                    logger.error(`❌ Individual update failed for ${token.mint}:`, individualError);
                }
            }
        }
    }

    private async getBirdeyeBatchData(mintAddresses: string[]): Promise<Record<string, MarketData> | null> {
        try {
            if (!this.birdeyeApiKey || this.birdeyeApiKey === 'your_birdeye_api_key_here') {
                logger.warn('Birdeye API key not configured properly - skipping batch call');
                return null;
            }
            
            logger.info(`🔍 BATCH FETCHING BIRDEYE DATA for ${mintAddresses.length} tokens`);
            
            // Use Birdeye's multi-token endpoint for batch requests
            const response = await fetch(`https://public-api.birdeye.so/defi/multi_price?list_address=${mintAddresses.join(',')}`, {
                method: 'GET',
                headers: { 
                    'X-API-KEY': this.birdeyeApiKey,
                    'accept': 'application/json',
                    'x-chain': 'solana'
                }
            });
            
            if (!response.ok) {
                logger.debug(`Birdeye batch API failed: ${response.status}`);
                return null;
            }
            
            const data: any = await response.json();
            
            if (!data.success || !data.data) {
                logger.debug(`No Birdeye batch data: ${JSON.stringify(data)}`);
                return null;
            }
            
            const batchResults: Record<string, MarketData> = {};
            
            // Process each token in the batch response
            for (const mintAddress of mintAddresses) {
                const tokenData = data.data[mintAddress];
                if (tokenData) {
                    batchResults[mintAddress] = {
                        price_usd: tokenData.price || 0,
                        marketcap: tokenData.marketCap || 0,
                        volume_24h: tokenData.v24hUSD || 0,
                        liquidity: tokenData.liquidity || 0
                    };
                }
            }
            
            logger.info(`📊 BATCH SUCCESS: Got data for ${Object.keys(batchResults).length}/${mintAddresses.length} tokens`);
            return batchResults;
            
        } catch (error: any) {
            logger.error(`Birdeye batch API failed:`, error);
            return null;
        }
    }

    private async saveMarketData(contractAddress: string, tokenId: number, marketData: MarketData): Promise<void> {
        try {
            // Get previous marketcap data for price change detection
            const previousMarketcap = await marketCapRepository.getLatestMarketCap(tokenId);
            
            // Save marketcap data
            await marketCapRepository.createMarketCap(
                tokenId,
                marketData.price_usd,
                marketData.marketcap,
                marketData.volume_24h,
                marketData.liquidity
            );
            
            logger.info(`💾 SAVED MARKET DATA for ${contractAddress}: MC: $${marketData.marketcap}, Vol: $${marketData.volume_24h}, Price: $${marketData.price_usd}`);
            
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
            
            // Broadcast marketcap update via WebSocket
            const updatedToken = await tokenRepository.findByMint(contractAddress);
            if (updatedToken) {
                this.wsService.broadcastTokenUpdate(updatedToken);
            }
            
        } catch (error: any) {
            logger.error(`❌ Failed to save market data for ${contractAddress}:`, error);
        }
    }

    private cleanupCache(): void {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [mint, cacheEntry] of this.marketDataCache.entries()) {
            if (now - cacheEntry.timestamp > this.CACHE_TTL_MS) {
                this.marketDataCache.delete(mint);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            logger.debug(`🧹 Cache cleanup: removed ${cleanedCount} expired entries`);
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
