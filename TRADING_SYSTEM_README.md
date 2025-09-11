# 🚀 Complete Solana Trading System

**A production-ready Node.js backend that provides REAL-TIME trading data from Solana AMMs including Raydium, Orca, and Pump.fun.**

## 🌟 **What This System Actually Does NOW**

### **✅ REAL-TIME AMM MONITORING**
- **Raydium Program Logs** - Live monitoring of swap instructions
- **Orca Program Logs** - Real-time swap event detection  
- **Pump.fun Program Logs** - Instant swap notification
- **Swap Instruction Parsing** - Extract buyer, seller, amounts, prices
- **Pool State Tracking** - Monitor DEX pool reserves and liquidity

### **✅ LIVE TRADE DETECTION**
- **Real Buy/Sell Detection** - Parse actual swap instructions (not guessing)
- **Volume Calculation** - Real trade volume from swap amounts
- **Price Calculation** - Live prices from pool ratios
- **Transaction Monitoring** - Track every swap in real-time

### **✅ HOLDER TRACKING**
- **getTokenLargestAccounts** - Real-time holder snapshots
- **Helius Asset Data** - Ownership and supply information
- **Transaction Balance Indexing** - Update holders from postTokenBalances
- **Top Holder Analysis** - Track largest token holders
- **Circulating Supply** - Calculate actual circulating tokens

### **✅ TRADE AGGREGATION ENGINE**
- **Rolling Windows**: 1m, 5m, 15m, 1h, 24h
- **Volume Metrics** - Real-time volume calculations
- **Price Change %** - Live price change tracking
- **Buyer/Seller Counts** - Unique trader tracking
- **Trade Size Analysis** - Largest/smallest trade monitoring

### **✅ POOL STATE MONITORING**
- **DEX Pool Discovery** - Automatically find new pools
- **Reserve Monitoring** - Track pool token reserves
- **Liquidity Calculation** - Real-time liquidity data
- **Price Updates** - Live price change notifications
- **Pool Creation Events** - New pool detection

## 🏗️ **Complete Architecture**

```
src/
├── services/
│   ├── ammMonitorService.ts      # AMM program log monitoring
│   ├── holderService.ts          # Token holder tracking
│   ├── tradeAggregationService.ts # Rolling window metrics
│   ├── poolStateService.ts       # DEX pool monitoring
│   ├── heliusService.ts          # Token discovery
│   ├── realMarketcapService.ts   # Market data
│   └── transactionService.ts     # Transaction monitoring
├── api/
│   ├── tokenRoutes.ts            # Basic token endpoints
│   └── tradingRoutes.ts          # NEW: Trading endpoints
├── db/                           # PostgreSQL database
├── ws/                           # WebSocket for real-time updates
└── index.ts                      # Main server with all services
```

## 🛠️ **Complete Tech Stack**

- **Node.js + TypeScript** - Modern, type-safe backend
- **PostgreSQL** - Production database with proper indexing
- **Solana Web3.js** - Blockchain interaction
- **Helius WebSocket** - Real-time Solana events
- **Jupiter API** - Live Solana token prices
- **Birdeye API** - Comprehensive market data
- **WebSocket** - Real-time client updates
- **Docker** - Containerized deployment

## 📋 **Prerequisites**

