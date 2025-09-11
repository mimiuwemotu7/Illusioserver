import { logger } from '../utils/logger';

export interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GrokResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class GrokService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.GROK_API_KEY || '';
    this.apiUrl = process.env.GROK_API_URL || 'https://api.x.ai/v1/chat/completions';
    
    if (!this.apiKey) {
      logger.warn('GROK_API_KEY not set; Grok service will be disabled');
    }
  }

  async chatCompletion(messages: GrokMessage[], model: string = 'grok-4-latest', temperature: number = 0.7): Promise<string | null> {
    if (!this.apiKey) {
      logger.warn('Grok API key not available');
      return null;
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          messages,
          model,
          stream: false,
          temperature,
        }),
      });

      if (!response.ok) {
        logger.error(`Grok API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json() as GrokResponse;
      
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content;
      }

      return null;
    } catch (error) {
      logger.error('Grok API request failed:', error);
      return null;
    }
  }

  async analyzeToken(tokenData: any): Promise<string | null> {
    const systemMessage: GrokMessage = {
      role: 'system',
      content: `You are a Solana token analyst. Analyze the provided token data and give insights about:
      - Token fundamentals
      - Market potential
      - Risk assessment
      - Trading recommendations
      
      Keep responses concise and actionable.`
    };

    const userMessage: GrokMessage = {
      role: 'user',
      content: `Analyze this Solana token:
      
      Name: ${tokenData.name || 'Unknown'}
      Symbol: ${tokenData.symbol || 'Unknown'}
      Mint: ${tokenData.mint}
      Market Cap: $${tokenData.marketcap || 'Unknown'}
      Price: $${tokenData.price_usd || 'Unknown'}
      Volume 24h: $${tokenData.volume_24h || 'Unknown'}
      Liquidity: $${tokenData.liquidity || 'Unknown'}
      Status: ${tokenData.status || 'Unknown'}
      Source: ${tokenData.source || 'Unknown'}
      
      Provide a brief analysis and recommendation.`
    };

    return await this.chatCompletion([systemMessage, userMessage]);
  }

  async generateCompanionResponse(tokenData: any, userQuery: string): Promise<string | null> {
    const systemMessage: GrokMessage = {
      role: 'system',
      content: `You are a helpful trading companion for Solana tokens. You have access to real-time token data and can provide insights, analysis, and trading advice. Be helpful, accurate, and concise.`
    };

    const userMessage: GrokMessage = {
      role: 'user',
      content: `Token: ${tokenData.name} (${tokenData.symbol})
      Market Cap: $${tokenData.marketcap || 'Unknown'}
      Price: $${tokenData.price_usd || 'Unknown'}
      
      User Question: ${userQuery}
      
      Please provide a helpful response.`
    };

    return await this.chatCompletion([systemMessage, userMessage]);
  }
}

export const grokService = new GrokService();
