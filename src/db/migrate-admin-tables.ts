import fs from 'fs';
import path from 'path';
import db from './connection';
import { logger } from '../utils/logger';

async function migrateAdminTables() {
    try {
        logger.info('🔄 Starting admin tables migration...');
        
        // Read the SQL schema file
        const schemaPath = path.join(__dirname, 'admin-schema.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute the schema
        await db.query(schemaSQL);
        
        logger.info('✅ Admin tables migration completed successfully!');
        logger.info('📊 Created tables: user_sessions, page_views, api_calls, feature_usage, system_metrics, realtime_analytics');
        
    } catch (error) {
        logger.error('❌ Admin tables migration failed:', error);
        throw error;
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    migrateAdminTables()
        .then(() => {
            logger.info('🎉 Migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

export { migrateAdminTables };
