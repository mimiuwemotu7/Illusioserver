import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { AnalyticsService } from '../services/analyticsService';
import db from '../db/connection';

const router = Router();
const analyticsService = AnalyticsService.getInstance();

// Simple admin authentication middleware
const adminAuth = (req: Request, res: Response, next: any) => {
    const adminKey = req.headers['x-admin-key'] as string;
    const expectedKey = process.env.ADMIN_KEY || 'admin123'; // Set this in your .env
    
    if (!adminKey || adminKey !== expectedKey) {
        return res.status(401).json({ error: 'Unauthorized - Admin access required' });
    }
    
    next();
};

// Apply admin auth to all routes
router.use(adminAuth);

// Get analytics overview
router.get('/analytics', async (req: Request, res: Response) => {
    try {
        const timeRange = (req.query.range as string) || 'day';
        const analytics = await analyticsService.getAnalyticsData(timeRange as any);
        
        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        logger.error('Error getting analytics:', error);
        res.status(500).json({ error: 'Failed to get analytics data' });
    }
});

// Get real-time metrics
router.get('/realtime', async (req: Request, res: Response) => {
    try {
        const metrics = await analyticsService.getRealtimeMetrics();
        
        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        logger.error('Error getting real-time metrics:', error);
        res.status(500).json({ error: 'Failed to get real-time metrics' });
    }
});

// Get user sessions
router.get('/sessions', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        
        const query = `
            SELECT 
                session_id,
                ip_address,
                user_agent,
                country,
                city,
                created_at,
                last_activity,
                is_active,
                total_page_views,
                total_api_calls
            FROM user_sessions 
            ORDER BY last_activity DESC 
            LIMIT $1 OFFSET $2
        `;
        
        const result = await db.query(query, [limit, offset]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error getting sessions:', error);
        res.status(500).json({ error: 'Failed to get sessions' });
    }
});

// Get page views
router.get('/page-views', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const timeRange = req.query.range as string || '24 hours';
        
        const query = `
            SELECT 
                pv.page_path,
                pv.page_title,
                pv.referrer,
                pv.view_duration,
                pv.created_at,
                us.ip_address,
                us.country,
                us.city
            FROM page_views pv
            JOIN user_sessions us ON pv.session_id = us.session_id
            WHERE pv.created_at > CURRENT_TIMESTAMP - INTERVAL '${timeRange}'
            ORDER BY pv.created_at DESC 
            LIMIT $1
        `;
        
        const result = await db.query(query, [limit]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error getting page views:', error);
        res.status(500).json({ error: 'Failed to get page views' });
    }
});

// Get API calls
router.get('/api-calls', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const timeRange = req.query.range as string || '24 hours';
        
        const query = `
            SELECT 
                ac.endpoint,
                ac.method,
                ac.response_time,
                ac.status_code,
                ac.error_message,
                ac.created_at,
                us.ip_address,
                us.country
            FROM api_calls ac
            JOIN user_sessions us ON ac.session_id = us.session_id
            WHERE ac.created_at > CURRENT_TIMESTAMP - INTERVAL '${timeRange}'
            ORDER BY ac.created_at DESC 
            LIMIT $1
        `;
        
        const result = await db.query(query, [limit]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error getting API calls:', error);
        res.status(500).json({ error: 'Failed to get API calls' });
    }
});

// Get feature usage
router.get('/feature-usage', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 100;
        const timeRange = req.query.range as string || '24 hours';
        
        const query = `
            SELECT 
                fu.feature_name,
                fu.action,
                fu.metadata,
                fu.created_at,
                us.ip_address,
                us.country
            FROM feature_usage fu
            JOIN user_sessions us ON fu.session_id = us.session_id
            WHERE fu.created_at > CURRENT_TIMESTAMP - INTERVAL '${timeRange}'
            ORDER BY fu.created_at DESC 
            LIMIT $1
        `;
        
        const result = await db.query(query, [limit]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error getting feature usage:', error);
        res.status(500).json({ error: 'Failed to get feature usage' });
    }
});

// Get system health
router.get('/health', async (req: Request, res: Response) => {
    try {
        // Database health
        const dbHealth = await db.query('SELECT NOW() as timestamp');
        
        // System metrics
        const systemMetrics = await db.query(`
            SELECT metric_name, metric_value, created_at
            FROM system_metrics 
            WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
            ORDER BY created_at DESC
        `);
        
        // Recent errors
        const recentErrors = await db.query(`
            SELECT endpoint, error_message, created_at
            FROM api_calls 
            WHERE status_code >= 400 
            AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        res.json({
            success: true,
            data: {
                database: {
                    status: 'healthy',
                    timestamp: dbHealth.rows[0].timestamp
                },
                systemMetrics: systemMetrics.rows,
                recentErrors: recentErrors.rows,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date()
            }
        });
    } catch (error) {
        logger.error('Error getting system health:', error);
        res.status(500).json({ error: 'Failed to get system health' });
    }
});

// Get token discovery metrics
router.get('/tokens', async (req: Request, res: Response) => {
    try {
        const timeRange = req.query.range as string || '24 hours';
        
        // Tokens discovered in time range
        const tokensDiscovered = await db.query(`
            SELECT COUNT(*) as count
            FROM tokens 
            WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${timeRange}'
        `);
        
        // Tokens by source
        const tokensBySource = await db.query(`
            SELECT source, COUNT(*) as count
            FROM tokens 
            WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${timeRange}'
            GROUP BY source
            ORDER BY count DESC
        `);
        
        // Tokens by status
        const tokensByStatus = await db.query(`
            SELECT status, COUNT(*) as count
            FROM tokens 
            WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${timeRange}'
            GROUP BY status
            ORDER BY count DESC
        `);
        
        // Recent tokens
        const recentTokens = await db.query(`
            SELECT mint, name, symbol, source, status, created_at
            FROM tokens 
            WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${timeRange}'
            ORDER BY created_at DESC
            LIMIT 20
        `);
        
        res.json({
            success: true,
            data: {
                totalDiscovered: parseInt(tokensDiscovered.rows[0].count),
                bySource: tokensBySource.rows,
                byStatus: tokensByStatus.rows,
                recentTokens: recentTokens.rows
            }
        });
    } catch (error) {
        logger.error('Error getting token metrics:', error);
        res.status(500).json({ error: 'Failed to get token metrics' });
    }
});

// Export analytics data
router.get('/export', async (req: Request, res: Response) => {
    try {
        const format = req.query.format as string || 'json';
        const timeRange = req.query.range as string || '24 hours';
        
        if (format === 'csv') {
            // Export as CSV
            const sessions = await db.query(`
                SELECT * FROM user_sessions 
                WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '${timeRange}'
                ORDER BY created_at DESC
            `);
            
            // Convert to CSV
            const csvHeaders = 'session_id,ip_address,user_agent,country,city,created_at,last_activity,is_active,total_page_views,total_api_calls\n';
            const csvRows = sessions.rows.map(row => 
                `${row.session_id},${row.ip_address || ''},${row.user_agent || ''},${row.country || ''},${row.city || ''},${row.created_at},${row.last_activity},${row.is_active},${row.total_page_views},${row.total_api_calls}`
            ).join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.csv');
            res.send(csvHeaders + csvRows);
        } else {
            // Export as JSON
            const analytics = await analyticsService.getAnalyticsData('day');
            res.json({
                success: true,
                data: analytics,
                exportedAt: new Date()
            });
        }
    } catch (error) {
        logger.error('Error exporting analytics:', error);
        res.status(500).json({ error: 'Failed to export analytics' });
    }
});

export default router;
