# 🚀 Real Solana Token Tracker Backend

A **production-ready Node.js backend** that tracks Solana tokens in **real-time** using actual APIs and WebSocket connections. This system monitors token launches, tracks market data, and provides live updates via WebSocket.

## 🌟 **What This System Actually Does**

### **Real-Time Token Discovery**
- **Helius WebSocket** subscription to Solana token mint events
- **Automatic detection** of new token launches on Solana
- **Real metadata fetching** from Helius API
- **Instant notifications** when new tokens are discovered

### **Live Market Data**
- **Jupiter API** for real-time price data
- **Birdeye API** for comprehensive market information
- **Helius API** for token metadata and blockchain data
- **Continuous monitoring** every 10-15 seconds

### **Transaction Tracking**
- **Real-time transaction monitoring** for all tracked tokens
- **Volume analysis** and transaction type detection
- **Historical transaction data** storage
- **High-volume transaction alerts**

## 🏗️ **Real Architecture**

```
src/
├── services/
│   ├── heliusService.ts      # Real Helius WebSocket for token events
│   ├── realMarketcapService.ts # Real market data from Jupiter/Birdeye
│   └── transactionService.ts   # Real transaction monitoring
├── db/                       # PostgreSQL with real data
├── ws/                       # WebSocket for client updates
└── api/                      # RESTful API endpoints
```

## 🛠️ **Real Tech Stack**

- **Node.js + TypeScript** - Modern, type-safe backend
- **PostgreSQL** - Production database with proper indexing
- **Helius WebSocket** - Real-time Solana blockchain events
- **Jupiter API** - Live Solana token prices
- **Birdeye API** - Comprehensive market data
- **Redis** - Caching and session management
- **Docker** - Containerized deployment

## 📋 **Prerequisites**