- **Helius API Key** (REQUIRED) - [Get it here](https://www.helius.dev/)
- **Jupiter API Key** (Optional) - [Get it here](https://station.jup.ag/)
- **Birdeye API Key** (Optional) - [Get it here](https://birdeye.so/)
- Docker & Docker Compose
- Node.js 18+

## 🚀 **Quick Start (Complete System)**

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
# This will start the ENTIRE trading system
./start.sh
```

## 🔑 **Required API Keys**

### **Helius API Key (MANDATORY)**
- **Purpose**: Solana blockchain WebSocket events, token metadata, AMM monitoring
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

## 📊 **Complete API Endpoints**

### **Base URL: `http://localhost:3000`**

#### **Health & Status**
- `GET /health` - System health check
- `GET /` - API information and trading features

#### **Token Management (Existing)**
- `GET /api/tokens` - List all tracked tokens
- `GET /api/tokens/:id` - Detailed token info
- `GET /api/tokens/status/:status` - Filter by status
- `GET /api/tokens/source/:source` - Filter by discovery source

#### **NEW: Trading System Endpoints**

##### **🔄 AMM Swap Events**
- `GET /api/trading/swaps` - All recent swap events
- `GET /api/trading/swaps/:tokenMint` - Swaps for specific token
- `GET /api/trading/swaps/range?start=X&end=Y` - Swaps by time range

##### **👥 Token Holders**
- `GET /api/trading/holders/:tokenMint` - Complete holder snapshot
- `GET /api/trading/holders/:tokenMint/top?limit=10` - Top holders
- `GET /api/trading/holders/:tokenMint/history?limit=50` - Holder history

##### **📈 Trade Aggregation**
- `GET /api/trading/trades/:tokenMint` - Complete trade metrics
- `GET /api/trading/trades/:tokenMint/metrics/:window` - Specific time window
- `GET /api/trading/trades` - All trade aggregations

##### **🏊 DEX Pools**
- `GET /api/trading/pools` - All pool states
- `GET /api/trading/pools/:tokenMint` - Pools for specific token
- `GET /api/trading/pools/amm/:ammType` - Pools by AMM (raydium/orca/pump_fun)
- `GET /api/trading/pools/summary/:poolAddress` - Pool summary

##### **💰 Price Updates**
- `GET /api/trading/prices` - Recent price changes
- `GET /api/trading/prices/:tokenMint` - Price updates for token

##### **📋 Comprehensive Summary**
- `GET /api/trading/summary/:tokenMint` - Complete token overview

## 🔌 **Real WebSocket Events**

Connect to `ws://localhost:3000/ws` for live updates:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

// Subscribe to real swap events
ws.send(JSON.stringify({
    type: 'subscribe',
    data: { channel: 'swap_event' }
}));

// Subscribe to holder updates
ws.send(JSON.stringify({
    type: 'subscribe',
    data: { channel: 'holder_snapshot' }
}));

// Subscribe to trade aggregation updates
ws.send(JSON.stringify({
    type: 'subscribe',
    data: { channel: 'trade_aggregation_update' }
}));

// Subscribe to pool state updates
ws.send(JSON.stringify({
    type: 'subscribe',
    data: { channel: 'pool_state_update' }
}));

// Subscribe to significant price changes
ws.send(JSON.stringify({
    type: 'subscribe',
    data: { channel: 'significant_price_change' }
}));
```

### **Real Event Types**
- `swap_event` - Live AMM swap events from Raydium/Orca/Pump.fun
- `holder_snapshot` - Real-time holder data updates
- `trade_aggregation_update` - Live trading metrics
- `pool_state_update` - DEX pool state changes
- `significant_price_change` - Price alerts (>5% changes)
- `pool_created` - New pool discovery events

## 🗄️ **Enhanced Database Schema**

### **Tables with Real Trading Data**

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

#### **NEW: Trading System Data**
- **Swap Events** - Real AMM swap data
- **Holder Snapshots** - Token ownership data
- **Trade Aggregations** - Rolling window metrics
- **Pool States** - DEX pool information
- **Price Updates** - Live price change tracking

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

# Start entire trading system
./start.sh

# Stop all services
docker-compose down
```

## 📈 **What You Get (Complete System)**

### **Immediate Benefits**
✅ **Real-time AMM monitoring** via program log parsing  
✅ **Live swap detection** from Raydium, Orca, Pump.fun  
✅ **Holder tracking** with getTokenLargestAccounts  
✅ **Trade aggregation** with rolling time windows  
✅ **Pool state monitoring** for live DEX data  
✅ **Real-time WebSocket** updates for all events  
✅ **Comprehensive API** for frontend integration  

### **Production Ready**
✅ **Docker containerization** with health checks  
✅ **Real-time data processing** with proper error handling  
✅ **Graceful shutdown** and recovery  
✅ **Environment-based configuration**  
✅ **Security headers** and CORS protection  
✅ **Comprehensive logging** and monitoring  

## 🎯 **Real Use Cases (Now Possible)**

### **For Traders**
- **Instant swap notifications** when trades happen
- **Live volume tracking** with multiple time windows
- **Holder analysis** for whale tracking
- **Pool liquidity monitoring** for entry/exit timing
- **Price change alerts** for significant movements

### **For Developers**
- **Real-time trading API** for building bots
- **WebSocket feeds** for live applications
- **Comprehensive data** for analytics platforms
- **Production-ready** backend for trading apps

### **For Platforms**
- **Live trading dashboard** with real-time data
- **Token discovery service** with instant notifications
- **Market data aggregation** from multiple AMMs
- **Scalable architecture** for growth

## 🚧 **Current Status: COMPLETE TRADING SYSTEM**

This system is **fully functional** with real trading capabilities:

- ✅ **AMM Monitoring** - Raydium, Orca, Pump.fun program logs
- ✅ **Swap Detection** - Real buy/sell detection from instructions
- ✅ **Holder Tracking** - getTokenLargestAccounts + transaction indexing
- ✅ **Trade Aggregation** - Rolling windows with live metrics
- ✅ **Pool Monitoring** - DEX pool state and liquidity
- ✅ **Real-time WebSocket** - Live updates for all events
- ✅ **Comprehensive API** - Full trading system endpoints

## 🔮 **Next Steps**

1. **Get your Helius API key** (required)
2. **Configure your .env file**
3. **Run ./start.sh** to launch the complete system
4. **Connect your frontend** to the trading API
5. **Subscribe to WebSocket** for real-time trading data
6. **Build trading applications** with live data

## 🆘 **Support & Issues**

- **Check logs**: `./logs/` directory
- **Database issues**: Check pgAdmin at http://localhost:5050
- **API problems**: Verify your API keys in .env
- **WebSocket issues**: Check connection at ws://localhost:3000/ws
- **Trading data**: Use `/api/trading` endpoints

---

**🎉 This is a COMPLETE, PRODUCTION-READY Solana trading system that provides real-time AMM monitoring, holder tracking, and live trading analytics!**

## 📚 **API Examples**

### **Get Live Swap Events**
```bash
curl "http://localhost:3000/api/trading/swaps?limit=10"
```

### **Get Token Holder Data**
```bash
curl "http://localhost:3000/api/trading/holders/YOUR_TOKEN_MINT"
```

### **Get Trade Metrics (24h)**
```bash
curl "http://localhost:3000/api/trading/trades/YOUR_TOKEN_MINT/metrics/24h"
```

### **Get Pool Information**
```bash
curl "http://localhost:3000/api/trading/pools/YOUR_TOKEN_MINT"
```

### **Get Comprehensive Summary**
```bash
curl "http://localhost:3000/api/trading/summary/YOUR_TOKEN_MINT"
```
