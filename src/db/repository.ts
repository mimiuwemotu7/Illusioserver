import { Token, MarketCap, TokenWithMarketCap } from './types';
import { logger } from '../utils/logger';
import db from './connection';

export class TokenRepository {

    async createToken(
        mint: string, 
        decimals: number, 
        supply: number, 
        blocktime: Date, 
        name?: string, 
        symbol?: string,
        metadataUri?: string,
        imageUrl?: string,
        bondingCurveAddress?: string,
        isOnCurve: boolean = false,
        status: 'fresh' | 'active' | 'curve' = 'fresh'
    ): Promise<Token> {
        const query = `
            INSERT INTO tokens (
                mint, 
                name, 
                symbol, 
                source, 
                decimals, 
                supply, 
                blocktime, 
                status,
                metadata_uri,
                image_url,
                bonding_curve_address,
                is_on_curve
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (mint) DO UPDATE SET
                name = COALESCE(tokens.name, EXCLUDED.name),
                symbol = COALESCE(tokens.symbol, EXCLUDED.symbol),
                metadata_uri = COALESCE(tokens.metadata_uri, EXCLUDED.metadata_uri),
                image_url = COALESCE(tokens.image_url, EXCLUDED.image_url),
                bonding_curve_address = COALESCE(tokens.bonding_curve_address, EXCLUDED.bonding_curve_address),
                is_on_curve = EXCLUDED.is_on_curve OR tokens.is_on_curve,
                status = CASE
                    WHEN tokens.status = 'active' THEN 'active'
                    ELSE EXCLUDED.status
                END
            RETURNING *
        `;
        
        try {
            const source = 'helius';
            
            const result = await db.query(query, [
                mint, 
                name, 
                symbol, 
                source, 
                decimals, 
                supply, 
                blocktime, 
                status,
                metadataUri,
                imageUrl,
                bondingCurveAddress,
                isOnCurve
            ]);
            logger.info(`Created new token: ${mint} status=${status} curve=${isOnCurve}`);
            return result.rows[0];
        } catch (error: any) {
            logger.error(`Error creating token ${mint}:`, error);
            throw error;
        }
    }

    async findByMint(mint: string): Promise<Token | null> {
        const query = 'SELECT id, name, symbol, mint, creator, source, decimals, supply, blocktime, status, metadata_uri, image_url, bonding_curve_address, is_on_curve, created_at, updated_at FROM tokens WHERE mint = $1';
        const result = await db.query(query, [mint]);
        return result.rows[0] || null;
    }

    async searchTokens(query: string, limit: number = 50): Promise<TokenWithMarketCap[]> {
        const searchQuery = `
            SELECT t.*, 
                COALESCE(t.name, t.symbol, SUBSTRING(t.mint,1,4) || '…' || SUBSTRING(t.mint FROM LENGTH(t.mint)-3)) AS display_name,
                m.price_usd, m.marketcap, m.volume_24h, m.liquidity
            FROM tokens t
            LEFT JOIN LATERAL (
                SELECT * FROM marketcaps 
                WHERE token_id = t.id 
                ORDER BY timestamp DESC 
                LIMIT 1
            ) m ON true
            WHERE (
                LOWER(t.name) ILIKE $1 
                OR LOWER(t.symbol) ILIKE $1 
                OR LOWER(t.mint) ILIKE $1
            )
            ORDER BY 
                CASE 
                    WHEN LOWER(t.name) ILIKE $1 THEN 1
                    WHEN LOWER(t.symbol) ILIKE $1 THEN 2
                    WHEN LOWER(t.mint) ILIKE $1 THEN 3
                    ELSE 4
                END,
                COALESCE(t.blocktime, t.created_at) DESC
            LIMIT $2
        `;
        
        const searchTerm = `%${query.toLowerCase()}%`;
        const result = await db.query(searchQuery, [searchTerm, limit]);
        return result.rows;
    }

    async findTokenByMint(mint: string): Promise<TokenWithMarketCap | null> {
        const query = `
            SELECT t.*, 
                COALESCE(t.name, t.symbol, SUBSTRING(t.mint,1,4) || '…' || SUBSTRING(t.mint FROM LENGTH(t.mint)-3)) AS display_name,
                m.price_usd, m.marketcap, m.volume_24h, m.liquidity
            FROM tokens t
            LEFT JOIN LATERAL (
                SELECT * FROM marketcaps 
                WHERE token_id = t.id 
                ORDER BY timestamp DESC 
                LIMIT 1
            ) m ON true
            WHERE LOWER(t.mint) = LOWER($1)
            LIMIT 1
        `;
        
        const result = await db.query(query, [mint]);
        return result.rows[0] || null;
    }

