export type Agent = 'Analyzer' | 'Predictor' | 'Quantum Eraser' | 'Retrocausal';

export function normalizeAgent(companionName?: string): Agent {
  const n = (companionName || '').trim().toLowerCase();
  // tolerant mapping
  if (/(analy[zs]er|reader|watcher)/.test(n)) return 'Analyzer';
  if (/(predict(or|a)|seer|scout|oracle ahead)/.test(n)) return 'Predictor';
  if (/(eraser|clean(er)?|wipe|quantum)/.test(n)) return 'Quantum Eraser';
  if (/(retro|causal|back|time)/.test(n)) return 'Retrocausal';
  return 'Analyzer';
}

export function nextAgentForHandoff(a: Agent): Agent {
  // round-robin to a different voice
  if (a === 'Analyzer') return 'Predictor';
  if (a === 'Predictor') return 'Quantum Eraser';
  if (a === 'Quantum Eraser') return 'Retrocausal';
  return 'Analyzer';
}

export function formatAttachmentAnnouncement(agent: Agent, token: { name?: string; symbol?: string }): string {
  const sym = token?.symbol || 'this token';
  return `Attached ${agent} to ${sym} — this voice now speaks from inside ${sym}'s room only.`;
}

export function buildSystemPrompt(agent: Agent, tokenName?: string, tokenSymbol?: string): string {
  const tokenRef = tokenSymbol || tokenName || 'this token';
  const personas = {
    'Analyzer': `
The Analyzer
- Stands in ${tokenRef}'s room and describes what feels staged vs real.
- Speaks like a careful lab tech who trusts patterns over hype.
- Typical move: describe the room now, then hand off.`,
    'Predictor': `
The Predictor
- Talks from a few steps ahead, glancing back at ${tokenRef}'s corridor.
- Frames futures as doors that open/close based on posture and attention.
- Uses simple if/then in natural language; never targets or odds.`,
    'Quantum Eraser': `
The Quantum Eraser
- Cleans the lens on ${tokenRef}: wipes planted shadows and fake doors.
- Explains that much "signal" was our own flashlight on the glass.
- After cleaning, what's left is smaller but honest; invites re-check.`,
    'Retrocausal': `
The Retrocausal
- Starts in a future room of ${tokenRef} that's already open and works backward.
- Speaks in conditions for arrival vs collapse, in plain words.
- Treats attention and posture as inputs the world listens to.`
  } as const;

  return `ORACLE SYSTEM PROMPT — ILLUSIO

ATTACHMENT CONTRACT
- You are attached to ${tokenRef}. You only speak from inside this token's room.
- Plain language. Calm, lucid, lightly mystical. No stats, no jargon.
- 2–4 short sentences per message. No bullet points, no labels.
- Assume the map reacts to the watcher; tomorrow writes today's history.
- CRITICAL: End by addressing ONE different agent with a handoff:
  "AgentName, [question or challenge]"
- Allowed agents: Analyzer, Predictor, Quantum Eraser, Retrocausal.
- Never end without a handoff. No exceptions.

PERSONA
${personas[agent]}

REMINDERS
- Avoid numbers, symbols, or market terms (no $, %, price, market cap, liquidity, volume, timestamps, CVD/VWAP/LP).
- Keep it token-specific and concrete (rooms, doors, glass, tide).`;
}

export function buildUserPrompt(tokenData: any, userQuery: string): string {
  // We pass context but instruct the model to NOT quote numbers; it's just orientation.
  const ctx = {
    name: tokenData?.name || 'Unknown',
    symbol: tokenData?.symbol || 'Unknown',
    mint: tokenData?.mint || 'Unknown',
    // other fields present but implicitly off-limits for quoting as numbers
  };
  return `Context (do not quote numbers; stay token-specific):
- Name: ${ctx.name}
- Symbol: ${ctx.symbol}
- Mint: ${ctx.mint}

User intent: ${userQuery}

Speak from inside this token's room only.`;
}

const METRIC_WORDS = /(market ?cap|price|liquidity|volume|%|\$|\busd\b|\busdc\b|\bvwap\b|\bcvd\b|\blp\b|\bapr\b|\broi\b|\btargets?\b|\bprobabilit(y|ies)\b|\btimestamp(s)?\b)/gi;

export function scrubMetricsAndNumbers(text: string): string {
  // Replace forbidden terms; keep tone intact.
  return text
    .replace(METRIC_WORDS, 'signal')
    // discourage naked numerals; keep if part of a word/ticker is risky, so replace isolated numbers
    .replace(/(^|[^\w])\d+([^\w]|$)/g, '$1a few$2');
}

export function enforceSentenceCount(text: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 4);
  if (sentences.length < 2 && text) return text; // don't over-trim short replies
  return sentences.join(' ');
}

export function ensureHandoff(text: string, agent: Agent): string {
  const hasHandoff = /(Analyzer|Predictor|Quantum Eraser|Retrocausal),\s*[^]/.test(text);
  if (hasHandoff) return text;
  const to = nextAgentForHandoff(agent);
  // Add a soft, context-relevant nudge
  return `${text.trim()} ${to}, what do you see from your angle?`;
}

export function postProcessOracle(text: string, agent: Agent): string {
  let t = text || '';
  t = scrubMetricsAndNumbers(t);
  t = enforceSentenceCount(t);
  t = ensureHandoff(t, agent);
  return t;
}
