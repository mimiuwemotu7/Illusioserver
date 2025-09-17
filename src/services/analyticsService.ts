import { logger } from '../utils/logger';
import db from '../db/connection';

export interface UserSession {
    sessionId: string;
    ipAddress?: string;
    userAgent?: string;
    country?: string;
    city?: string;
    createdAt: Date;
    lastActivity: Date;
    isActive: boolean;
    totalPageViews: number;
    totalApiCalls: number;
}

export interface PageView {
    sessionId: string;
    pagePath: string;
    pageTitle?: string;
    referrer?: string;
    viewDuration?: number;
    createdAt: Date;
}

export interface ApiCall {
    sessionId: string;
    endpoint: string;
    method: string;
    responseTime?: number;
    statusCode?: number;
    errorMessage?: string;
    createdAt: Date;
}

export interface FeatureUsage {
    sessionId: string;
    featureName: string;
    action: string;
    metadata?: any;
    createdAt: Date;
}

export class AnalyticsService {
    private static instance: AnalyticsService;
    private isRunning = false;
    private intervalId?: NodeJS.Timeout;

    public static getInstance(): AnalyticsService {
        if (!AnalyticsService.instance) {
            AnalyticsService.instance = new AnalyticsService();
        }
        return AnalyticsService.instance;
    }

    // Track user session
    async trackSession(sessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
        try {
            const query = `
                INSERT INTO user_sessions (session_id, ip_address, user_agent, last_activity)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                ON CONFLICT (session_id) DO UPDATE SET
                    last_activity = CURRENT_TIMESTAMP,
                    is_active = true
            `;
            await db.query(query, [sessionId, ipAddress, userAgent]);
        } catch (error: any) {
            // Don't log full error details for analytics to avoid spam
            if (error.message?.includes('timeout')) {
                logger.warn('Analytics session tracking timeout - skipping');
            } else {
                logger.error('Error tracking session:', error.message);
            }
        }
    }

    // Track page view
    async trackPageView(sessionId: string, pagePath: string, pageTitle?: string, referrer?: string): Promise<void> {
        try {
            const query = `
                INSERT INTO page_views (session_id, page_path, page_title, referrer)
                VALUES ($1, $2, $3, $4)
            `;
            await db.query(query, [sessionId, pagePath, pageTitle, referrer]);

            // Update session page view count
            await db.query(`
                UPDATE user_sessions 
                SET total_page_views = total_page_views + 1, last_activity = CURRENT_TIMESTAMP
                WHERE session_id = $1
            `, [sessionId]);
        } catch (error: any) {
            if (error.message?.includes('timeout')) {
                logger.warn('Analytics page view tracking timeout - skipping');
            } else {
                logger.error('Error tracking page view:', error.message);
            }
        }
    }

    // Track API call
    async trackApiCall(sessionId: string, endpoint: string, method: string, responseTime?: number, statusCode?: number, errorMessage?: string): Promise<void> {
        try {
            // First ensure the session exists
            await this.ensureSessionExists(sessionId);

            const query = `
                INSERT INTO api_calls (session_id, endpoint, method, response_time, status_code, error_message)
                VALUES ($1, $2, $3, $4, $5, $6)
            `;
            await db.query(query, [sessionId, endpoint, method, responseTime, statusCode, errorMessage]);

            // Update session API call count
            await db.query(`
                UPDATE user_sessions 
                SET total_api_calls = total_api_calls + 1, last_activity = CURRENT_TIMESTAMP
                WHERE session_id = $1
            `, [sessionId]);
        } catch (error: any) {
            if (error.message?.includes('timeout')) {
                logger.warn('Analytics API call tracking timeout - skipping');
            } else {
                logger.error('Error tracking API call:', error.message);
            }
        }
    }

    // Ensure session exists before tracking API calls
    private async ensureSessionExists(sessionId: string): Promise<void> {
        try {
            // Check if session exists
            const checkQuery = `SELECT session_id FROM user_sessions WHERE session_id = $1`;
            const result = await db.query(checkQuery, [sessionId]);
            
            if (result.rows.length === 0) {
                // Create session if it doesn't exist
                const insertQuery = `
                    INSERT INTO user_sessions (session_id, ip_address, user_agent, created_at, last_activity)
                    VALUES ($1, 'unknown', 'unknown', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT (session_id) DO NOTHING
                `;
                await db.query(insertQuery, [sessionId]);
            }
        } catch (error: any) {
            logger.warn('Error ensuring session exists:', error.message);
        }
    }

    // Track feature usage
    async trackFeatureUsage(sessionId: string, featureName: string, action: string, metadata?: any): Promise<void> {
        try {
            // First ensure the session exists
            await this.ensureSessionExists(sessionId);

            const query = `
                INSERT INTO feature_usage (session_id, feature_name, action, metadata)
                VALUES ($1, $2, $3, $4)
            `;
            await db.query(query, [sessionId, featureName, action, JSON.stringify(metadata)]);
        } catch (error: any) {
            if (error.message?.includes('timeout')) {
                logger.warn('Analytics feature usage tracking timeout - skipping');
            } else {
                logger.error('Error tracking feature usage:', error.message);
            }
        }
    }

