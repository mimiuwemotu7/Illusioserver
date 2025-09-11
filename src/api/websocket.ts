import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { logger } from '../utils/logger';

export class WebSocketService {
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();

    constructor(server: Server) {
        this.wss = new WebSocketServer({ server, path: '/ws' });
        this.setupWebSocketServer();
    }

    private setupWebSocketServer() {
        this.wss.on('connection', (ws: WebSocket) => {
            logger.info('New WebSocket client connected');
            this.clients.add(ws);

            // Send initial connection confirmation
            ws.send(JSON.stringify({
                type: 'connected',
                message: 'Connected to live mint feed'
            }));

            ws.on('close', () => {
                logger.info('WebSocket client disconnected');
                this.clients.delete(ws);
            });

            ws.on('error', (error) => {
                logger.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });

        logger.info('WebSocket server started on /ws');
    }

    // Broadcast new token to all connected clients
    public broadcastNewToken(token: any) {
        const message = JSON.stringify({
            type: 'new_token',
            data: token
        });

        let successCount = 0;
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                    successCount++;
                } catch (error) {
                    logger.error('Error sending WebSocket message:', error);
                    this.clients.delete(client);
                }
            } else {
                this.clients.delete(client);
            }
        });

        logger.info(`🔥 Broadcasted new token to ${successCount}/${this.clients.size} clients: ${token.mint}`);
    }

    // Broadcast token update to all connected clients
    public broadcastTokenUpdate(token: any) {
        const message = JSON.stringify({
            type: 'token_update',
            data: token
        });

        let successCount = 0;
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                    successCount++;
                } catch (error) {
                    logger.error('Error sending WebSocket message:', error);
                    this.clients.delete(client);
                }
            } else {
                this.clients.delete(client);
            }
        });

        logger.debug(`Broadcasted token update to ${successCount}/${this.clients.size} clients: ${token.mint}`);
    }

    public getConnectedClients(): number {
        return this.clients.size;
    }

    // Broadcast price alert to all connected clients
    public broadcastPriceAlert(priceAlert: any) {
        const message = JSON.stringify({
            type: 'price_alert',
            data: priceAlert
        });

        let successCount = 0;
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                    successCount++;
                } catch (error) {
                    logger.error('Error sending price alert:', error);
                    this.clients.delete(client);
                }
            } else {
                this.clients.delete(client);
            }
        });

        logger.debug(`Broadcasted price alert to ${successCount}/${this.clients.size} clients: ${priceAlert.mint}`);
    }
}
