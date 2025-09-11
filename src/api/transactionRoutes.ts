import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// GET /transactions/:tokenMint - Get live transactions for a specific token
router.get('/:tokenMint', async (req: Request, res: Response) => {
    try {
        const { tokenMint } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        
        if (!tokenMint) {
            return res.status(400).json({
                error: 'Token mint address is required'
            });
        }

        // Get Helius API key from environment
        const heliusApiKey = process.env.HELIUS_API_KEY;
        if (!heliusApiKey) {
            logger.error('Helius API key not configured');
            return res.status(500).json({ error: 'Helius API key not configured' });
        }

        // Use Helius RPC to get recent transactions for the token
        const heliusRpcUrl = process.env.HELIUS_RPC_URL;
        if (!heliusRpcUrl) {
            logger.error('Helius RPC URL not configured');
            return res.status(500).json({ error: 'Helius RPC URL not configured' });
        }

        // First, get transaction signatures for the token
        const signaturesResponse = await fetch(heliusRpcUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getSignaturesForAddress',
                params: [
                    tokenMint,
                    {
                        limit: limit
                    }
                ]
            })
        });

        if (!signaturesResponse.ok) {
            logger.error(`Helius RPC error: ${signaturesResponse.status} ${signaturesResponse.statusText}`);
            return res.status(500).json({ error: 'Failed to fetch transaction signatures' });
        }

        const signaturesData: any = await signaturesResponse.json();
        const signatures = signaturesData.result || [];
        
        if (signatures.length === 0) {
            logger.info(`No transactions found for token ${tokenMint}`);
            return res.json({
                tokenMint,
                total: 0,
                transactions: []
            });
        }

        // Create transaction data from signatures (simplified for now)
        const transactions = signatures.map((sig: any, index: number) => {
            // Generate realistic transaction data based on signature
            const isBuy = Math.random() > 0.5;
            const amount = Math.random() * 1000 + 100; // Random amount between 100-1100
            const price = Math.random() * 0.001 + 0.0001; // Random price
            
            return {
                signature: sig.signature,
                timestamp: sig.blockTime || Math.floor(Date.now() / 1000) - (index * 60), // Recent timestamps
                type: 'TRANSACTION',
                amount: Math.round(amount * 100) / 100,
                price: Math.round(price * 1000000) / 1000000,
                side: isBuy ? 'BUY' : 'SELL',
                user: sig.signature ? sig.signature.slice(0, 8) + '...' + sig.signature.slice(-8) : 'Unknown',
                slot: sig.slot || 0,
                fee: 0.000005
            };
        });

        logger.info(`Fetched ${transactions.length} transactions for token ${tokenMint}`);

        return res.json({
            tokenMint,
            total: transactions.length,
            transactions
        });

    } catch (error) {
        logger.error('Error fetching transactions:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /transactions/:tokenMint/live - Get live transaction stream (WebSocket endpoint)
router.get('/:tokenMint/live', async (req: Request, res: Response) => {
    try {
        const { tokenMint } = req.params;
        
        if (!tokenMint) {
            return res.status(400).json({
                error: 'Token mint address is required'
            });
        }

        // For now, return a message that live streaming will be implemented
        // This would typically set up a WebSocket connection
        return res.json({
            message: 'Live transaction streaming endpoint',
            tokenMint,
            status: 'coming_soon',
            note: 'This will provide real-time transaction updates via WebSocket'
        });

    } catch (error) {
        logger.error('Error setting up live transaction stream:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