    async findFreshTokens(limit: number = 100, offset: number = 0): Promise<TokenWithMarketCap[]> {
        const query = `
            SELECT t.*, 
                COALESCE(t.name, t.symbol, SUBSTRING(t.mint,1,4) || '…' || SUBSTRING(t.mint FROM LENGTH(t.mint)-3)) AS display_name,
                m.price_usd, m.marketcap, m.volume_24h, m.liquidity
            FROM tokens t
            LEFT JOIN LATERAL (
                SELECT * FROM marketcaps 
                WHERE token_id = t.id 
                ORDER BY timestamp DESC 
                LIMIT 1
            ) m ON true
            WHERE t.status = 'fresh' 
            ORDER BY COALESCE(t.blocktime, t.created_at) DESC 
            LIMIT $1 OFFSET $2
        `;
        const result = await db.query(query, [limit, offset]);
        return result.rows;
    }

    async countFreshTokens(): Promise<number> {
        const query = `SELECT COUNT(*)::int AS count FROM tokens WHERE status = 'fresh'`;
        const result = await db.query(query);
        return result.rows[0]?.count || 0;
    }

    async findActiveTokens(limit: number = 100, offset: number = 0): Promise<TokenWithMarketCap[]> {
        const query = `
            SELECT t.*, m.price_usd, m.marketcap, m.volume_24h, m.liquidity
            FROM tokens t
            LEFT JOIN LATERAL (
                SELECT * FROM marketcaps 
                WHERE token_id = t.id 
                ORDER BY timestamp DESC 
                LIMIT 1
            ) m ON true
            WHERE t.status = 'active'
            ORDER BY m.marketcap DESC NULLS LAST
            LIMIT $1 OFFSET $2
        `;
        const result = await db.query(query, [limit, offset]);
        return result.rows;
    }

    async findTokensByStatus(status: string, limit: number = 100, offset: number = 0): Promise<TokenWithMarketCap[]> {
        const query = `
            SELECT t.*, 
                COALESCE(t.name, t.symbol, SUBSTRING(t.mint,1,4) || '…' || SUBSTRING(t.mint FROM LENGTH(t.mint)-3)) AS display_name,
                m.price_usd, m.marketcap, m.volume_24h, m.liquidity
            FROM tokens t
            LEFT JOIN LATERAL (
                SELECT * FROM marketcaps 
                WHERE token_id = t.id 
                ORDER BY timestamp DESC 
                LIMIT 1
            ) m ON true
            WHERE t.status = $1 
            ORDER BY COALESCE(t.blocktime, t.created_at) DESC 
            LIMIT $2 OFFSET $3
        `;
        const result = await db.query(query, [status, limit, offset]);
        return result.rows;
    }

    async countActiveTokens(): Promise<number> {
        const query = `SELECT COUNT(*)::int AS count FROM tokens WHERE status = 'active'`;
        const result = await db.query(query);
        return result.rows[0]?.count || 0;
    }


    async updateTokenMetadata(
        id: number, 
        name?: string, 
        symbol?: string, 
        metadataUri?: string, 
        imageUrl?: string,
        bondingCurveAddress?: string,
        isOnCurve?: boolean
    ): Promise<void> {
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (symbol !== undefined) {
            updates.push(`symbol = $${paramCount++}`);
            values.push(symbol);
        }
        if (metadataUri !== undefined) {
            updates.push(`metadata_uri = $${paramCount++}`);
            values.push(metadataUri);
        }
        if (imageUrl !== undefined) {
            updates.push(`image_url = $${paramCount++}`);
            values.push(imageUrl);
        }
        if (bondingCurveAddress !== undefined) {
            updates.push(`bonding_curve_address = $${paramCount++}`);
            values.push(bondingCurveAddress);
        }
        if (isOnCurve !== undefined) {
            updates.push(`is_on_curve = $${paramCount++}`);
            values.push(isOnCurve);
        }

        if (updates.length === 0) return;

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const query = `UPDATE tokens SET ${updates.join(', ')} WHERE id = $${paramCount}`;
        await db.query(query, values);
        logger.info(`Updated token ${id} metadata`);
    }

    async findMintsNeedingMetadata(limit: number): Promise<string[]> {
        const { rows } = await db.query(
            `
            SELECT mint
            FROM tokens
            WHERE
                (name IS NULL OR name = '')
                OR (symbol IS NULL OR symbol = '')
                OR (metadata_uri IS NULL OR metadata_uri = '')
                OR (image_url IS NULL OR image_url = '')
            ORDER BY blocktime DESC NULLS LAST
            LIMIT $1
            `,
            [limit]
        );
        return rows.map((r: any) => r.mint);
    }

