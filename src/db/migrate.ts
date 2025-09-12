import fs from 'fs';
import path from 'path';
import db from './connection';
import { logger } from '../utils/logger';

async function runMigrations() {
    try {
        logger.info('Starting database migrations...');
        
        // Read the init.sql file
        const initSqlPath = path.join(__dirname, 'init.sql');
        const initSql = fs.readFileSync(initSqlPath, 'utf8');
        
        // Split the SQL into individual statements
        const statements = initSql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        logger.info(`Found ${statements.length} SQL statements to execute`);
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            try {
                await db.query(statement);
                logger.info(`Executed statement ${i + 1}/${statements.length}`);
            } catch (error) {
                logger.error(`Error executing statement ${i + 1}:`, error);
                logger.error(`Statement: ${statement}`);
                throw error;
            }
        }
        
        logger.info('Database migrations completed successfully!');
        
        // Verify the tables were created
        const tablesResult = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('tokens', 'marketcaps', 'token_holders', 'token_holder_summary')
            ORDER BY table_name
        `);
        
        logger.info('Created tables:', tablesResult.rows.map((row: any) => row.table_name));
        
        // Check table structure
        const tokensStructure = await db.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'tokens'
            ORDER BY ordinal_position
        `);
        
        logger.info('Tokens table structure:');
        tokensStructure.rows.forEach((col: any) => {
            logger.info(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
        
    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

// Run migrations if this file is executed directly
if (require.main === module) {
    runMigrations();
}