    // Get analytics data
    async getAnalyticsData(timeRange: 'hour' | 'day' | 'week' | 'month' = 'day') {
        try {
            const timeIntervals = {
                hour: "1 hour",
                day: "24 hours",
                week: "7 days",
                month: "30 days"
            };

            const interval = timeIntervals[timeRange];

            // Active users
            const activeUsersQuery = `
                SELECT COUNT(*) as count
                FROM user_sessions 
                WHERE last_activity > CURRENT_TIMESTAMP - INTERVAL '${interval}'
            `;
            const activeUsers = await db.query(activeUsersQuery);

            // Total page views
            const pageViewsQuery = `
                SELECT COUNT(*) as count
                FROM page_views 
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${interval}'
            `;
            const pageViews = await db.query(pageViewsQuery);

            // Total API calls
            const apiCallsQuery = `
                SELECT COUNT(*) as count
                FROM api_calls 
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${interval}'
            `;
            const apiCalls = await db.query(apiCallsQuery);

            // Top pages
            const topPagesQuery = `
                SELECT page_path, COUNT(*) as views
                FROM page_views 
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${interval}'
                GROUP BY page_path
                ORDER BY views DESC
                LIMIT 10
            `;
            const topPages = await db.query(topPagesQuery);

            // Top features
            const topFeaturesQuery = `
                SELECT feature_name, action, COUNT(*) as usage_count
                FROM feature_usage 
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${interval}'
                GROUP BY feature_name, action
                ORDER BY usage_count DESC
                LIMIT 10
            `;
            const topFeatures = await db.query(topFeaturesQuery);

            // API endpoint usage
            const topEndpointsQuery = `
                SELECT endpoint, method, COUNT(*) as call_count, AVG(response_time) as avg_response_time
                FROM api_calls 
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${interval}'
                GROUP BY endpoint, method
                ORDER BY call_count DESC
                LIMIT 10
            `;
            const topEndpoints = await db.query(topEndpointsQuery);

            // Geographic distribution
            const geoQuery = `
                SELECT country, city, COUNT(*) as user_count
                FROM user_sessions 
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${interval}'
                AND country IS NOT NULL
                GROUP BY country, city
                ORDER BY user_count DESC
                LIMIT 10
            `;
            const geoData = await db.query(geoQuery);

            return {
                timeRange,
                activeUsers: parseInt(activeUsers.rows[0].count),
                pageViews: parseInt(pageViews.rows[0].count),
                apiCalls: parseInt(apiCalls.rows[0].count),
                topPages: topPages.rows,
                topFeatures: topFeatures.rows,
                topEndpoints: topEndpoints.rows,
                geoData: geoData.rows
            };
        } catch (error) {
            logger.error('Error getting analytics data:', error);
            throw error;
        }
    }

    // Get real-time metrics
    async getRealtimeMetrics() {
        try {
            // Current active users (last 5 minutes)
            const activeUsersQuery = `
                SELECT COUNT(*) as count
                FROM user_sessions 
                WHERE last_activity > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
            `;
            const activeUsers = await db.query(activeUsersQuery);

            // API calls in last minute
            const apiCallsQuery = `
                SELECT COUNT(*) as count
                FROM api_calls 
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 minute'
            `;
            const apiCalls = await db.query(apiCallsQuery);

            // Current system load (from system_metrics table)
            const systemMetricsQuery = `
                SELECT metric_name, metric_value, created_at
                FROM system_metrics 
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 minute'
                ORDER BY created_at DESC
            `;
            const systemMetrics = await db.query(systemMetricsQuery);

            return {
                activeUsers: parseInt(activeUsers.rows[0].count),
                apiCallsPerMinute: parseInt(apiCalls.rows[0].count),
                systemMetrics: systemMetrics.rows,
                timestamp: new Date()
            };
        } catch (error) {
            logger.error('Error getting real-time metrics:', error);
            throw error;
        }
    }

    // Start real-time metrics collection
    async start() {
        if (this.isRunning) {
            logger.info('Analytics service is already running');
            return;
        }

        logger.info('🚀 Starting Analytics Service...');
        this.isRunning = true;

        // Collect metrics every 30 seconds
        this.intervalId = setInterval(async () => {
            try {
                const metrics = await this.getRealtimeMetrics();
                
                // Store real-time metrics
                await db.query(`
                    INSERT INTO realtime_analytics (metric_type, value, timestamp)
                    VALUES 
                        ('active_users', $1, CURRENT_TIMESTAMP),
                        ('api_calls_per_minute', $2, CURRENT_TIMESTAMP)
                `, [metrics.activeUsers, metrics.apiCallsPerMinute]);

                // Clean up old real-time data (keep last 24 hours)
                await db.query(`
                    DELETE FROM realtime_analytics 
                    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '24 hours'
                `);

            } catch (error) {
                logger.error('Error in analytics collection:', error);
            }
        }, 30000); // Every 30 seconds

        logger.info('✅ Analytics Service started successfully');
    }

    // Stop analytics service
    async stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        this.isRunning = false;
        logger.info('🛑 Analytics Service stopped');
    }
}
