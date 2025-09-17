import { Connection } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { tokenRepository } from '../db/repository';
import { logger } from '../utils/logger';
import { MarketDataService } from './marketDataService';

// Import wsService dynamically to avoid circular dependency
let wsService: any = null;
const getWsService = () => {
    if (!wsService) {
        try {
            wsService = require('../app').wsService;
        } catch (error) {
            console.warn('WebSocket service not available:', error);
        }
    }
    return wsService;
};

export class MintWatcherService {
    private connection: Connection;
    private isRunning: boolean = false;
    private subscriptionId: number | null = null;
    private marketDataService: MarketDataService;

    constructor(rpcUrl: string, birdeyeApiKey: string, heliusApiKey: string) {
        // Use multiple RPC endpoints for better reliability
        const rpcUrls = [
            rpcUrl,
            'https://api.mainnet-beta.solana.com',
            'https://solana-api.projectserum.com'
        ];
        this.connection = new Connection(rpcUrls[0], {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 30000, // 30 seconds
            disableRetryOnRateLimit: false,
            httpHeaders: {
                'User-Agent': 'Solana-Token-Tracker/1.0'
            }
        });
        
        // Initialize market data service for immediate API calls
        this.marketDataService = new MarketDataService(birdeyeApiKey, heliusApiKey);
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.info('Mint watcher is already running');
            return;
        }

        try {
            logger.info('Starting mint watcher service...');
            
            // Subscribe to Token Program logs
            this.subscriptionId = this.connection.onLogs(
                TOKEN_PROGRAM_ID,
                async (logs) => {
                    try {
                        if (logs.err) return;
                        
                        // Check if this is an InitializeMint instruction
                        const hasInitializeMint = logs.logs.some(
                            (log) => log.includes("Instruction: InitializeMint") || log.includes("Instruction: InitializeMint2")
                        );
                        
                        if (hasInitializeMint) {
                            // Process immediately for instant token detection
                            await this.processInitializeMint(logs.signature);
                        }
                    } catch (error) {
                        logger.error('Error processing logs:', error);
                    }
                },
                'confirmed'
            );

            this.isRunning = true;
            logger.info('Mint watcher service started successfully');
            
        } catch (error) {
            logger.error('Failed to start mint watcher service:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.info('Mint watcher is not running');
            return;
        }

        try {
            if (this.subscriptionId !== null) {
                await this.connection.removeOnLogsListener(this.subscriptionId);
                this.subscriptionId = null;
            }
            
            this.isRunning = false;
            logger.info('Mint watcher service stopped');
            
        } catch (error) {
            logger.error('Error stopping mint watcher service:', error);
            throw error;
        }
    }

