import { Router, Request, Response } from 'express';
import { tokenRepository } from '../db/repository';
import { logger } from '../utils/logger';
import { MarketDataService } from '../services/marketDataService';

const router = Router();

// Initialize market data service for on-demand fetching
const marketDataService = new MarketDataService(
    process.env.BIRDEYE_API_KEY || '',
    process.env.HELIUS_API_KEY || ''
);

// GET /tokens/fresh - Get latest fresh and curve tokens, ordered by blocktime DESC
router.get('/fresh', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;
        
        if (limit < 1 || limit > 1000) {
            return res.status(400).json({
                error: 'Invalid limit. Must be between 1 and 1000.'
            });
        }

        // Get ONLY fresh tokens - don't mix with curve tokens
        const freshTokens = await tokenRepository.findFreshTokens(limit, offset);
        const total = await tokenRepository.countFreshTokens();
        
        // ON-DEMAND MARKET DATA FETCHING
        console.log(`🚀 ON-DEMAND: Checking ${freshTokens.length} tokens for market data`);
        logger.info(`🚀 ON-DEMAND: Checking ${freshTokens.length} tokens for market data`);
        
        // Check which tokens need market data and fetch it immediately
        const tokensWithMarketData = await Promise.all(
            freshTokens.map(async (token: any) => {
                // Check if token already has market data
                if (token.marketcap && token.marketcap > 0) {
                    console.log(`✅ Token ${token.mint.slice(0, 8)}... already has market data: $${token.marketcap}`);
                    return token;
                }
                
                // Fetch market data immediately for tokens without it
                console.log(`🔍 ON-DEMAND: Fetching market data for ${token.mint.slice(0, 8)}...`);
                try {
                    const success = await marketDataService.fetchMarketDataImmediately(token.mint, token.id);
                    if (success) {
                        console.log(`✅ ON-DEMAND SUCCESS: Market data fetched for ${token.mint.slice(0, 8)}...`);
                        // Refetch the token with updated market data
                        const updatedToken = await tokenRepository.findByMint(token.mint);
                        return updatedToken || token;
                    } else {
                        console.log(`❌ ON-DEMAND FAILED: No market data for ${token.mint.slice(0, 8)}...`);
                        return token;
                    }
                } catch (error) {
                    console.error(`❌ ON-DEMAND ERROR for ${token.mint.slice(0, 8)}...:`, error);
                    return token;
                }
            })
        );
        
        console.log(`✅ ON-DEMAND COMPLETE: Processed ${tokensWithMarketData.length} tokens`);
        logger.info(`✅ ON-DEMAND COMPLETE: Processed ${tokensWithMarketData.length} tokens`);
        
        return res.json({
            total,
            items: tokensWithMarketData
        });
        
    } catch (error) {
        logger.error('Error fetching fresh tokens:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /tokens/active - Get latest active tokens, ordered by marketcap DESC
router.get('/active', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;
        
        if (limit < 1 || limit > 1000) {
            return res.status(400).json({
                error: 'Invalid limit. Must be between 1 and 1000.'
            });
        }

        const [tokens, total] = await Promise.all([
            tokenRepository.findActiveTokens(limit, offset),
            tokenRepository.countActiveTokens()
        ]);
        
        return res.json({
            total,
            items: tokens
        });
        
    } catch (error) {
        logger.error('Error fetching active tokens:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /tokens - Get all tokens (for debugging/admin purposes)
router.get('/', async (_req: Request, res: Response) => {
    try {
        const tokens = await tokenRepository.getAllTokens();
        
        return res.json({
            total: tokens.length,
            items: tokens
        });
        
    } catch (error) {
        logger.error('Error fetching all tokens:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /tokens/candy-machine - Clean up candy machine tokens
router.delete('/candy-machine', async (_req: Request, res: Response) => {
    try {
        const deletedCount = await tokenRepository.deleteCandyMachineTokens();
        
        logger.info(`Cleaned up ${deletedCount} candy machine tokens`);
        
        return res.json({
            message: `Successfully deleted ${deletedCount} candy machine tokens`,
            deletedCount
        });
        
    } catch (error) {
        logger.error('Error cleaning up candy machine tokens:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /tokens/search - Search tokens by name, symbol, or mint address
router.get('/search', async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string;
        const limit = parseInt(req.query.limit as string) || 50;
        
        if (!query || query.trim().length < 2) {
            return res.status(400).json({
                error: 'Search query must be at least 2 characters long.'
            });
        }
        
        if (limit < 1 || limit > 100) {
            return res.status(400).json({
                error: 'Invalid limit. Must be between 1 and 100.'
            });
        }
        
        const trimmedQuery = query.trim();
        
        // Check if this looks like a specific token address (exact match)
        const isLikelyAddress = /^[A-Za-z0-9]{32,44}$/.test(trimmedQuery);
        
        // First, try exact match search in local database
        let localTokens = await tokenRepository.searchTokens(trimmedQuery, limit);
        logger.info(`Initial search for "${trimmedQuery}" returned ${localTokens.length} results`);
        
        // If no results and it looks like an address, try exact mint search
        if (localTokens.length === 0 && isLikelyAddress) {
            logger.info(`No initial results for address "${trimmedQuery}", trying exact mint search...`);
            try {
                const exactToken = await tokenRepository.findTokenByMint(trimmedQuery);
                if (exactToken) {
                    localTokens = [exactToken];
                    logger.info(`Found exact token match for "${trimmedQuery}"`);
                } else {
                    logger.info(`No exact token found for "${trimmedQuery}"`);
                }
            } catch (error) {
                logger.error('Error searching for exact token:', error);
            }
        }
        
        // If we found tokens in local database, prioritize exact matches if it looks like an address
        let filteredTokens = localTokens;
        if (isLikelyAddress) {
            // For address-like queries, prioritize exact matches
            const exactMatches = localTokens.filter(token => 
                token.mint.toLowerCase() === trimmedQuery.toLowerCase()
            );
            
            if (exactMatches.length > 0) {
                // Return exact matches first
                filteredTokens = exactMatches;
            }
            // If no exact matches, return all results (don't filter out partial matches)
        }
        
        // If we found exact matches or it's not an address query, return them
        if (filteredTokens.length > 0) {
            logger.info(`Token search completed. Query: "${trimmedQuery}", Results: ${filteredTokens.length} (${isLikelyAddress ? 'address' : 'name/symbol'} search)`);
            return res.json({
                query: trimmedQuery,
                total: filteredTokens.length,
                items: filteredTokens
            });
        }
        
        // If no local results, try to find the token on-chain
        logger.info(`No local results for "${trimmedQuery}", checking if it's a valid Solana token...`);
        
        try {
            // Check if this is a valid token mint on Solana
            let heliusApiKey = process.env.HELIUS_API_KEY;
            const heliusRpcUrl = process.env.HELIUS_RPC_URL;
            
            // If no direct API key, try to extract from RPC URL
            if (!heliusApiKey && heliusRpcUrl) {
                const urlMatch = heliusRpcUrl.match(/api-key=([^&]+)/);
                if (urlMatch) {
                    heliusApiKey = urlMatch[1];
                }
            }
            
            if (heliusApiKey && heliusRpcUrl) {
                // Use getAsset to validate token and get metadata in one call
                const response = await fetch(heliusRpcUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 'get-asset',
                        method: 'getAsset',
                        params: { id: trimmedQuery }
                    })
                });
                    
                    if (response.ok) {
                        const data: any = await response.json();
                        const result = data.result;
                        
                        if (result && (result.content?.metadata?.name || result.content?.metadata?.token_standard?.name)) {
                            // Token exists and has metadata
                            const name = result.content?.metadata?.name ?? result.content?.metadata?.token_standard?.name;
                            const symbol = result.content?.metadata?.symbol ?? result.content?.metadata?.token_standard?.symbol;
                            const jsonUri = result.content?.json_uri;
                            const image = result.content?.links?.image;
                            
                            try {
                                // Add token to database with rich metadata
                                const newToken = await tokenRepository.createToken(
                                    trimmedQuery,
                                    9, // Default decimals
                                    0, // Default supply
                                    new Date(),
                                    name || 'Unknown Token',
                                    symbol || 'UNKNOWN',
                                    jsonUri, // metadataUri
                                    image, // imageUrl
                                    undefined, // bondingCurveAddress
                                    false,     // isOnCurve
                                    'active'   // status
                                );
                                
                                logger.info(`Added Solana token to database: ${newToken.name} (${newToken.symbol})`);
                                
                                // Return the token from database
                                return res.json({
                                    query: trimmedQuery,
                                    total: 1,
                                    items: [newToken]
                                });
                                
                            } catch (dbError) {
                                logger.error('Error adding token to database:', dbError);
                                
                                // Fallback to token object with rich metadata
                                const token = {
                                    id: 0, // Temporary ID
                                    name: name || 'Unknown Token',
                                    symbol: symbol || 'UNKNOWN',
                                    mint: trimmedQuery,
                                    creator: null,
                                    source: 'solana-rpc',
                                    blocktime: null,
                                    decimals: 9,
                                    supply: '0',
                                    status: 'active' as const,
                                    created_at: new Date(),
                                    updated_at: new Date(),
                                    display_name: name || symbol || 'Unknown Token',
                                    price_usd: null,
                                    marketcap: null,
                                    volume_24h: null,
                                    liquidity: null,
                                    image_url: image,
                                    metadata_uri: jsonUri
                                };
                                
                                logger.info(`Found valid Solana token: ${token.name} (${token.symbol})`);
                                
                                return res.json({
                                    query: trimmedQuery,
                                    total: 1,
                                    items: [token]
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                logger.error('Error checking Solana token:', error);
            }
        
        // Only do broader search if the query looks like a partial name/symbol (not a specific address)
        const isLikelyPartialSearch = trimmedQuery.length >= 4 && !isLikelyAddress && /^[A-Za-z]/.test(trimmedQuery);
        
        if (isLikelyPartialSearch) {
            logger.info(`No exact results for "${trimmedQuery}", trying broader search...`);
            
            // Try searching with partial matches only for name/symbol searches
            // Use a longer substring to avoid too broad results
            const minLength = Math.max(4, Math.floor(trimmedQuery.length * 0.7));
            const broaderResults = await tokenRepository.searchTokens(trimmedQuery.substring(0, minLength), limit);
            
            if (broaderResults.length > 0) {
                logger.info(`Found ${broaderResults.length} broader results for "${trimmedQuery}"`);
                return res.json({
                    query: trimmedQuery,
                    total: broaderResults.length,
                    items: broaderResults
                });
            }
        }
        
        logger.info(`Token search completed. Query: "${trimmedQuery}", Results: 0`);
        
        return res.json({
            query: trimmedQuery,
            total: 0,
            items: []
        });
        
    } catch (error) {
        logger.error('Error searching tokens:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /tokens/:mint/holders - Top holders of a mint
router.get('/:mint/holders', async (req: Request, res: Response) => {
    try {
        const { mint } = req.params;
        const limit = Number(req.query.limit ?? 50);
        const rows = await tokenRepository.getTopHolders(mint, limit);
        res.json({ mint, holders: rows });
    } catch (e) {
        logger.error('Error fetching holders:', e);
        res.status(500).json({ error: "failed to load holders" });
    }
});

// GET /wallet/:owner/positions - Wallet positions
router.get('/wallet/:owner/positions', async (req: Request, res: Response) => {
    try {
        const { owner } = req.params;
        const min = Number(req.query.min ?? 0);
        const rows = await tokenRepository.getWalletPositions(owner, min);
        res.json({ owner, positions: rows });
    } catch (e) {
        logger.error('Error fetching wallet positions:', e);
        res.status(500).json({ error: "failed to load positions" });
    }
});

export default router;
