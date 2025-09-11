import { tokenRepository } from '../db/repository';
import { logger } from '../utils/logger';
import * as cron from 'node-cron';
// WebSocket service integration removed to avoid circular dependency

export class TokenStatusUpdaterService {
    private cronJob?: cron.ScheduledTask;
    private isRunning = false;

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.info('Token Status Updater Service is already running');
            return;
        }

        logger.info('Starting Token Status Updater Service...');
        
        // Update token statuses every 30 seconds to avoid rate limits
        this.cronJob = cron.schedule("*/30 * * * * *", async () => {
            try {
                await this.updateTokenStatuses();
            } catch (error) {
                logger.error('Error in token status update cron job:', error);
            }
        });

        this.isRunning = true;
        logger.info('✅ Token Status Updater Service started successfully');
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.info('Token Status Updater Service is not running');
            return;
        }

        logger.info('Stopping Token Status Updater Service...');
        
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = undefined;
        }

        this.isRunning = false;
        logger.info('✅ Token Status Updater Service stopped successfully');
    }

    private async updateTokenStatuses(): Promise<void> {
        try {
            // DISABLED: Stop moving fresh mints to active status
            // Fresh mints should stay fresh and visible in the fresh mints column
            logger.info('Token status updater running but NOT moving fresh mints to active status');
            
            // Only handle curve tokens if needed, but leave fresh mints alone
            const curveTokens = await tokenRepository.getAllTokens();
            const curveTokensOnly = curveTokens.filter(token => token.status === 'curve');
            
            // Only process curve tokens, leave fresh mints untouched
            if (curveTokensOnly.length > 0) {
                logger.info(`Processing ${curveTokensOnly.length} curve tokens`);
                // Add any curve-specific logic here if needed
                // But DO NOT touch fresh mints
            }

        } catch (error) {
            logger.error('Error updating token statuses:', error);
        }
    }
}