    private async processInitializeMint(signature: string): Promise<void> {
        try {
            logger.info(`Processing InitializeMint transaction: ${signature}`);
            
            // No delay for instant processing
            
            // Get transaction details with retry logic
            let tx;
            let retries = 3;
            while (retries > 0) {
                try {
                    tx = await this.connection.getParsedTransaction(signature, {
                        maxSupportedTransactionVersion: 0,
                        commitment: 'confirmed'
                    });
                    break;
                } catch (error: any) {
                    if (error.message?.includes('429') || error.message?.includes('rate limited')) {
                        logger.warn(`Rate limited, retrying in 2 seconds... (${retries} retries left)`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        retries--;
                    } else {
                        throw error;
                    }
                }
            }
            
            if (!tx?.meta) {
                logger.warn(`No transaction metadata for ${signature}`);
                return;
            }

            // Extract mint address and decimals from the transaction
            const mintInfo = this.extractMintInfo(tx);
            if (!mintInfo) {
                logger.warn(`Could not extract mint info from ${signature}`);
                return;
            }

            // ONLY ALLOW PUMP.FUN AND BONK.FUN TOKENS
            const tokenSource = this.identifyTokenSource(tx, mintInfo.mint);
            if (!tokenSource) {
                logger.info(`🚫 Skipping non-Pump/Bonk token: ${mintInfo.mint}`);
                return;
            }

            logger.info(`✅ ${tokenSource.toUpperCase()} token detected: ${mintInfo.mint}`);

            // Save to database with identified source
            const newToken = await tokenRepository.createToken(
                mintInfo.mint,
                mintInfo.decimals,
                mintInfo.supply,
                new Date(mintInfo.blocktime * 1000),
                undefined, // name - fresh mints often don't have metadata yet
                undefined, // symbol - fresh mints often don't have metadata yet
                undefined, // metadataUri
                undefined, // imageUrl
                undefined, // bondingCurveAddress
                false,     // isOnCurve - default to false, will be updated by metadata enricher
                'fresh',   // status
                tokenSource // source - pump.fun or bonk.fun
            );

            logger.info(`Successfully processed mint: ${mintInfo.mint} (${mintInfo.decimals} decimals)`);
            
            // IMMEDIATE market data fetching - this is the key change!
            console.log(`🚀 IMMEDIATE MARKET DATA FETCH for new mint: ${mintInfo.mint}`);
            logger.info(`🚀 IMMEDIATE MARKET DATA FETCH for new mint: ${mintInfo.mint}`);
            
            try {
                // Fetch market data immediately (non-blocking)
                const marketDataSuccess = await this.marketDataService.fetchMarketDataImmediately(mintInfo.mint, newToken.id);
                
                if (marketDataSuccess) {
                    console.log(`✅ IMMEDIATE MARKET DATA SUCCESS for ${mintInfo.mint}`);
                    logger.info(`✅ IMMEDIATE MARKET DATA SUCCESS for ${mintInfo.mint}`);
                } else {
                    console.log(`❌ IMMEDIATE MARKET DATA FAILED for ${mintInfo.mint} - will retry later`);
                    logger.warn(`❌ IMMEDIATE MARKET DATA FAILED for ${mintInfo.mint} - will retry later`);
                }
            } catch (error) {
                console.error(`❌ Error in immediate market data fetch for ${mintInfo.mint}:`, error);
                logger.error(`❌ Error in immediate market data fetch for ${mintInfo.mint}:`, error);
            }
            
            // IMMEDIATE metadata enrichment for fresh mint
            try {
                const metadataEnricher = require('./metadataEnricherService').metadataEnricherService;
                if (metadataEnricher) {
                    // Trigger immediate metadata enrichment (non-blocking)
                    metadataEnricher.enrichTokenImmediately(mintInfo.mint).catch((error: any) => {
                        logger.debug(`Immediate metadata enrichment failed for ${mintInfo.mint}:`, error);
                    });
                }
            } catch (error) {
                logger.debug('Metadata enricher service not available for immediate enrichment');
            }
            
            // Broadcast new token to all connected WebSocket clients
            if (newToken) {
                const ws = getWsService();
                if (ws) {
                    logger.info(`🔥 Broadcasting new token: ${newToken.mint}`);
                    ws.broadcastNewToken(newToken);
                } else {
                    logger.warn('WebSocket service not available for broadcasting new token');
                }
            }
            
        } catch (error) {
            logger.error(`Error processing InitializeMint transaction ${signature}:`, error);
        }
    }

    private identifyTokenSource(tx: any, mint: string): string | null {
        try {
            // Check for Pump.fun token characteristics
            if (this.isPumpFunToken(tx, mint)) {
                return 'pump.fun';
            }
            
            // Check for Bonk.fun token characteristics  
            if (this.isBonkFunToken(tx, mint)) {
                return 'bonk.fun';
            }
            
            // Not a Pump.fun or Bonk.fun token
            return null;
            
        } catch (error) {
            logger.error('Error identifying token source:', error);
            return null;
        }
    }

    private isPumpFunToken(tx: any, _mint: string): boolean {
        try {
            // Official Pump.fun program ID
            const pumpFunProgramId = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
            
            // Check transaction instructions for Pump.fun program
            const instructions = tx.transaction?.message?.instructions || [];
            for (const instruction of instructions) {
                if (instruction.programId) {
                    const programId = instruction.programId.toString();
                    if (programId === pumpFunProgramId) {
                        logger.debug(`✅ Pump.fun program detected: ${programId}`);
                        return true;
                    }
                }
            }
            
            // Check inner instructions for Pump.fun program
            for (const inner of tx.meta?.innerInstructions ?? []) {
                for (const instruction of inner.instructions ?? []) {
                    if (instruction.programId) {
                        const programId = instruction.programId.toString();
                        if (programId === pumpFunProgramId) {
                            logger.debug(`✅ Pump.fun inner program detected: ${programId}`);
                            return true;
                        }
                    }
                }
            }
            
            return false;
            
        } catch (error) {
            logger.error('Error checking Pump.fun token:', error);
            return false;
        }
    }

    private isBonkFunToken(_tx: any, _mint: string): boolean {
        // TODO: Add Bonk.fun program ID when available
        // For now, we only track Pump.fun tokens
        return false;
    }



    private extractMintInfo(tx: any): { mint: string; decimals: number; supply: number; blocktime: number } | null {
        try {
            // Check main instructions
            for (const ix of tx.transaction.message.instructions as any[]) {
                if (ix.programId?.toString() === TOKEN_PROGRAM_ID.toString() && 
                    'parsed' in ix && ix.parsed && 
                    (ix.parsed.type === "initializeMint" || ix.parsed.type === "initializeMint2")) {
                    
                    return {
                        mint: ix.parsed.info.mint,
                        decimals: ix.parsed.info.decimals,
                        supply: ix.parsed.info.supply || 0,
                        blocktime: tx.blockTime || Math.floor(Date.now() / 1000)
                    };
                }
            }

            // Check inner instructions
            for (const inner of tx.meta.innerInstructions ?? []) {
                for (const ix of inner.instructions ?? []) {
                    if (ix.programId?.toString() === TOKEN_PROGRAM_ID.toString() && 
                        'parsed' in ix && ix.parsed && 
                        (ix.parsed.type === "initializeMint" || ix.parsed.type === "initializeMint2")) {
                        
                        return {
                            mint: ix.parsed.info.mint,
                            decimals: ix.parsed.info.decimals,
                            supply: ix.parsed.info.supply || 0,
                            blocktime: tx.blockTime || Math.floor(Date.now() / 1000)
                        };
                    }
                }
            }

            return null;
        } catch (error) {
            logger.error('Error extracting mint info:', error);
            return null;
        }
    }

}
