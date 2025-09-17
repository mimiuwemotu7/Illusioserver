import { logger } from '../utils/logger';
import { marketCapRepository } from '../db/repository';

interface MarketData {
    price_usd: number;
    marketcap: number;
    volume_24h: number;
    liquidity: number;
}

export class MarketDataService {
    private birdeyeApiKey: string;
    private heliusApiKey: string;
    private requestCache: Map<string, { data: MarketData; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 30000; // 30 seconds cache

    constructor(birdeyeApiKey: string, heliusApiKey: string) {
        this.birdeyeApiKey = birdeyeApiKey;
        this.heliusApiKey = heliusApiKey;
    }

    /**
     * Fetch market data immediately for a new mint - OPTIMIZED FOR SPEED
     * This is the core function that will be called from mintWatcher
     */
    async fetchMarketDataImmediately(mint: string, tokenId: number): Promise<boolean> {
        try {
            console.log(`🚀 ULTRA-FAST MARKET DATA FETCH for ${mint.slice(0, 8)}...`);
            logger.info(`🚀 ULTRA-FAST MARKET DATA FETCH for ${mint.slice(0, 8)}...`);

            // Check cache first
            const cached = this.getCachedData(mint);
            if (cached) {
                console.log(`⚡ CACHE HIT for ${mint.slice(0, 8)}... - using cached data`);
                await this.saveMarketData(mint, tokenId, cached);
                return true;
            }

            // Try all APIs in parallel for maximum speed
            const promises = [];
            
            if (this.birdeyeApiKey && this.birdeyeApiKey !== 'your_birdeye_api_key_here') {
                promises.push(this.getBirdeyeMarketDataFast(mint));
            }
            
            promises.push(this.getJupiterMarketDataFast(mint));
            promises.push(this.getHeliusMarketDataFast(mint));

            // Race all APIs - first one to succeed wins
            const results = await Promise.allSettled(promises);
            
            let marketData: MarketData | null = null;
            let successSource = '';

            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                if (result.status === 'fulfilled' && result.value && result.value.price_usd > 0) {
                    marketData = result.value;
                    successSource = i === 0 ? 'Birdeye' : i === 1 ? 'Jupiter' : 'Helius';
                    break;
                }
            }

            if (marketData) {
                // Cache the result
                this.setCachedData(mint, marketData);
                
                // Save to database
                await this.saveMarketData(mint, tokenId, marketData);
                console.log(`⚡ ${successSource} SUCCESS: Price: $${marketData.price_usd}, MC: $${marketData.marketcap}`);
                logger.info(`⚡ ${successSource} SUCCESS: Price: $${marketData.price_usd}, MC: $${marketData.marketcap}`);
                return true;
            }

            console.log(`❌ All APIs failed for ${mint.slice(0, 8)}...`);
            return false;

        } catch (error) {
            console.error(`❌ Error fetching market data for ${mint}:`, error);
            logger.error(`❌ Error fetching market data for ${mint}:`, error);
            return false;
        }
    }

    // Cache methods for ultra-fast responses
    private getCachedData(mint: string): MarketData | null {
        const cached = this.requestCache.get(mint);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }
        return null;
    }

    private setCachedData(mint: string, data: MarketData): void {
        this.requestCache.set(mint, {
            data,
            timestamp: Date.now()
        });
    }

    // ULTRA-FAST Birdeye API call with minimal timeout
    private async getBirdeyeMarketDataFast(mint: string): Promise<MarketData | null> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
            
            const response = await fetch(`https://public-api.birdeye.so/defi/token_overview?address=${mint}`, {
                method: 'GET',
                headers: { 
                    'X-API-KEY': this.birdeyeApiKey,
                    'accept': 'application/json',
                    'x-chain': 'solana'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                return null;
            }
            
            const data: any = await response.json();
            
            if (!data.success || !data.data) {
                return null;
            }
            
            const tokenData = data.data;
            const marketData: MarketData = {
                price_usd: tokenData.price || 0,
                marketcap: tokenData.marketCap || 0,
                volume_24h: tokenData.v24hUSD || 0,
                liquidity: tokenData.liquidity || 0
            };
            
            return marketData.price_usd > 0 ? marketData : null;
            
        } catch (error) {
            return null;
        }
    }

    // ULTRA-FAST Jupiter API call with minimal timeout
    private async getJupiterMarketDataFast(mint: string): Promise<MarketData | null> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5 second timeout
            
            const response = await fetch(`https://price.jup.ag/v4/price?ids=${mint}`, {
                method: 'GET',
                headers: { 
                    'accept': 'application/json',
                    'User-Agent': 'Solana-Token-Tracker/1.0'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                return null;
            }
            
            const data: any = await response.json();
            
            if (!data.data || !data.data[mint]) {
                return null;
            }
            
            const tokenData = data.data[mint];
            const price = tokenData.price || 0;
            const defaultSupply = 1000000000;
            
            const marketData: MarketData = {
                price_usd: price,
                marketcap: price * defaultSupply,
                volume_24h: 0,
                liquidity: 0
            };
            
            return marketData.price_usd > 0 ? marketData : null;
            
        } catch (error) {
            return null;
        }
    }

    // ULTRA-FAST Helius API call with minimal timeout
    private async getHeliusMarketDataFast(mint: string): Promise<MarketData | null> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5 second timeout
            
            const response = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${this.heliusApiKey}`, {
                method: 'POST',
                headers: { 
                    'accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mintAccounts: [mint],
                    includeOffChain: false,
                    disableCache: false
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                return null;
            }
            
            const data: any = await response.json();
            
            if (!data || !data[0] || !data[0].price) {
                return null;
            }
            
            const tokenData = data[0];
            const price = tokenData.price || 0;
            const defaultSupply = 1000000000;
            
            const marketData: MarketData = {
                price_usd: price,
                marketcap: price * defaultSupply,
                volume_24h: 0,
                liquidity: 0
            };
            
            return marketData.price_usd > 0 ? marketData : null;
            
        } catch (error) {
            return null;
        }
    }


    private async saveMarketData(mint: string, tokenId: number, marketData: MarketData): Promise<void> {
        try {
            await marketCapRepository.createMarketCap(
                tokenId,
                marketData.price_usd,
                marketData.marketcap,
                marketData.volume_24h,
                marketData.liquidity
            );
        } catch (error) {
            console.error(`❌ Failed to save market data for ${mint}:`, error);
            throw error;
        }
    }
}
