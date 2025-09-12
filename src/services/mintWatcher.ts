import { Connection } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { tokenRepository } from '../db/repository';
import { logger } from '../utils/logger';
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

    constructor(rpcUrl: string) {
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

            // Check if this is a Jupiter or Sugar token and skip it
            if (this.isJupiterOrSugarToken(mintInfo.mint)) {
                logger.info(`🚫 Skipping Jupiter/Sugar token: ${mintInfo.mint}`);
                return;
            }

            // Check if this is a candy machine transaction and skip it
            if (this.isCandyMachineTransaction(tx)) {
                logger.info(`🚫 Skipping candy machine transaction: ${mintInfo.mint}`);
                return;
            }

            // Save to database
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
                'fresh'    // status
            );

            logger.info(`Successfully processed mint: ${mintInfo.mint} (${mintInfo.decimals} decimals)`);
            
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
                
                // Trigger immediate market cap update for fresh mint
                try {
                    // Note: This will be handled by the market cap updater service automatically
                    // since it now prioritizes fresh mints in its update cycle
                    logger.info(`📊 Fresh mint ${newToken.mint} will be prioritized for market cap update`);
                } catch (error) {
                    logger.debug('Market cap updater service not available for immediate update');
                }
            }
            
        } catch (error) {
            logger.error(`Error processing InitializeMint transaction ${signature}:`, error);
        }
    }

    private isJupiterOrSugarToken(mint: string): boolean {
        // Known Jupiter and Sugar token patterns
        const jupiterPatterns = [
            'JUP', // Jupiter token
            'JUPITER', // Jupiter variations
            'JUPITERLEND', // Jupiter Lend
            'JUPITERBORROW', // Jupiter Borrow
        ];
        
        const sugarPatterns = [
            'SUGAR', // Sugar token
            'SUGARGLIDER', // Sugar glider variations
        ];
        
        const candyMachinePatterns = [
            'CANDY', // Candy machine tokens
            'CANDY_GUARD', // Candy guard tokens
            'CANDYGUARD', // Candy guard variations
            'GUARD', // Guard tokens
            'GUARD1', // Guard1 tokens
            'METAPLEX', // Metaplex tokens
            'NFT', // NFT related tokens
            'COLLECTION', // Collection tokens
            'MASTEREDITION', // Master edition tokens
            'METADATA', // Metadata tokens
            'DELEGATE', // Delegate tokens
            'RECORD', // Token record tokens
        ];
        
        const otherUnwantedPatterns = [
            'LEND', // Lending tokens
            'BORROW', // Borrowing tokens
            'VAULT', // Vault tokens
            'CPMM', // Raydium CPMM tokens
            'CREATOR', // Creator pool tokens
            'POOL', // Pool tokens
            'METEORA', // Meteora DBC tokens
            'DBC', // Dynamic Bonding Curve tokens
            'DYNAMIC', // Dynamic tokens
            'ATA', // Associated Token Account tokens
            'TOKENACCOUNT', // Token Account tokens
            'ATOKEN', // AToken tokens
        ];
        
        // Check if mint contains any of these patterns
        const upperMint = mint.toUpperCase();
        return jupiterPatterns.some(pattern => upperMint.includes(pattern)) ||
               sugarPatterns.some(pattern => upperMint.includes(pattern)) ||
               candyMachinePatterns.some(pattern => upperMint.includes(pattern)) ||
               otherUnwantedPatterns.some(pattern => upperMint.includes(pattern));
    }

    private isCandyMachineTransaction(tx: any): boolean {
        try {
            // Check transaction logs for candy machine indicators
            const logs = tx.meta?.logMessages || [];
            const logText = logs.join(' ').toLowerCase();
            
            // Check for candy machine program indicators
            const candyMachineIndicators = [
                'candy machine',
                'candy guard',
                'metaplex',
                'nft mint',
                'master edition',
                'collection delegate',
                'token record',
                'collection metadata',
                'nft metadata'
            ];
            
            const hasCandyMachineLogs = candyMachineIndicators.some(indicator => 
                logText.includes(indicator)
            );
            
            if (hasCandyMachineLogs) {
                logger.debug(`🚫 Candy machine transaction detected via logs: ${logText.substring(0, 200)}...`);
                return true;
            }
            
            // Check account keys for candy machine patterns
            const accountKeys = tx.transaction?.message?.accountKeys || [];
            const accountKeysText = accountKeys.map((key: any) => key.toString()).join(' ').toLowerCase();
            
            // Check for known candy machine program IDs and patterns
            const candyMachinePrograms = [
                'cndy3', // Candy Machine Core Program
                'guard1', // Candy Guard Program
                'metaqbxx', // Metaplex Token Metadata Program
                'p1exd', // Metaplex Candy Machine Program
            ];
            
            const hasCandyMachinePrograms = candyMachinePrograms.some(program => 
                accountKeysText.includes(program)
            );
            
            if (hasCandyMachinePrograms) {
                logger.debug(`🚫 Candy machine transaction detected via program IDs`);
                return true;
            }
            
            // Check instruction data for candy machine operations
            const instructions = tx.transaction?.message?.instructions || [];
            for (const instruction of instructions) {
                if (instruction.programId) {
                    const programId = instruction.programId.toString();
                    // Known candy machine program IDs
                    if (programId === 'cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ' || // Candy Machine Core
                        programId === 'Guard1JwRhJkVH6XZhzoYxeBVQe872VH6QggF4BWmS9g' || // Candy Guard
                        programId === 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s' || // Token Metadata
                        programId === 'p1exdMJcjVao65QdewkaZRUnU6VPSXhus9n2GzWfh98') { // Candy Machine
                        logger.debug(`🚫 Candy machine transaction detected via instruction program: ${programId}`);
                        return true;
                    }
                }
            }
            
            return false;
        } catch (error) {
            logger.error('Error checking candy machine transaction:', error);
            return false;
        }
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
