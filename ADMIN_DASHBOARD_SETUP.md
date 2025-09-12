# 🔐 ILLUSIO Admin Dashboard Setup

A comprehensive admin dashboard for monitoring user activity, system health, and analytics without interfering with the main user interface.

## 🚀 **Quick Setup**

### **1. Set Admin Key**
```bash
# Add to your .env file
ADMIN_KEY=your-super-secure-admin-key-here
```

### **2. Run Database Migration**
```bash
cd server
npm run build
node dist/db/migrate-admin-tables.js
```

### **3. Start Server**
```bash
npm start
```

### **4. Access Dashboard**
- **URL**: `http://localhost:8080/admin/admin-dashboard.html`
- **Login**: Use your `ADMIN_KEY` from the .env file

## 📊 **What You Can Monitor**

### **Real-time Metrics**
- Active users (last 5 minutes)
- API calls per minute
- System health status
- Memory usage and uptime

### **Analytics Data**
- User sessions and page views
- Feature usage (Scope, Oracle, Manifesto, etc.)
- Geographic distribution
- Top pages and endpoints

### **Token Discovery**
- Tokens discovered by time range
- Discovery sources (Helius, Pump.fun, etc.)
- Token status distribution
- Recent token discoveries

### **System Health**
- Database connectivity
- Recent errors and status codes
- API response times
- System resource usage

## 🔧 **API Endpoints**

All admin endpoints require the `X-Admin-Key` header:

### **Analytics**
- `GET /api/admin/analytics?range=day` - Analytics overview
- `GET /api/admin/realtime` - Real-time metrics
- `GET /api/admin/sessions` - User sessions
- `GET /api/admin/page-views` - Page view data
- `GET /api/admin/api-calls` - API call logs
- `GET /api/admin/feature-usage` - Feature usage data

### **System**
- `GET /api/admin/health` - System health check
- `GET /api/admin/tokens` - Token discovery metrics
- `GET /api/admin/export?format=csv` - Export data

## 🛡️ **Security Features**

### **Authentication**
- Admin key required for all endpoints
- Simple but effective access control
- No user interface interference

### **Data Privacy**
- IP addresses are tracked but not exposed in UI
- User agents logged for debugging
- Geographic data optional (requires IP geolocation service)

### **Rate Limiting**
- Built-in request tracking
- Response time monitoring
- Error rate monitoring

## 📈 **Usage Examples**

### **Monitor Peak Usage**
```bash
curl -H "X-Admin-Key: your-key" \
  http://localhost:8080/api/admin/realtime
```

### **Export Analytics**
```bash
curl -H "X-Admin-Key: your-key" \
  http://localhost:8080/api/admin/export?format=csv > analytics.csv
```

### **Check System Health**
```bash
curl -H "X-Admin-Key: your-key" \
  http://localhost:8080/api/admin/health
```

## 🔄 **Auto-refresh Features**

- **Real-time metrics**: Updates every 30 seconds
- **Analytics data**: Refreshable by time range
- **System health**: Live monitoring
- **Charts**: Auto-updating (when implemented)

## 🎯 **Key Benefits**

1. **Non-intrusive**: Runs separately from main UI
2. **Real-time**: Live monitoring of user activity
3. **Comprehensive**: Tracks all user interactions
4. **Secure**: Admin-only access with key authentication
5. **Exportable**: Data can be exported for analysis
6. **Scalable**: Handles high user volumes efficiently

## 🚨 **Important Notes**

- **Admin Key**: Keep your admin key secure and don't commit it to version control
- **Database**: Admin tables are created automatically on first run
- **Performance**: Analytics collection has minimal impact on main application
- **Storage**: Old analytics data is automatically cleaned up (24 hours for real-time data)

## 🔧 **Customization**

### **Add Custom Metrics**
```typescript
// In analyticsService.ts
await db.query(`
    INSERT INTO system_metrics (metric_name, metric_value, metric_unit)
    VALUES ('custom_metric', $1, 'count')
`, [value]);
```

### **Track Custom Features**
```typescript
// In your components
analyticsService.trackFeatureUsage(sessionId, 'custom_feature', 'action', { metadata });
```

### **Add Custom Charts**
```javascript
// In admin-dashboard.html
// Add new chart containers and update the updateCharts() function
```

## 🆘 **Troubleshooting**

### **Dashboard Not Loading**
- Check if admin key is set in .env
- Verify database migration completed successfully
- Check server logs for errors

### **No Data Showing**
- Ensure analytics service is running
- Check if users are actually using the site
- Verify database tables exist

### **Performance Issues**
- Check database indexes are created
- Monitor memory usage
- Consider cleaning old data

## 📞 **Support**

For issues with the admin dashboard:
1. Check server logs for errors
2. Verify database connectivity
3. Ensure admin key is correctly set
4. Check if all required tables exist

The admin dashboard provides comprehensive monitoring without affecting your main application's performance or user experience.
