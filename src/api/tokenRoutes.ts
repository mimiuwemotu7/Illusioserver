import { Router, Request, Response } from 'express';
import { tokenRepository } from '../db/repository';
import { logger } from '../utils/logger';

const router = Router();

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

        // Get both fresh and curve tokens
        const [freshTokens, curveTokens] = await Promise.all([
            tokenRepository.findFreshTokens(limit, offset),
            tokenRepository.findTokensByStatus('curve', limit, offset)
        ]);
        
        // Combine and sort by blocktime
        const allTokens = [...freshTokens, ...curveTokens]
            .sort((a, b) => {
                const aTime = a.blocktime || a.created_at;
                const bTime = b.blocktime || b.created_at;
                return new Date(bTime).getTime() - new Date(aTime).getTime();
            })
            .slice(0, limit);
        
        const total = freshTokens.length + curveTokens.length;
        
        logger.info(`Fresh/curve tokens fetched successfully. Count: ${total}`);
        
        return res.json({
            total,
            items: allTokens
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
        
        // First, search in local database
        const localTokens = await tokenRepository.searchTokens(trimmedQuery, limit);
        
        // If we found tokens in local database, return them
        if (localTokens.length > 0) {
            logger.info(`Token search completed. Query: "${trimmedQuery}", Results: ${localTokens.length}`);
            return res.json({
                query: trimmedQuery,
                total: localTokens.length,
                items: localTokens
            });
        }
        
        // If no local results, try to find the token on-chain
        logger.info(`No local results for "${trimmedQuery}", checking if it's a valid Solana token...`);
        
        try {
            // Check if this is a valid token mint on Solana
            const heliusApiKey = process.env.HELIUS_API_KEY;
            const heliusRpcUrl = process.env.HELIUS_RPC_URL;
            
            if (heliusApiKey && heliusRpcUrl) {
                // Get token account info to verify it's a valid token
                const response = await fetch(heliusRpcUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getAccountInfo',
                        params: [
                            trimmedQuery,
                            {
                                encoding: 'jsonParsed'
                            }
                        ]
                    })
                });
                    
                    if (response.ok) {
                        const data: any = await response.json();
                        const accountInfo = data.result?.value;
                        
                        if (accountInfo && accountInfo.data) {
                            // Check if it's an SPL token mint
                            if (accountInfo.data.program === 'spl-token') {
                                const tokenData = accountInfo.data.parsed?.info;
                                
                                if (tokenData) {
                                    try {
                                        // Add token to database so it can be enriched
                                        const newToken = await tokenRepository.createToken(
                                            trimmedQuery,
                                            tokenData.decimals || 9,
                                            tokenData.supply || '0',
                                            new Date(),
                                            tokenData.name || 'Unknown Token',
                                            tokenData.symbol || 'UNKNOWN',
                                            undefined, // metadataUri - will be enriched
                                            undefined, // imageUrl - will be enriched
                                            undefined, // bondingCurveAddress
                                            false,     // isOnCurve
                                            'active'   // status
                                        );
                                        
                                        logger.info(`Added Solana token to database: ${newToken.name} (${newToken.symbol})`);
                                        
                                        // Return the token from database (it will be enriched by background processes)
                                        return res.json({
                                            query: trimmedQuery,
                                            total: 1,
                                            items: [newToken]
                                        });
                                        
                                    } catch (dbError) {
                                        logger.error('Error adding token to database:', dbError);
                                        
                                        // Fallback to basic token object
                                        const token = {
                                            id: 0, // Temporary ID
                                            name: tokenData.name || 'Unknown Token',
                                            symbol: tokenData.symbol || 'UNKNOWN',
                                            mint: trimmedQuery,
                                            creator: tokenData.mintAuthority || null,
                                            source: 'solana-rpc',
                                            blocktime: null,
                                            decimals: tokenData.decimals || 9,
                                            supply: tokenData.supply || '0',
                                            status: 'active' as const,
                                            created_at: new Date(),
                                            updated_at: new Date(),
                                            display_name: tokenData.name || tokenData.symbol || 'Unknown Token',
                                            price_usd: null,
                                            marketcap: null,
                                            volume_24h: null,
                                            liquidity: null,
                                            image_url: null,
                                            metadata_uri: null
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
                            
                            // If it's not an SPL token but looks like a valid Solana address, 
                            // create a basic token object anyway (might be a custom token or wrapped token)
                            if (accountInfo.data.program === 'system' || accountInfo.data.program === 'native') {
                                const token = {
                                    id: 0, // Temporary ID
                                    name: 'Unknown Token',
                                    symbol: 'UNKNOWN',
                                    mint: trimmedQuery,
                                    creator: null,
                                    source: 'solana-rpc',
                                    blocktime: null,
                                    decimals: 9,
                                    supply: '0',
                                    status: 'active' as const,
                                    created_at: new Date(),
                                    updated_at: new Date(),
                                    display_name: 'Unknown Token',
                                    price_usd: null,
                                    marketcap: null,
                                    volume_24h: null,
                                    liquidity: null,
                                    image_url: null,
                                    metadata_uri: null
                                };
                                
                                logger.info(`Found Solana account (non-SPL): ${trimmedQuery}`);
                                
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
        } else {
            logger.warn('Helius API not configured, cannot check on-chain tokens');
        }
        
        // If we still have no results, try a broader search
        logger.info(`No results found for "${trimmedQuery}", trying broader search...`);
        
        // Try searching with partial matches
        const broaderResults = await tokenRepository.searchTokens(trimmedQuery.substring(0, 3), limit);
        
        if (broaderResults.length > 0) {
            logger.info(`Found ${broaderResults.length} broader results for "${trimmedQuery}"`);
            return res.json({
                query: trimmedQuery,
                total: broaderResults.length,
                items: broaderResults
            });
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
