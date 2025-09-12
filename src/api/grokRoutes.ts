import { Router } from 'express';
import { grokService } from '../services/grokService';
import { tokenRepository } from '../db/repository';
import { TokenWithMarketCap } from '../db/types';
import { logger } from '../utils/logger';

const router = Router();

// Analyze a specific token
router.post('/analyze/:mint', async (req, res) => {
  try {
    const { mint } = req.params;
    
    const token = await tokenRepository.findByMint(mint);
    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const analysis = await grokService.analyzeToken(token);
    
    if (!analysis) {
      return res.status(500).json({ error: 'Failed to generate analysis' });
    }

    return res.json({ 
      mint,
      analysis,
      token: {
        name: token.name,
        symbol: token.symbol,
        mint: token.mint,
        status: token.status
      }
    });
  } catch (error) {
    logger.error('Token analysis error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Chat with companion about a token
router.post('/chat/:mint', async (req, res) => {
  try {
    const { mint } = req.params;
    const { message, userMessage, companionName } = req.body;
    const actualMessage = message || userMessage;
    
    if (!actualMessage) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const token = await tokenRepository.findByMint(mint);
    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const response = await grokService.generateCompanionResponse(token, actualMessage, companionName);
    
    if (!response) {
      return res.status(500).json({ error: 'Failed to generate response' });
    }

    return     res.json({ 
      mint,
      userMessage: actualMessage,
      companionResponse: response,
      token: {
        name: token.name,
        symbol: token.symbol,
        mint: token.mint,
        status: token.status
      }
    });
  } catch (error) {
    logger.error('Companion chat error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// General chat (not token-specific)
router.post('/chat', async (req, res) => {
  try {
    const { message, userMessage } = req.body;
    const actualMessage = message || userMessage;
    
    if (!actualMessage) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await grokService.chatCompletion([
      {
        role: 'system',
        content: 'You are a helpful Solana trading companion. Provide insights and advice about Solana tokens and DeFi.'
      },
      {
        role: 'user',
        content: actualMessage
      }
    ]);
    
    if (!response) {
      return res.status(500).json({ error: 'Failed to generate response' });
    }

    return     res.json({ 
      userMessage: actualMessage,
      companionResponse: response
    });
  } catch (error) {
    logger.error('General chat error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Oracle Hub conversation endpoint
router.post('/oracle/conversation', async (req, res) => {
  try {
    const { agent, context } = req.body;
    
    if (!agent) {
      return res.status(400).json({ error: 'Agent is required' });
    }

    // Create a mock token for the oracle conversation
    const mockToken = {
      name: 'Oracle Market',
      symbol: 'ORACLE',
      mint: 'oracle-conversation',
      status: 'active',
      marketcap: null,
      price_usd: null,
      volume_24h: null,
      liquidity: null
    };

    // Use the same system as token companions but for general oracle conversation
    const response = await grokService.generateCompanionResponse(
      mockToken, 
      context || 'Continue the oracle conversation',
      agent
    );
    
    if (!response) {
      return res.status(500).json({ error: 'Failed to generate oracle response' });
    }

    return res.json({ 
      agent,
      oracleResponse: response,
      context: context || 'oracle conversation'
    });
  } catch (error) {
    logger.error('Oracle conversation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Retrocausality analysis endpoint
router.post('/retrocausality/:mint', async (req, res) => {
  try {
    const { mint } = req.params;
    
    const token: TokenWithMarketCap | null = await tokenRepository.findByMint(mint);
    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }

    // Get holders data
    const holdersData = await tokenRepository.getTopHolders(mint, 100);
    
    // For now, we'll use a simple placeholder for transaction data
    // This can be enhanced when transaction tracking is implemented
    const transactionsData = {
      count: 0,
      volume: token.latest_marketcap?.volume_24h || 0,
      recentActivity: 'No transaction data available'
    };

    const analysis = await grokService.analyzeRetrocausality(token, holdersData, transactionsData);
    
    if (!analysis) {
      return res.status(500).json({ error: 'Failed to generate retrocausality analysis' });
    }

    return res.json({ 
      mint,
      analysis,
      timestamp: new Date().toISOString(),
      token: {
        name: token.name,
        symbol: token.symbol,
        mint: token.mint,
        status: token.status
      }
    });
  } catch (error) {
    logger.error('Retrocausality analysis error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
