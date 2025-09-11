import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

class DatabaseConnection {
    private pool: Pool;
    private static instance: DatabaseConnection;

    private constructor() {
        // Use DATABASE_URL if available (Railway), otherwise fall back to individual variables
        const config = process.env.DATABASE_URL 
            ? { connectionString: process.env.DATABASE_URL }
            : {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'solana_tokens',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || 'password',
            };

        this.pool = new Pool({
            ...config,
            max: 20,
            min: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            allowExitOnIdle: false,
        });

        // Handle pool errors
        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
            // Don't exit the process, just log the error and continue
            // The pool will handle reconnection automatically
        });
    }

    public static getInstance(): DatabaseConnection {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection();
        }
        return DatabaseConnection.instance;
    }

    public async getClient(): Promise<PoolClient> {
        return await this.pool.connect();
    }

    public async query(text: string, params?: any[]): Promise<any> {
        let client;
        try {
            client = await this.getClient();
            const result = await client.query(text, params);
            return result;
        } catch (error: any) {
            if (error.message?.includes('Cannot use a pool after calling end on the pool')) {
                console.error('Database pool error detected, attempting to reconnect...');
                // Recreate the pool if it's been closed
                this.recreatePool();
                throw new Error('Database connection lost, please retry');
            }
            throw error;
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    private recreatePool(): void {
        try {
            if (this.pool && !this.pool.ended) {
                this.pool.end();
            }
        } catch (error) {
            console.error('Error closing old pool:', error);
        }
        
        // Create a new pool
        const config = process.env.DATABASE_URL 
            ? { connectionString: process.env.DATABASE_URL }
            : {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'solana_tokens',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || 'password',
            };

        this.pool = new Pool({
            ...config,
            max: 20,
            min: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            allowExitOnIdle: false,
        });
        
        console.log('Database pool recreated successfully');
    }

    public async close(): Promise<void> {
        if (this.pool && !this.pool.ended) {
            await this.pool.end();
        }
    }

    public async testConnection(): Promise<boolean> {
        try {
            const result = await this.query('SELECT NOW()');
            console.log('Database connection successful:', result.rows[0]);
            return true;
        } catch (error) {
            console.error('Database connection failed:', error);
            return false;
        }
    }

    public async ensureSchema(): Promise<void> {
        try {
            console.log('Ensuring database schema...');
            
            await this.transaction(async (client) => {
                // Create tokens table if it doesn't exist
                await client.query(`
                    CREATE TABLE IF NOT EXISTS tokens (
                        id SERIAL PRIMARY KEY,
                        mint VARCHAR(255) UNIQUE NOT NULL,
                        contract_address VARCHAR(255) UNIQUE NOT NULL,
                        name VARCHAR(255),
                        symbol VARCHAR(50),
                        creator VARCHAR(255),
                        source VARCHAR(50) DEFAULT 'pump',
                        launch_time TIMESTAMP,
                        decimals INT NOT NULL DEFAULT 0,
                        supply BIGINT NOT NULL DEFAULT 0,
                        blocktime TIMESTAMPTZ,
                        status VARCHAR(50) DEFAULT 'fresh',
                        metadata_uri TEXT,
                        image_url TEXT,
                        bonding_curve_address TEXT,
                        is_on_curve BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);
                
                // Create marketcaps table if it doesn't exist
                await client.query(`
                    CREATE TABLE IF NOT EXISTS marketcaps (
                        id SERIAL PRIMARY KEY,
                        mint VARCHAR(255) UNIQUE NOT NULL,
                        price_usd DECIMAL(20,8),
                        marketcap DECIMAL(20,2),
                        volume_24h DECIMAL(20,2),
                        liquidity DECIMAL(20,2),
                        price_change_24h DECIMAL(10,4),
                        last_updated TIMESTAMPTZ DEFAULT NOW(),
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);
                
                // Add missing columns if they don't exist
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS mint VARCHAR(255);
                `);
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS name VARCHAR(255);
                `);
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS symbol VARCHAR(50);
                `);
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS creator VARCHAR(255);
                `);
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'pump';
                `);
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS launch_time TIMESTAMP;
                `);
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS decimals INT NOT NULL DEFAULT 0;
                `);
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS supply BIGINT NOT NULL DEFAULT 0;
                `);
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS blocktime TIMESTAMPTZ;
                `);
                
                // Update status values to match the database constraints
                await client.query(`
                    ALTER TABLE tokens ALTER COLUMN status TYPE VARCHAR(50);
                `);
                
                // Fix status constraint to allow 'fresh' and 'active' only
                // First, backfill any legacy statuses into allowed set BEFORE creating constraint
                await client.query(`
                    UPDATE tokens SET status='fresh'
                    WHERE status NOT IN ('fresh','active') OR status IS NULL;
                `);
                
                // Drop old check constraint if it exists
                await client.query(`
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1
                            FROM pg_constraint c
                            JOIN pg_class t ON t.oid = c.conrelid
                            WHERE t.relname = 'tokens' AND c.conname = 'tokens_status_check'
                        ) THEN
                            EXECUTE 'ALTER TABLE tokens DROP CONSTRAINT tokens_status_check';
                        END IF;
                    END $$;
                `);
                
                // Set default status to 'fresh' and make it NOT NULL
                await client.query(`
                    ALTER TABLE tokens
                    ALTER COLUMN status SET DEFAULT 'fresh',
                    ALTER COLUMN status SET NOT NULL;
                `);
                
                // Now create the check constraint with allowed values ONLY
                await client.query(`
                    ALTER TABLE tokens
                    ADD CONSTRAINT tokens_status_check
                    CHECK (status IN ('fresh','active'));
                `);
                
                // Create indexes if they don't exist
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status);
                `);
                
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_tokens_blocktime ON tokens(blocktime DESC NULLS LAST);
                `);
                
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_tokens_contract_address ON tokens(contract_address);
                `);
                
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_tokens_source ON tokens(source);
                `);

                // Make name and symbol nullable for fresh mints without metadata
                await client.query(`
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.columns
                            WHERE table_name='tokens' AND column_name='name' AND is_nullable='NO'
                        ) THEN
                            EXECUTE 'ALTER TABLE tokens ALTER COLUMN name DROP NOT NULL';
                        END IF;

                        IF EXISTS (
                            SELECT 1 FROM information_schema.columns
                            WHERE table_name='tokens' AND column_name='symbol' AND is_nullable='NO'
                        ) THEN
                            EXECUTE 'ALTER TABLE tokens ALTER COLUMN symbol DROP NOT NULL';
                        END IF;
                    END $$;
                `);
                
                // Update source check constraint to allow 'helius'
                await client.query(`
                    ALTER TABLE tokens DROP CONSTRAINT IF EXISTS tokens_source_check;
                    ALTER TABLE tokens ADD CONSTRAINT tokens_source_check 
                    CHECK (source IN ('pump', 'meteora', 'helius'));
                `);
                
                // Add new columns for metadata and bonding curve
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS metadata_uri TEXT;
                `);
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS image_url TEXT;
                `);
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS bonding_curve_address TEXT;
                `);
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS is_on_curve BOOLEAN DEFAULT FALSE;
                `);
                
                // Update status constraint to allow 'curve' status
                await client.query(`
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1
                            FROM pg_constraint c
                            JOIN pg_class t ON t.oid = c.conrelid
                            WHERE t.relname = 'tokens' AND c.conname = 'tokens_status_check'
                        ) THEN
                            EXECUTE 'ALTER TABLE tokens DROP CONSTRAINT tokens_status_check';
                        END IF;
                    END $$;
                `);
                
                await client.query(`
                    ALTER TABLE tokens
                    ADD CONSTRAINT tokens_status_check
                    CHECK (status IN ('fresh','active','curve'));
                `);
            });
            
            console.log('Database schema ensured successfully');
        } catch (error) {
            console.error('Error ensuring database schema:', error);
            throw error;
        }
    }
}

export default DatabaseConnection.getInstance();
