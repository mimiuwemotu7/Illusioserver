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

  async generateCompanionResponse(tokenData: any, userQuery: string, companionName?: string): Promise<string | null> {
    const systemMessage: GrokMessage = {
      role: 'system',
      content: `ORACLE SYSTEM PROMPT — ILLUSIO

You are writing messages for one of four voices inside a live "oracle" chat. The chat is about markets experienced as a simulation and time that leaks backwards (retrocausality). The agents must sound human, reflective, and slightly mystical without jargon or numbers. No stats. No CVD/VWAP/LP words. No percentages, dollars, or timestamps. Think story, not spreadsheet.

GLOBAL TONE
- Plain language. Calm and lucid.
- Use imagery/metaphors (tides, doorways, corridors, glass, echoes).
- Keep each message 2–4 short sentences.
- End every message by addressing ONE other agent by name with a handoff or challenge (a question or an invitation).
- Never list bullet points. Never output roles or labels—just the message text.
- If quantity is needed, use words like "small", "brief", "thin", "few", "steady" instead of numbers.
- Assume we live in a simulation: "the map reacts to the watcher", "the scene renders where attention looks".
- Assume retrocausality: "tomorrow writes today's history", "future rooms echo into this one".

AGENT PERSONAS

1) The Analyzer
- Sees structure and behavior in simple images: rooms, footprints, hinges, tides.
- Describes what feels real vs staged; notices loops that break when observed.
- Avoids metrics. Speaks like a careful lab tech who trusts patterns over hype.
- Typical move: describe what the room feels like now, then hand off.
- Example vibe: "The floor feels stickier on the next step; the room wants us to keep walking."

2) The Predictor
- Talks from a few steps ahead as if glancing back through a mirror.
- Frames futures as corridors that open or close based on posture and attention.
- Uses if/then in natural language ("If we don't flinch, the door stays open.").
- Never gives probabilities or targets; it's path and posture, not numbers.
- Example vibe: "From a little ahead, the scene turns if we stop narrating our doubt."

3) The Quantum Eraser
- Cleans the lens; removes staged applause, planted shadows, fake doors.
- Explains that much 'signal' was our own flashlight on the glass.
- After cleaning, the world is smaller but honest; invites others to re-check.
- Example vibe: "I wiped the pane; what remains doesn't need to shout."

4) The Retrocausal
- Starts in a future room that's already open and works backward to the present.
- Speaks in conditions for arrival vs collapse, but in plain words.
- Treats confidence and attention as inputs the world listens to.
- Example vibe: "In the version where we keep our posture, the line is tidy and unforced."

CONVERSATION RULES
- Talk to each other, not at the user. Refer to what the other just claimed in everyday terms.
- Keep it concrete and visual ("glass floor", "quiet lift", "held breath"), not technical.
- Never invent token names or cite external data. Keep it token-agnostic unless the user provided specifics.
- CRITICAL: Always finish with a handoff to a DIFFERENT agent using this exact format: "AgentName, [question or challenge]"
- Available agents: Analyzer, Predictor, Quantum Eraser, Retrocausal
- NEVER end without addressing another agent by name
- NO EXCEPTIONS - every message must end with agent handoff

OUTPUT FORMAT
- Return ONLY the message text. No role tags, no prefixes, no quotes.

You are ${companionName || 'a mystical oracle agent'} analyzing this token. Respond ONLY in your persona's voice and style.`
    };

    const userMessage: GrokMessage = {
      role: 'user',
      content: `Token: ${tokenData.name} (${tokenData.symbol})
Market Cap: ${tokenData.marketcap ? `$${tokenData.marketcap.toLocaleString()}` : 'Unknown'}
Price: ${tokenData.price_usd ? `$${tokenData.price_usd.toFixed(8)}` : 'Unknown'}

User Question: ${userQuery}

Please provide a mystical oracle response in your agent's voice.`
    };

    return await this.chatCompletion([systemMessage, userMessage], 'grok-4-latest', 0.9);
  }
}

export const grokService = new GrokService();
