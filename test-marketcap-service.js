const { MarketcapUpdaterService } = require('./dist/services/marketcapUpdater');
const { WebSocketService } = require('./dist/api/websocket');
const { tokenRepository } = require('./dist/db/repository');

async function testMarketcapService() {
    console.log('🔍 Testing Marketcap Updater Service...');
    
    try {
        // Test 1: Check if we can get tokens from database
        console.log('\n📊 Test 1: Getting tokens from database...');
        const tokens = await tokenRepository.getAllTokens();
        console.log(`✅ Found ${tokens.length} tokens in database`);
        
        if (tokens.length > 0) {
            const sampleToken = tokens[0];
            console.log(`📝 Sample token: ${sampleToken.mint} (${sampleToken.name || 'No name'})`);
            console.log(`📅 Created: ${sampleToken.created_at}`);
            console.log(`💰 Current price_usd: ${sampleToken.price_usd}`);
            console.log(`📈 Current marketcap: ${sampleToken.marketcap}`);
        }
        
        // Test 2: Check if tokens are eligible for updates
        console.log('\n🎯 Test 2: Checking token eligibility...');
        const now = Date.now();
        const eligibleTokens = tokens.filter(token => {
            const tokenAge = now - new Date(token.created_at).getTime();
            const isOldEnough = tokenAge > 10000; // 10 seconds
            console.log(`   ${token.mint}: age=${Math.round(tokenAge/1000)}s, eligible=${isOldEnough}`);
            return isOldEnough;
        });
        
        console.log(`✅ ${eligibleTokens.length} tokens are eligible for updates`);
        
        // Test 3: Test Birdeye API call directly
        if (eligibleTokens.length > 0) {
            console.log('\n🌐 Test 3: Testing Birdeye API call...');
            const testToken = eligibleTokens[0];
            const apiKey = process.env.BIRDEYE_API_KEY || 'your_birdeye_api_key_here';
            
            const response = await fetch(`https://public-api.birdeye.so/defi/price?address=${testToken.mint}&ui_amount_mode=raw`, {
                headers: { 
                    'X-API-KEY': apiKey,
                    'x-chain': 'solana',
                    'accept': 'application/json'
                }
            });
            
            const data = await response.json();
            console.log(`✅ Birdeye API response: ${JSON.stringify(data, null, 2)}`);
        }
        
    } catch (error) {
        console.error('❌ Error testing marketcap service:', error);
    }
}

testMarketcapService();

