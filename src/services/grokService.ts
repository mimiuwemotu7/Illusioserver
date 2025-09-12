import { logger } from '../utils/logger';
import {
  normalizeAgent,
  buildSystemPrompt,
  buildUserPrompt,
  postProcessOracle,
} from './oraclePrompt';

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

  async generateCompanionResponse(tokenData: any, userQuery: string, companionName?: string): Promise<string | null> {
    const agent = normalizeAgent(companionName);
    
    const systemMessage: GrokMessage = {
      role: 'system',
      content: buildSystemPrompt(agent, tokenData?.name, tokenData?.symbol)
    };

    const userMessage: GrokMessage = {
      role: 'user',
      content: buildUserPrompt(tokenData, userQuery)
    };

    let response = await this.chatCompletion([systemMessage, userMessage], 'grok-4-latest', 0.9);
    
    if (!response) {
      return null;
    }

    // Post-process to enforce rules
    response = postProcessOracle(response, agent);
    
    // Check for violations and re-ask if needed (only for excessive technical jargon)
    const FORBIDDEN_WORDS = /(\bvwap\b|\bcvd\b|\blp\b|\btargets?\b|\bprobabilit(y|ies)\b|\btimestamp(s)?\b)/gi;
    if (FORBIDDEN_WORDS.test(response)) {
      logger.warn('Response contained technical jargon, requesting revision');
      
      const revisionMessage: GrokMessage = {
        role: 'user',
        content: 'Revise the last message to be more practical and less technical. Keep 2–4 short sentences. End with a different agent handoff.'
      };
      
      const revisionResponse = await this.chatCompletion([systemMessage, revisionMessage], 'grok-4-latest', 0.9);
      if (revisionResponse) {
        response = postProcessOracle(revisionResponse, agent);
      }
    }

    return response;
  }

  async analyzeRetrocausality(tokenData: any, holdersData: any[], transactionsData: any): Promise<string | null> {
    const systemMessage: GrokMessage = {
      role: 'system',
      content: `You are a quantum finance oracle specializing in retrocausality analysis. Analyze token data to determine future-echo delta and scenario bias. 

      Focus on:
      - Holder distribution and concentration
      - Market dynamics and liquidity patterns  
      - Volume and price momentum indicators
      
      Return ONLY a JSON object with this exact structure:
      {
        "futureEchoDelta": "Strong|Medium|Weak",
        "scenarioBias": "Bullish|Bearish|Neutral", 
        "confidence": number (0-100),
        "reasoning": "Brief explanation"
      }`
    };

    // Calculate key metrics from holders data
    const totalHolders = holdersData.length;
    const topHolderConcentration = holdersData.length > 0 ? holdersData[0]?.amount || 0 : 0;
    const avgHolderSize = holdersData.length > 0 ? holdersData.reduce((sum, h) => sum + (h.amount || 0), 0) / holdersData.length : 0;
    
    const userMessage: GrokMessage = {
      role: 'user',
      content: `Analyze this token for retrocausality patterns:

      TOKEN DATA:
      Name: ${tokenData.name || 'Unknown'}
      Symbol: ${tokenData.symbol || 'Unknown'}
      Market Cap: $${tokenData.marketcap || 'Unknown'}
      Price: $${tokenData.price_usd || 'Unknown'}
      Volume 24h: $${tokenData.latest_marketcap?.volume_24h || 'Unknown'}
      Liquidity: $${tokenData.liquidity || 'Unknown'}
      Status: ${tokenData.status || 'Unknown'}

      HOLDERS DATA:
      Total Holders: ${totalHolders}
      Top Holder Amount: ${topHolderConcentration}
      Average Holder Size: ${avgHolderSize}
      Holder Distribution: ${holdersData.slice(0, 10).map(h => `${h.owner?.slice(0, 8)}... (${h.amount})`).join(', ')}

      TRANSACTION DATA:
      Volume: $${transactionsData.volume}
      Activity: ${transactionsData.recentActivity}

      Provide retrocausality analysis focusing on future market direction and scenario bias.`
    };

    const response = await this.chatCompletion([systemMessage, userMessage], 'grok-4-latest', 0.3);
    
    if (!response) {
      return null;
    }

    // Try to parse JSON response, fallback to structured text if needed
    try {
      const parsed = JSON.parse(response);
      return JSON.stringify(parsed);
    } catch {
      // If not valid JSON, return structured response
      return JSON.stringify({
        futureEchoDelta: "Weak",
        scenarioBias: "Neutral", 
        confidence: 50,
        reasoning: "Unable to parse AI response"
      });
    }
  }
}

export const grokService = new GrokService();

// Export the attachment announcement helper for UI
export { formatAttachmentAnnouncement } from './oraclePrompt';