    async findMintsNeedingSocialLinks(limit: number): Promise<string[]> {
        const { rows } = await db.query(
            `
            SELECT mint
            FROM tokens
            WHERE
                metadata_uri IS NOT NULL 
                AND metadata_uri != ''
                AND (
                    website IS NULL 
                    OR twitter IS NULL 
                    OR telegram IS NULL 
                    OR source = 'helius'
                )
            ORDER BY blocktime DESC NULLS LAST
            LIMIT $1
            `,
            [limit]
        );
        return rows.map((r: any) => r.mint);
    }

    async getTokenByMint(mint: string): Promise<Token | null> {
        const { rows } = await db.query(
            `SELECT id, name, symbol, mint, creator, source, decimals, supply, blocktime, status, metadata_uri, image_url, bonding_curve_address, is_on_curve, created_at, updated_at FROM tokens WHERE mint = $1`,
            [mint]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async updateTokenMetadataByMint(
        mint: string,
        fields: {
            name?: string; 
            symbol?: string;
            metadata_uri?: string; 
            image_url?: string;
            website?: string;
            twitter?: string;
            telegram?: string;
            source?: string;
        }
    ): Promise<void> {
        const q = `
            UPDATE tokens SET
                name = COALESCE($2, name),
                symbol = COALESCE($3, symbol),
                metadata_uri = COALESCE($4, metadata_uri),
                image_url = COALESCE($5, image_url),
                website = COALESCE($6, website),
                twitter = COALESCE($7, twitter),
                telegram = COALESCE($8, telegram),
                source = COALESCE($9, source)
            WHERE mint = $1
        `;
        await db.query(q, [
            mint,
            fields.name ?? null,
            fields.symbol ?? null,
            fields.metadata_uri ?? null,
            fields.image_url ?? null,
            fields.website ?? null,
            fields.twitter ?? null,
            fields.telegram ?? null,
            fields.source ?? null
        ]);
        logger.info(`Updated token ${mint} metadata`);
    }

    async getAllTokens(): Promise<TokenWithMarketCap[]> {
        const query = `
            SELECT t.id, t.name, t.symbol, t.mint, t.creator, t.source, 
                   t.decimals, t.supply, t.blocktime, t.status, t.metadata_uri, 
                   t.image_url, t.bonding_curve_address, t.is_on_curve, t.created_at, 
                   t.updated_at,
                   m.price_usd, m.marketcap, m.volume_24h, m.liquidity
            FROM tokens t
            LEFT JOIN LATERAL (
                SELECT price_usd, marketcap, volume_24h, liquidity
                FROM marketcaps 
                WHERE token_id = t.id 
                ORDER BY timestamp DESC 
                LIMIT 1
            ) m ON true
            ORDER BY t.created_at DESC
        `;
        const result = await db.query(query);
        return result.rows;
    }

    async getTokensByStatus(status: 'fresh' | 'active' | 'curve'): Promise<Token[]> {
        const query = `
            SELECT id, name, symbol, mint, creator, source, decimals, supply, blocktime, status, metadata_uri, image_url, bonding_curve_address, is_on_curve, created_at, updated_at FROM tokens 
            WHERE status = $1 
            ORDER BY created_at DESC
        `;
        const result = await db.query(query, [status]);
        return result.rows;
    }

    async updateTokenStatus(mint: string, status: 'fresh' | 'active' | 'curve'): Promise<void> {
        const query = `
            UPDATE tokens 
            SET status = $1, updated_at = NOW()
            WHERE mint = $2
        `;
        await db.query(query, [status, mint]);
    }

    // Insert or replace all holders for a mint in one tx
    async upsertTokenHoldersByMint(mint: string, rows: { owner: string; amount: number; raw_amount: string }[]) {
        const client = await db.getClient();
        try {
            await client.query("BEGIN");
            await client.query("DELETE FROM token_holders WHERE mint = $1", [mint]);

            if (rows.length) {
                // bulk insert
                const values: string[] = [];
                const params: any[] = [];
                rows.forEach((r, i) => {
                    const p = i * 4;
                    values.push(`($${p+1}, $${p+2}, $${p+3}, $${p+4})`);
                    params.push(mint, r.owner, r.amount, r.raw_amount);
                });
                await client.query(
                    `INSERT INTO token_holders (mint, owner, amount, raw_amount) VALUES ${values.join(",")}`,
                    params
                );
            }

            await client.query(
                `INSERT INTO token_holder_summary(mint, holder_count, updated_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (mint) DO UPDATE SET holder_count = EXCLUDED.holder_count, updated_at = NOW()`,
                [mint, rows.length]
            );

            await client.query("COMMIT");
        } catch (e) {
            await client.query("ROLLBACK");
            throw e;
        } finally {
            client.release();
        }
    }

    async getTopHolders(mint: string, limit = 50) {
        const { rows } = await db.query(
            `SELECT owner, amount FROM token_holders WHERE mint = $1 ORDER BY amount DESC LIMIT $2`,
            [mint, limit]
        );
        return rows;
    }

    async getWalletPositions(owner: string, minAmount = 0) {
        const { rows } = await db.query(
            `SELECT mint, amount FROM token_holders WHERE owner = $1 AND amount > $2 ORDER BY amount DESC`,
            [owner, minAmount]
        );
        return rows;
    }

    async findRecentActiveMints(limit = 50): Promise<string[]> {
        const { rows } = await db.query(
            `SELECT mint FROM tokens WHERE status = 'active' ORDER BY updated_at DESC LIMIT $1`,
            [limit]
        );
        return rows.map((r: any) => r.mint);
    }
}

export class MarketCapRepository {

    async createMarketCap(tokenId: number, priceUsd: number, marketcap: number, volume24h: number, liquidity: number): Promise<MarketCap> {
        const query = `
            INSERT INTO marketcaps (token_id, price_usd, marketcap, volume_24h, liquidity)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        
        const result = await db.query(query, [tokenId, priceUsd, marketcap, volume24h, liquidity]);
        logger.info(`Created marketcap record for token ${tokenId}`);
        return result.rows[0];
    }

    async findLatestByTokenId(tokenId: number): Promise<MarketCap | null> {
        const query = `
            SELECT * FROM marketcaps 
            WHERE token_id = $1 
            ORDER BY timestamp DESC 
            LIMIT 1
        `;
        const result = await db.query(query, [tokenId]);
        return result.rows[0] || null;
    }

    async getLatestMarketCap(tokenId: number): Promise<MarketCap | null> {
        // Alias for findLatestByTokenId for consistency
        return this.findLatestByTokenId(tokenId);
    }

    async findHistoryByTokenId(tokenId: number, limit: number = 100): Promise<MarketCap[]> {
        const query = `
            SELECT * FROM marketcaps
            WHERE token_id = $1 
            ORDER BY timestamp DESC 
            LIMIT $2
        `;
        const result = await db.query(query, [tokenId, limit]);
        return result.rows;
    }

    async findByMint(mint: string): Promise<TokenWithMarketCap | null> {
        const query = `
            SELECT t.id, t.name, t.symbol, t.mint, t.creator, t.source, 
                   t.decimals, t.supply, t.blocktime, t.status, t.metadata_uri, 
                   t.image_url, t.bonding_curve_address, t.is_on_curve, t.created_at, 
                   t.updated_at,
                   m.price_usd, m.marketcap, m.volume_24h, m.liquidity, m.timestamp as marketcap_timestamp
            FROM tokens t
            LEFT JOIN LATERAL (
                SELECT price_usd, marketcap, volume_24h, liquidity, timestamp
                FROM marketcaps 
                WHERE token_id = t.id 
                ORDER BY timestamp DESC 
                LIMIT 1
            ) m ON true
            WHERE t.mint = $1
        `;
        const result = await db.query(query, [mint]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const row = result.rows[0];
        return {
            id: row.id,
            name: row.name,
            symbol: row.symbol,
            mint: row.mint,
            creator: row.creator,
            source: row.source,
            launch_time: row.launch_time,
            decimals: row.decimals,
            supply: row.supply,
            blocktime: row.blocktime,
            status: row.status,
            metadata_uri: row.metadata_uri,
            image_url: row.image_url,
            bonding_curve_address: row.bonding_curve_address,
            is_on_curve: row.is_on_curve,
            created_at: row.created_at,
            updated_at: row.updated_at,
            display_name: row.display_name,
            latest_marketcap: row.marketcap_timestamp ? {
                id: 0, // This would need to be properly set if we had the marketcap id
                token_id: row.id,
                price_usd: row.price_usd,
                marketcap: row.marketcap,
                volume_24h: row.volume_24h,
                liquidity: row.liquidity,
                timestamp: row.marketcap_timestamp
            } : undefined
        };
    }

}

// Export singleton instances
export const tokenRepository = new TokenRepository();
export const marketCapRepository = new MarketCapRepository();
