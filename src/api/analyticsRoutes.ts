import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/analyticsService';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/analytics/session - Track user session
router.post('/session', async (req: Request, res: Response) => {
    try {
        const { sessionId, userAgent, ip } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }
        
        const analyticsService = AnalyticsService.getInstance();
        await analyticsService.trackSession(sessionId, ip || req.ip, userAgent || req.get('User-Agent'));
        
        return res.json({ success: true });
    } catch (error) {
        logger.error('Error tracking session:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/analytics/pageview - Track page view
router.post('/pageview', async (req: Request, res: Response) => {
    try {
        const { sessionId, pagePath, pageTitle, referrer } = req.body;
        
        if (!sessionId || !pagePath) {
            return res.status(400).json({ error: 'Session ID and page path are required' });
        }
        
        const analyticsService = AnalyticsService.getInstance();
        await analyticsService.trackPageView(sessionId, pagePath, pageTitle, referrer);
        
        return res.json({ success: true });
    } catch (error) {
        logger.error('Error tracking page view:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/analytics/feature - Track feature usage
router.post('/feature', async (req: Request, res: Response) => {
    try {
        const { sessionId, featureName, action, metadata } = req.body;
        
        if (!sessionId || !featureName || !action) {
            return res.status(400).json({ error: 'Session ID, feature name, and action are required' });
        }
        
        const analyticsService = AnalyticsService.getInstance();
        await analyticsService.trackFeatureUsage(sessionId, featureName, action, metadata);
        
        return res.json({ success: true });
    } catch (error) {
        logger.error('Error tracking feature usage:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/analytics/activity - Track general activity
router.post('/activity', async (req: Request, res: Response) => {
    try {
        const { sessionId, activityType } = req.body;
        
        if (!sessionId || !activityType) {
            return res.status(400).json({ error: 'Session ID and activity type are required' });
        }
        
        const analyticsService = AnalyticsService.getInstance();
        await analyticsService.trackApiCall(sessionId, `/api/analytics/activity`, 'POST', undefined, 200, undefined);
        
        return res.json({ success: true });
    } catch (error) {
        logger.error('Error tracking activity:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
