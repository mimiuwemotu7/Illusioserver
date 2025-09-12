import { getOnchainMetadata } from "../lib/onchainMetadata";
import { resolveImageUrl } from "../lib/offchainMetadata";
import { TokenRepository } from "../db/repository";
import db from "../db/connection";
import { Connection } from "@solana/web3.js";
import { logger } from "../utils/logger";
import * as cron from "node-cron";

const clean = (s?: string | null) => (s && s.trim() ? s.trim() : undefined);

const isUnwantedToken = (name?: string, symbol?: string): boolean => {
  if (!name && !symbol) return false;
  
  const nameLower = (name || '').toLowerCase();
  const symbolLower = (symbol || '').toLowerCase();
  
  // Filter out unwanted patterns
  const unwantedPatterns = [
    // Jupiter patterns
    'jupiter vault',
    'jv', // jupiter vault tokens
    'jupiter',
    'jupiter lend',
    'jupiter borrow',
    
    // Sugar patterns
    'sugar',
    'sugarglider',
    
    // .sol domain patterns
    '.sol',
    
    // Orbit/Earth patterns
    'orbit',
    'earth',
    'earthorbit',
    'highearthorbit',
    'orbitpig',
    'pigorbit',
    
    // Raydium CPMM patterns
    'raydium cpmm',
    'cpmm',
    'creator pool',
    'creator',
    'pool',
    
    // Meteora DBC patterns
    'meteora',
    'meteora dbc',
    'dbc',
    'dynamic bonding curve',
    'meteora dynamic',
    
    // Associated Token Account patterns
    'associated token',
    'token account',
    'ata',
    'atoken',
    
    // Other unwanted patterns
    'vault',
    'test',
    'demo',
    'lend',
    'borrow'
  ];
  
  return unwantedPatterns.some(pattern => 
    nameLower.includes(pattern) || symbolLower.includes(pattern)
  );
};

export class MetadataEnricherService {
  private cronJob?: cron.ScheduledTask;
  private isRunning = false;