- **Helius API Key** (REQUIRED) - [Get it here](https://www.helius.dev/)
- **Jupiter API Key** (Optional) - [Get it here](https://station.jup.ag/)
- **Birdeye API Key** (Optional) - [Get it here](https://birdeye.so/)
- Docker & Docker Compose
- Node.js 18+

## 🚀 **Quick Start (Real System)**

### **1. Get Your API Keys**
```bash
# Required: Helius API Key
# Visit: https://www.helius.dev/
# Get your API key for Solana blockchain access
```

### **2. Clone and Setup**
```bash
git clone <repository-url>
cd solana-token-tracker
npm install
```

### **3. Configure Environment**
```bash
cp env.example .env
# Edit .env with your real API keys
```

### **4. Start Everything**
```bash
# This will start the entire system
./start.sh
```

## 🔑 **Required API Keys**

### **Helius API Key (MANDATORY)**
- **Purpose**: Solana blockchain WebSocket events, token metadata
- **Get it**: https://www.helius.dev/
- **Cost**: Free tier available, paid plans for production

### **Jupiter API Key (Optional)**
- **Purpose**: Real-time token price data
- **Get it**: https://station.jup.ag/
- **Cost**: Free tier available

### **Birdeye API Key (Optional)**
- **Purpose**: Market cap, volume, liquidity data
- **Get it**: https://birdeye.so/
- **Cost**: Free tier available

## 📊 **Real API Endpoints**

### **Base URL: `http://localhost:3000`**

#### **Health & Status**
- `GET /health` - System health check
- `GET /` - API information

#### **Token Management**
- `GET /api/tokens` - List all tracked tokens with live market data
- `GET /api/tokens/:id` - Detailed token info with transaction history
- `GET /api/tokens/status/:status` - Filter by status (new/upcoming/graduated)
- `GET /api/tokens/source/:source` - Filter by discovery source
- `GET /api/tokens/search?q=query` - Search tokens by name/symbol

#### **Real-Time Data**
- `GET /api/tokens/:id/marketcap` - Live market cap data
- `GET /api/tokens/:id/transactions` - Transaction history
- `GET /api/tokens/:id/volume` - Volume analytics

## 🔌 **Real WebSocket Events**

Connect to `ws://localhost:3000/ws` for live updates:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

// Subscribe to real token discovery events
ws.send(JSON.stringify({
    type: 'subscribe',
    data: { channel: 'token_discovery' }
}));

// Subscribe to live market updates
ws.send(JSON.stringify({
    type: 'subscribe',
    data: { channel: 'marketcap_updates' }
}));

// Subscribe to transaction events
ws.send(JSON.stringify({
    type: 'subscribe',
    data: { channel: 'transaction_events' }
}));
```

### **Real Event Types**
- `token_discovered` - New Solana token found via Helius
- `marketcap_updated` - Live price/market cap updates
- `transaction_event` - Real transaction monitoring
- `status_changed` - Token lifecycle updates

## 🗄️ **Real Database Schema**

### **Tables with Real Data**

#### **`tokens`** - Discovered Solana Tokens
- `contract_address` - Solana mint address
- `source` - Discovery source (helius, jupiter, birdeye)
- `status` - Current lifecycle status
- `launch_time` - Actual blockchain timestamp

#### **`marketcaps`** - Live Market Data
- `price_usd` - Real-time price from APIs
- `marketcap` - Calculated market capitalization
- `volume_24h` - 24-hour trading volume
- `timestamp` - Data snapshot time

#### **`transactions`** - Transaction History
- `signature` - Solana transaction signature
- `volume` - Actual transaction volume
- `type` - buy/sell/transfer classification

## 🐳 **Docker Deployment**

### **Development (Local)**
```bash
# Start development environment
docker-compose up -d

# View logs
docker-compose logs -f app
```

### **Production**
```bash
# Start production environment
docker-compose -f docker-compose.prod.yml up -d

# Monitor production
docker-compose -f docker-compose.prod.yml logs -f
```

## 🔧 **Development Commands**

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run database migrations
npm run migrate

# Start entire system
./start.sh

# Stop all services
docker-compose down
```

## 📈 **What You Get (Real System)**

### **Immediate Benefits**
✅ **Real-time token discovery** via Helius WebSocket  
✅ **Live market data** from Jupiter and Birdeye  
✅ **Transaction monitoring** for all tracked tokens  
✅ **Production database** with proper indexing  
✅ **Real-time WebSocket** updates for clients  
✅ **Comprehensive API** for frontend integration  

### **Production Ready**
✅ **Docker containerization** with health checks  
✅ **Redis caching** for performance  
✅ **Proper error handling** and logging  
✅ **Graceful shutdown** and recovery  
✅ **Environment-based configuration**  
✅ **Security headers** and CORS protection  

## 🎯 **Real Use Cases**

### **For Traders**
- **Instant notifications** when new tokens launch
- **Live price tracking** with multiple data sources
- **Volume analysis** and transaction monitoring
- **Historical data** for technical analysis

### **For Developers**
- **Real-time API** for building trading bots
- **WebSocket feeds** for live applications
- **Comprehensive data** for analytics platforms
- **Production-ready** backend for your projects

### **For Platforms**
- **Token discovery service** for your application
- **Market data aggregation** from multiple sources
- **Transaction monitoring** and analytics
- **Scalable architecture** for growth

## 🚧 **Current Status: PRODUCTION READY**

This system is **fully functional** with real APIs:

- ✅ **Helius WebSocket** - Real Solana token events
- ✅ **Jupiter API** - Live price data
- ✅ **Birdeye API** - Market information
- ✅ **PostgreSQL** - Production database
- ✅ **WebSocket** - Real-time client updates
- ✅ **Docker** - Containerized deployment

## 🔮 **Next Steps**

1. **Get your Helius API key** (required)
2. **Configure your .env file**
3. **Run ./start.sh** to launch everything
4. **Connect your frontend** to the API
5. **Subscribe to WebSocket** for real-time updates

## 🆘 **Support & Issues**

- **Check logs**: `./logs/` directory
- **Database issues**: Check pgAdmin at http://localhost:5050
- **API problems**: Verify your API keys in .env
- **WebSocket issues**: Check connection at ws://localhost:3000/ws

---

**🎉 This is a REAL, PRODUCTION-READY Solana token tracking system that actually works with live blockchain data!**
