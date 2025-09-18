export interface Token {
    id: number;
    name?: string;
    symbol?: string;
    mint: string;
    creator?: string;
    source: string;
    launch_time?: Date;
    decimals: number;
    supply: number;
    blocktime: Date | null;
    status: 'fresh' | 'active' | 'curve';
    metadata_uri?: string;
    image_url?: string;
    bonding_curve_address?: string;
    is_on_curve: boolean;
    created_at: Date;
    updated_at: Date;
    display_name?: string;
}

export interface MarketCap {
    id: number;
    token_id: number;
    price_usd: number;
    marketcap: number;
    volume_24h: number;
    liquidity: number;
    dev_holding_percentage: number;
    timestamp: Date;
}

export interface TokenWithMarketCap extends Token {
    latest_marketcap?: MarketCap;
    // Marketcap data at root level for consistency
    price_usd?: number;
    marketcap?: number;
    volume_24h?: number;
    liquidity?: number;
    dev_holding_percentage?: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