  constructor(
    private conn: Connection,
    private repo: TokenRepository
  ) {}

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.info("Metadata Enricher Service is already running");
      return;
    }

    logger.info("Starting Metadata Enricher Service...");
    
    // Start cron job to enrich tokens every 5 seconds for fast metadata updates
    this.cronJob = cron.schedule("*/5 * * * * *", async () => {
      try {
        await this.enrichTokens(30); // Optimized batch size for speed
        await this.enrichSocialLinks(15); // Optimized batch size for social links
      } catch (error) {
        logger.error("Error in metadata enrichment cron job:", error);
      }
    });

    this.isRunning = true;
    logger.info("✅ Metadata Enricher Service started successfully (ULTRA-FAST MODE)");
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.info("Metadata Enricher Service is not running");
      return;
    }

    logger.info("Stopping Metadata Enricher Service...");
    
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = undefined;
    }

    this.isRunning = false;
    logger.info("✅ Metadata Enricher Service stopped successfully");
  }

  // Pick ANY tokens missing basics (regardless of liquidity/bonding curve)
  async enrichTokens(limit = 200) {
    const mints: string[] = await this.repo.findMintsNeedingMetadata(limit);
    if (mints.length === 0) {
      logger.debug("No tokens need metadata enrichment");
      return;
    }
    
    logger.info(`🚀 ULTRA-FAST enriching metadata for ${mints.length} tokens`);
    
    // OPTIMIZED PROCESSING: Dynamic batch sizing for maximum efficiency with 10 DB connections
    const poolStats = db.getPoolStats();
    const maxConcurrentConnections = Math.max(6, Math.min(8, poolStats.idleCount)); // Dynamic sizing based on available connections
    const batchSize = Math.min(maxConcurrentConnections, mints.length);
    
    logger.debug(`📊 DB Pool: ${poolStats.totalCount} total, ${poolStats.idleCount} idle, ${poolStats.waitingCount} waiting | Batch size: ${batchSize}`);
    
    for (let i = 0; i < mints.length; i += batchSize) {
      const batch = mints.slice(i, i + batchSize);
      
      // Process batch in parallel for maximum speed
      const promises = batch.map(mint => this.enrichToken(mint));
      await Promise.allSettled(promises);
      
      // NO delay between batches for ULTRA FAST processing
      if (i + batchSize < mints.length) {
        await new Promise(resolve => setTimeout(resolve, 1)); // Minimal 1ms delay between batches for ULTRA FAST processing
      }
    }
  }

  // Extract social links for tokens that already have metadata but missing social links
  async enrichSocialLinks(limit = 50) {
    const mints: string[] = await this.repo.findMintsNeedingSocialLinks(limit);
    if (mints.length === 0) {
      logger.debug("No tokens need social links enrichment");
      return;
    }
    
    logger.info(`🚀 ULTRA-FAST enriching social links for ${mints.length} tokens`);
    
    // OPTIMIZED PROCESSING: Dynamic batch sizing for maximum efficiency with DB connections
    const poolStats = db.getPoolStats();
    const maxConcurrentConnections = Math.max(4, Math.min(6, poolStats.idleCount)); // Dynamic sizing based on available connections
    const batchSize = Math.min(maxConcurrentConnections, mints.length);
    
    logger.debug(`📊 DB Pool: ${poolStats.totalCount} total, ${poolStats.idleCount} idle, ${poolStats.waitingCount} waiting | Social batch size: ${batchSize}`);
    
    for (let i = 0; i < mints.length; i += batchSize) {
      const batch = mints.slice(i, i + batchSize);
      
      // Process batch in parallel for maximum speed
      const promises = batch.map(mint => this.enrichSocialLinksForToken(mint));
      await Promise.allSettled(promises);
      
      // Minimal delay between batches
      if (i + batchSize < mints.length) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Reduced to 50ms for faster processing
      }
    }
  }

  async enrichToken(mint: string) {
    const maxRetries = 3; // Increased back to 3 for better reliability
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`🚀 ULTRA-FAST enriching metadata for ${mint} (attempt ${attempt}/${maxRetries})`);

        // Try both on-chain and Helius in parallel for maximum speed
        const [onchain, helius] = await Promise.allSettled([
          getOnchainMetadata(this.conn, mint),
          this.tryHeliusFallback(mint)
        ]);

        const onchainResult = onchain.status === 'fulfilled' ? onchain.value : {};
        const heliusResult = helius.status === 'fulfilled' ? helius.value : {};

        // Use on-chain data first, fallback to Helius
        const metadata = {
          name: onchainResult.name || heliusResult.name,
          symbol: onchainResult.symbol || heliusResult.symbol,
          uri: onchainResult.uri || heliusResult.uri,
          image: onchainResult.image || heliusResult.image
        };

        if (metadata.name || metadata.symbol || metadata.uri) {
          const update: any = {};
          const nm = clean(metadata.name);
          const sy = clean(metadata.symbol);
          const ur = clean(metadata.uri);
          const im = clean(metadata.image);
          
          if (nm) update.name = nm;
          if (sy) update.symbol = sy;
          if (ur) update.metadata_uri = ur;
          if (im) update.image_url = im;

          if (Object.keys(update).length) {
            // Check if this is an unwanted token and skip processing
            if (isUnwantedToken(nm, sy)) {
              logger.info(`🚫 Unwanted token detected, skipping: ${nm || 'Unknown'} (${sy || 'Unknown'})`);
              return;
            }
            
            await this.repo.updateTokenMetadataByMint(mint, update);
            logger.info(`✅ ULTRA-FAST metadata enriched: ${nm || 'Unknown'} (${sy || 'Unknown'})`);
          }

          // Try to get additional data in parallel (non-blocking)
          if (ur) {
            Promise.allSettled([
              this.extractSocialLinks(ur).then(socialData => {
                if (socialData && Object.keys(socialData).length > 0) {
                  return this.repo.updateTokenMetadataByMint(mint, socialData);
                }
                return null;
              }),
              resolveImageUrl(ur).then(img => {
                if (img) {
                  return this.repo.updateTokenMetadataByMint(mint, { image_url: img });
                }
                return null;
              })
            ]).catch(() => {}); // Ignore errors for non-critical data
          }

          return;
        }

        logger.debug(`No metadata found for ${mint} via any method`);
        return;

      } catch (error: any) {
        if (attempt === maxRetries) {
          logger.error(`Failed to enrich token ${mint} after ${maxRetries} attempts:`, error);
        } else {
          // Check if it's a database timeout error
          const isDbTimeout = error.message?.includes('timeout exceeded when trying to connect') || 
                             error.message?.includes('connection timeout');
          
          if (isDbTimeout) {
            logger.warn(`⚠️ Database timeout for ${mint} (attempt ${attempt}/${maxRetries}), waiting longer before retry...`);
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000)); // Longer delay for DB timeouts
          } else {
            logger.warn(`⚠️ Metadata enrichment failed for ${mint} (attempt ${attempt}/${maxRetries}), retrying...`);
            await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 500)); // Normal retry delay
          }
        }
      }
    }
  }

  // IMMEDIATE metadata enrichment for fresh mints - called when new tokens are detected
  async enrichTokenImmediately(mint: string): Promise<void> {
    try {
      logger.info(`🔥 IMMEDIATE metadata enrichment for fresh mint: ${mint}`);
      
      // Use the same optimized enrichment logic but with immediate processing
      await this.enrichToken(mint);
      
      logger.info(`✅ IMMEDIATE metadata enrichment completed for: ${mint}`);
    } catch (error) {
      logger.error(`Failed immediate metadata enrichment for ${mint}:`, error);
    }
  }

  // Extract social links for a specific token
  async enrichSocialLinksForToken(mint: string) {
    try {
      // Get the token's metadata URI
      const token = await this.repo.getTokenByMint(mint);
      if (!token || !token.metadata_uri) {
        return;
      }

      // Extract social links from metadata
      const socialData = await this.extractSocialLinks(token.metadata_uri);
      if (socialData && Object.keys(socialData).length > 0) {
        await this.repo.updateTokenMetadataByMint(mint, socialData);
        logger.info(`🔗 Social links updated for ${mint}:`, socialData);
      }
    } catch (error) {
      logger.debug(`Failed to enrich social links for ${mint}:`, error);
    }
  }

  // Extract social links and source platform from metadata JSON - OPTIMIZED FOR SPEED
  private async extractSocialLinks(metadataUri: string): Promise<{ website?: string; twitter?: string; telegram?: string; source?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout to 10s
      
      const response = await fetch(metadataUri, {
        headers: {
          'User-Agent': 'TokenTracker/2.0',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return {};
      }
      
      const metadata = await response.json() as any;
      const result: { website?: string; twitter?: string; telegram?: string; source?: string } = {};
      
      // Extract social links
      if (metadata.website) result.website = clean(metadata.website);
      if (metadata.twitter) result.twitter = clean(metadata.twitter);
      if (metadata.telegram) result.telegram = clean(metadata.telegram);
      
      // Determine source platform
      if (metadata.createdOn) {
        const createdOn = metadata.createdOn.toLowerCase();
        if (createdOn.includes('pump.fun')) {
          result.source = 'pump.fun';
        } else if (createdOn.includes('bonk.fun')) {
          result.source = 'bonk.fun';
        }
      }
      
      return result;
    } catch (error) {
      logger.debug(`Failed to extract social links from ${metadataUri}:`, error);
      return {};
    }
  }
  
  // Helius fallback for tokens with invalid on-chain metadata - OPTIMIZED FOR SPEED
  private async tryHeliusFallback(mint: string): Promise<{ name?: string; symbol?: string; uri?: string; image?: string }> {
    // Try multiple sources for the API key
    let apiKey = process.env.HELIUS_API_KEY || process.env.HELIUS_KEY || "";
    
    // If no direct API key, try to extract from RPC URL
    if (!apiKey && process.env.HELIUS_RPC_URL) {
      const urlMatch = process.env.HELIUS_RPC_URL.match(/api-key=([^&]+)/);
      if (urlMatch) {
        apiKey = urlMatch[1];
        logger.debug("Extracted Helius API key from RPC URL");
      }
    }
    
    if (!apiKey) {
      logger.warn("HELIUS_API_KEY not set; skipping fallback");
      return {};
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout to 10s
      
      const resp = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "User-Agent": "TokenTracker/2.0"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "get-asset",
          method: "getAsset",
          params: { id: mint }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!resp.ok) return {};
      const { result } = await resp.json() as any;

      const name = result?.content?.metadata?.name ?? result?.content?.metadata?.token_standard?.name;
      const symbol = result?.content?.metadata?.symbol ?? result?.content?.metadata?.token_standard?.symbol;
      const jsonUri = result?.content?.json_uri;
      const image = result?.content?.links?.image;

      return { name, symbol, uri: jsonUri, image };
    } catch (e) {
      return {};
    }
  }

}