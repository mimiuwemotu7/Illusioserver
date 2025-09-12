import {
  normalizeAgent,
  nextAgentForHandoff,
  ensureHandoff,
  enforceSentenceCount,
  scrubMetricsAndNumbers,
  formatAttachmentAnnouncement,
} from './oraclePrompt';

// Simple test runner
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}:`, error);
  }
}

function expect(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function expectToMatch(actual: string, pattern: RegExp, message?: string) {
  if (!pattern.test(actual)) {
    throw new Error(message || `Expected ${actual} to match ${pattern}`);
  }
}

// Tests
test('normalizeAgent maps companion names correctly', () => {
  expect(normalizeAgent('The Analyzer'), 'Analyzer');
  expect(normalizeAgent('The Predictor'), 'Predictor');
  expect(normalizeAgent('The Quantum Eraser'), 'Quantum Eraser');
  expect(normalizeAgent('The Retrocausal'), 'Retrocausal');
  expect(normalizeAgent('analyzer'), 'Analyzer');
  expect(normalizeAgent('predictor'), 'Predictor');
  expect(normalizeAgent('quantum eraser'), 'Quantum Eraser');
  expect(normalizeAgent('retrocausal'), 'Retrocausal');
  expect(normalizeAgent('unknown'), 'Analyzer'); // default
});

test('nextAgentForHandoff cycles correctly', () => {
  expect(nextAgentForHandoff('Analyzer'), 'Predictor');
  expect(nextAgentForHandoff('Predictor'), 'Quantum Eraser');
  expect(nextAgentForHandoff('Quantum Eraser'), 'Retrocausal');
  expect(nextAgentForHandoff('Retrocausal'), 'Analyzer');
});

test('ensureHandoff adds handoff when missing', () => {
  const result1 = ensureHandoff('The room feels empty.', 'Analyzer');
  expectToMatch(result1, /Predictor.*what do you see/);
  
  const result2 = ensureHandoff('The door opens. Predictor, what do you see?', 'Analyzer');
  expect(result2, 'The door opens. Predictor, what do you see?'); // unchanged
});

test('enforceSentenceCount limits to 4 sentences', () => {
  const longText = 'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence. Sixth sentence.';
  const result = enforceSentenceCount(longText);
  const sentences = result.split(/[.!?]\s+/).length;
  expect(sentences <= 4, true, 'Should have 4 or fewer sentences');
});

test('scrubMetricsAndNumbers removes forbidden terms', () => {
  const dirty = 'The market cap is $100M with 50% liquidity and VWAP at $0.001.';
  const clean = scrubMetricsAndNumbers(dirty);
  expectToMatch(clean, /signal/, 'Should replace market terms with "signal"');
  expect(clean.includes('$'), false, 'Should remove dollar signs');
  expect(clean.includes('%'), false, 'Should remove percentage signs');
});

test('formatAttachmentAnnouncement creates proper message', () => {
  const token = { symbol: 'BONK', name: 'Bonk' };
  const result = formatAttachmentAnnouncement('Analyzer', token);
  expectToMatch(result, /Attached Analyzer to BONK/, 'Should mention agent and token');
  expectToMatch(result, /speaks from inside BONK's room only/, 'Should mention room attachment');
});

console.log('Oracle Prompt Tests Complete');
