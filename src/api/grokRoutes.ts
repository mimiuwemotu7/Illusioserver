import { Router } from 'express';
import { grokService } from '../services/grokService';
import { tokenRepository } from '../db/repository';
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

    res.json({ 
      mint,
      analysis,
      token: {
        name: token.name,
        symbol: token.symbol,
        marketcap: token.marketcap,
        price_usd: token.price_usd
      }
    });
  } catch (error) {
    logger.error('Token analysis error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Chat with companion about a token
router.post('/chat/:mint', async (req, res) => {
  try {
    const { mint } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const token = await tokenRepository.findByMint(mint);
    if (!token) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const response = await grokService.generateCompanionResponse(token, message);
    
    if (!response) {
      return res.status(500).json({ error: 'Failed to generate response' });
    }

    res.json({ 
      mint,
      userMessage: message,
      companionResponse: response,
      token: {
        name: token.name,
        symbol: token.symbol,
        marketcap: token.marketcap,
        price_usd: token.price_usd
      }
    });
  } catch (error) {
    logger.error('Companion chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// General chat (not token-specific)
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await grokService.chatCompletion([
      {
        role: 'system',
        content: 'You are a helpful Solana trading companion. Provide insights and advice about Solana tokens and DeFi.'
      },
      {
        role: 'user',
        content: message
      }
    ]);
    
    if (!response) {
      return res.status(500).json({ error: 'Failed to generate response' });
    }

    res.json({ 
      userMessage: message,
      companionResponse: response
    });
  } catch (error) {
    logger.error('General chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
