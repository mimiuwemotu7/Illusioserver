// Solana Program IDs
export const PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'; // Pump.fun program
export const METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

// Token statuses
export const TOKEN_STATUSES = {
  FRESH: 'fresh',
  ACTIVE: 'active', 
  CURVE: 'curve'
} as const;

export type TokenStatus = typeof TOKEN_STATUSES[keyof typeof TOKEN_STATUSES];
