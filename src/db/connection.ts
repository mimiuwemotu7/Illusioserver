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
            max: 3, // Severely reduced for Railway stability
            min: 1,  // Minimal connections
            idleTimeoutMillis: 30000, // Reduced to 30 seconds
            connectionTimeoutMillis: 10000, // Reduced to 10 seconds
            allowExitOnIdle: false,
            // Add query timeout to prevent hanging queries
            statement_timeout: 8000, // 8 second query timeout
            query_timeout: 8000, // 8 second query timeout
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

    // Add connection pool monitoring for performance tracking
    public getPoolStats(): { totalCount: number; idleCount: number; waitingCount: number } {
        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount
        };
    }

    public async query(text: string, params?: any[], maxRetries = 3): Promise<any> {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Add timeout wrapper for individual queries
                const queryPromise = this.executeQuery(text, params);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Query timeout')), 8000)
                );
                
                const result = await Promise.race([queryPromise, timeoutPromise]);
                return result;
            } catch (error: any) {
                lastError = error;
                console.error(`Database query attempt ${attempt}/${maxRetries} failed:`, error.message);
                
                if (error.message?.includes('Cannot use a pool after calling end on the pool') || 
                    error.message?.includes('timeout exceeded when trying to connect')) {
                    
                    if (attempt < maxRetries) {
                        console.log(`Recreating database pool and retrying in ${attempt * 1000}ms...`);
                        this.recreatePool();
                        
                        // Exponential backoff
                        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                        continue;
                    }
                }
                
                // If it's the last attempt or not a connection error, throw immediately
                if (attempt === maxRetries) {
                    break;
                }
                
                // Wait before retry for other errors
                await new Promise(resolve => setTimeout(resolve, attempt * 500));
            }
        }
        
        throw lastError;
    }

    private async executeQuery(text: string, params?: any[]): Promise<any> {
        let client;
        try {
            client = await this.getClient();
            const result = await client.query(text, params);
            return result;
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
            max: 3, // Severely reduced for Railway stability
            min: 1,  // Minimal connections
            idleTimeoutMillis: 30000, // Reduced to 30 seconds
            connectionTimeoutMillis: 10000, // Reduced to 10 seconds
            allowExitOnIdle: false,
            // Add query timeout to prevent hanging queries
            statement_timeout: 8000, // 8 second query timeout
            query_timeout: 8000, // 8 second query timeout
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
                        token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
                        price_usd DECIMAL(20, 8),
                        marketcap DECIMAL(20, 2),
                        volume_24h DECIMAL(20, 2),
                        liquidity DECIMAL(20, 2),
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS website VARCHAR(255);
                `);
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS twitter VARCHAR(255);
                `);
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS telegram VARCHAR(255);
                `);
                
                await client.query(`
                    ALTER TABLE tokens ADD COLUMN IF NOT EXISTS token_id VARCHAR(255);
                `);
                
                // Remove contract_address column if it exists (legacy cleanup)
                await client.query(`
                    ALTER TABLE tokens DROP COLUMN IF EXISTS contract_address;
                `);
                
                // Add unique constraints if they don't exist
                await client.query(`
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint 
                            WHERE conname = 'tokens_mint_unique'
                        ) THEN
                            ALTER TABLE tokens ADD CONSTRAINT tokens_mint_unique UNIQUE (mint);
                        END IF;
                    END $$;
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
                
                // Remove contract_address index if it exists (legacy cleanup)
                await client.query(`
                    DROP INDEX IF EXISTS idx_tokens_contract_address;
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
                
                // Update source check constraint to allow all sources
                await client.query(`
                    ALTER TABLE tokens DROP CONSTRAINT IF EXISTS tokens_source_check;
                    ALTER TABLE tokens ADD CONSTRAINT tokens_source_check 
                    CHECK (source IN ('pump', 'meteora', 'helius', 'pump.fun'));
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

                // Create analytics tables
                await client.query(`
                    CREATE TABLE IF NOT EXISTS user_sessions (
                        id SERIAL PRIMARY KEY,
                        session_id VARCHAR(255) UNIQUE NOT NULL,
                        ip_address INET,
                        user_agent TEXT,
                        country VARCHAR(100),
                        city VARCHAR(100),
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        last_activity TIMESTAMPTZ DEFAULT NOW(),
                        is_active BOOLEAN DEFAULT TRUE,
                        total_page_views INTEGER DEFAULT 0,
                        total_api_calls INTEGER DEFAULT 0
                    );
                `);

                await client.query(`
                    CREATE TABLE IF NOT EXISTS page_views (
                        id SERIAL PRIMARY KEY,
                        session_id VARCHAR(255) NOT NULL REFERENCES user_sessions(session_id) ON DELETE CASCADE,
                        page_path VARCHAR(500) NOT NULL,
                        page_title VARCHAR(500),
                        referrer VARCHAR(500),
                        view_duration INTEGER,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                await client.query(`
                    CREATE TABLE IF NOT EXISTS api_calls (
                        id SERIAL PRIMARY KEY,
                        session_id VARCHAR(255) NOT NULL REFERENCES user_sessions(session_id) ON DELETE CASCADE,
                        endpoint VARCHAR(500) NOT NULL,
                        method VARCHAR(10) NOT NULL,
                        response_time INTEGER,
                        status_code INTEGER,
                        error_message TEXT,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                await client.query(`
                    CREATE TABLE IF NOT EXISTS feature_usage (
                        id SERIAL PRIMARY KEY,
                        session_id VARCHAR(255) NOT NULL REFERENCES user_sessions(session_id) ON DELETE CASCADE,
                        feature_name VARCHAR(100) NOT NULL,
                        action VARCHAR(100) NOT NULL,
                        metadata JSONB,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                await client.query(`
                    CREATE TABLE IF NOT EXISTS system_metrics (
                        id SERIAL PRIMARY KEY,
                        metric_name VARCHAR(100) NOT NULL,
                        metric_value DECIMAL(20, 8),
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                await client.query(`
                    CREATE TABLE IF NOT EXISTS realtime_analytics (
                        id SERIAL PRIMARY KEY,
                        metric_type VARCHAR(50) NOT NULL,
                        value INTEGER NOT NULL,
                        timestamp TIMESTAMPTZ DEFAULT NOW()
                    );
                `);

                // Create indexes for analytics tables
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity DESC);
                `);

                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
                `);

                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_api_calls_created_at ON api_calls(created_at DESC);
                `);

                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_feature_usage_created_at ON feature_usage(created_at DESC);
                `);

                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_system_metrics_created_at ON system_metrics(created_at DESC);
                `);

                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_realtime_analytics_timestamp ON realtime_analytics(timestamp DESC);
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
