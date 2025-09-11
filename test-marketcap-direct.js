const fetch = require('node-fetch');

async function testMarketcapUpdater() {
    console.log('Testing marketcap updater...');
    
    // Test token from the API
    const testToken = '2crTr6xotpD1mMJFGahieCx4A4EkQr8mzU35M4Nbpump';
    
    try {
        // Test Birdeye API directly
        console.log('Testing Birdeye API...');
        const response = await fetch(`https://public-api.birdeye.so/defi/price?address=${testToken}&ui_amount_mode=raw`, {
            headers: { 
                'X-API-KEY': process.env.BIRDEYE_API_KEY || 'your_birdeye_api_key_here',
                'x-chain': 'solana',
                'accept': 'application/json'
            }
        });
        
        const data = await response.json();
        console.log('Birdeye API response:', data);
        
        if (data.success && data.data) {
            const price = data.data.value;
            const marketcap = price * 1000000000; // 1 billion supply
            console.log(`Price: $${price}`);
            console.log(`Calculated Marketcap: $${marketcap}`);
        }
        
        // Test our API
        console.log('\nTesting our API...');
        const ourResponse = await fetch('http://localhost:8080/api/tokens/fresh');
        const ourData = await ourResponse.json();
        
        const token = ourData.items.find(t => t.mint === testToken);
        if (token) {
            console.log('Our API token data:', {
                mint: token.mint,
                name: token.name,
                marketcap: token.marketcap,
                price_usd: token.price_usd,
                volume_24h: token.volume_24h
            });
        } else {
            console.log('Token not found in our API');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testMarketcapUpdater();
