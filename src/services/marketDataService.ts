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

    constructor(birdeyeApiKey: string, heliusApiKey: string) {
        this.birdeyeApiKey = birdeyeApiKey;
        this.heliusApiKey = heliusApiKey;
    }

    /**
     * Fetch market data immediately for a new mint
     * This is the core function that will be called from mintWatcher
     */
    async fetchMarketDataImmediately(mint: string, tokenId: number): Promise<boolean> {
        try {
            console.log(`🚀 IMMEDIATE MARKET DATA FETCH for ${mint.slice(0, 8)}...`);
            logger.info(`🚀 IMMEDIATE MARKET DATA FETCH for ${mint.slice(0, 8)}...`);

            let marketData: MarketData | null = null;

            // Try Birdeye first (most comprehensive)
            if (this.birdeyeApiKey && this.birdeyeApiKey !== 'your_birdeye_api_key_here') {
                console.log(`🔍 Trying Birdeye API for ${mint.slice(0, 8)}...`);
                marketData = await this.getBirdeyeMarketData(mint);
                
                if (marketData && marketData.price_usd > 0) {
                    console.log(`✅ Birdeye SUCCESS: Price: $${marketData.price_usd}, MC: $${marketData.marketcap}`);
                    logger.info(`✅ Birdeye SUCCESS: Price: $${marketData.price_usd}, MC: $${marketData.marketcap}`);
                } else {
                    console.log(`❌ Birdeye failed for ${mint.slice(0, 8)}...`);
                    marketData = null;
                }
            }

            // Fallback to Jupiter if Birdeye fails
            if (!marketData || marketData.price_usd === 0) {
                console.log(`🔄 Trying Jupiter fallback for ${mint.slice(0, 8)}...`);
                marketData = await this.getJupiterMarketData(mint);
                
                if (marketData && marketData.price_usd > 0) {
                    console.log(`✅ Jupiter SUCCESS: Price: $${marketData.price_usd}, MC: $${marketData.marketcap}`);
                    logger.info(`✅ Jupiter SUCCESS: Price: $${marketData.price_usd}, MC: $${marketData.marketcap}`);
                } else {
                    console.log(`❌ Jupiter failed for ${mint.slice(0, 8)}...`);
                    marketData = null;
                }
            }

            // Final fallback to Helius
            if (!marketData || marketData.price_usd === 0) {
                console.log(`🔄 Trying Helius fallback for ${mint.slice(0, 8)}...`);
                marketData = await this.getHeliusMarketData(mint);
                
                if (marketData && marketData.price_usd > 0) {
                    console.log(`✅ Helius SUCCESS: Price: $${marketData.price_usd}, MC: $${marketData.marketcap}`);
                    logger.info(`✅ Helius SUCCESS: Price: $${marketData.price_usd}, MC: $${marketData.marketcap}`);
                } else {
                    console.log(`❌ All APIs failed for ${mint.slice(0, 8)}...`);
                    return false;
                }
            }

            // Save market data to database
            if (marketData) {
                await this.saveMarketData(mint, tokenId, marketData);
                console.log(`💾 SAVED MARKET DATA for ${mint}: MC: $${marketData.marketcap}, Vol: $${marketData.volume_24h}`);
                logger.info(`💾 SAVED MARKET DATA for ${mint}: MC: $${marketData.marketcap}, Vol: $${marketData.volume_24h}`);
                return true;
            }

            return false;

        } catch (error) {
            console.error(`❌ Error fetching market data for ${mint}:`, error);
            logger.error(`❌ Error fetching market data for ${mint}:`, error);
            return false;
        }
    }

    private async getBirdeyeMarketData(mint: string): Promise<MarketData | null> {
        try {
            console.log(`🌐 BIRDEYE API CALL: https://public-api.birdeye.so/defi/token_overview?address=${mint}`);
            
            const response = await fetch(`https://public-api.birdeye.so/defi/token_overview?address=${mint}`, {
                method: 'GET',
                headers: { 
                    'X-API-KEY': this.birdeyeApiKey,
                    'accept': 'application/json',
                    'x-chain': 'solana'
                }
            });
            
            console.log(`📡 BIRDEYE RESPONSE: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                console.log(`❌ Birdeye API error: ${response.status} ${response.statusText}`);
                return null;
            }
            
            const data: any = await response.json();
            console.log(`🔍 BIRDEYE DATA:`, JSON.stringify(data, null, 2));
            
            if (!data.success || !data.data) {
                console.log(`❌ No Birdeye data for ${mint}`);
                return null;
            }
            
            const tokenData = data.data;
            const marketData: MarketData = {
                price_usd: tokenData.price || 0,
                marketcap: tokenData.marketCap || 0,
                volume_24h: tokenData.v24hUSD || 0,
                liquidity: tokenData.liquidity || 0
            };
            
            console.log(`📊 BIRDEYE EXTRACTED: Price=${marketData.price_usd}, MC=${marketData.marketcap}, Vol=${marketData.volume_24h}, Liq=${marketData.liquidity}`);
            
            return marketData;
            
        } catch (error) {
            console.error(`❌ Birdeye API error for ${mint}:`, error);
            return null;
        }
    }

    private async getJupiterMarketData(mint: string): Promise<MarketData | null> {
        try {
            console.log(`🌐 JUPITER API CALL: https://price.jup.ag/v4/price?ids=${mint}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
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
                console.log(`❌ Jupiter API error: ${response.status}`);
                return null;
            }
            
            const data: any = await response.json();
            
            if (!data.data || !data.data[mint]) {
                console.log(`❌ No Jupiter data for ${mint}`);
                return null;
            }
            
            const tokenData = data.data[mint];
            const price = tokenData.price || 0;
            
            // Calculate marketcap with default supply (1 billion tokens)
            const defaultSupply = 1000000000;
            const marketData: MarketData = {
                price_usd: price,
                marketcap: price * defaultSupply,
                volume_24h: 0, // Jupiter doesn't provide volume
                liquidity: 0   // Jupiter doesn't provide liquidity
            };
            
            console.log(`📊 JUPITER EXTRACTED: Price=${marketData.price_usd}, MC=${marketData.marketcap}`);
            
            return marketData;
            
        } catch (error) {
            console.error(`❌ Jupiter API error for ${mint}:`, error);
            return null;
        }
    }

    private async getHeliusMarketData(mint: string): Promise<MarketData | null> {
        try {
            console.log(`🌐 HELIUS API CALL: https://api.helius.xyz/v0/token-metadata`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
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
                console.log(`❌ Helius API error: ${response.status}`);
                return null;
            }
            
            const data: any = await response.json();
            
            if (!data || !data[0] || !data[0].price) {
                console.log(`❌ No Helius data for ${mint}`);
                return null;
            }
            
            const tokenData = data[0];
            const price = tokenData.price || 0;
            
            // Calculate marketcap with default supply (1 billion tokens)
            const defaultSupply = 1000000000;
            const marketData: MarketData = {
                price_usd: price,
                marketcap: price * defaultSupply,
                volume_24h: 0, // Helius doesn't provide volume in this endpoint
                liquidity: 0   // Helius doesn't provide liquidity in this endpoint
            };
            
            console.log(`📊 HELIUS EXTRACTED: Price=${marketData.price_usd}, MC=${marketData.marketcap}`);
            
            return marketData;
            
        } catch (error) {
            console.error(`❌ Helius API error for ${mint}:`, error);
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
