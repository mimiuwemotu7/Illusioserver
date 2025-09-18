const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'solana_tokens',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function testConnection() {
  const client = await pool.connect();
  try {
    console.log('🔌 Testing database connection...');
    
    // Test basic connection
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful!');
    console.log('📅 Current time:', result.rows[0].current_time);
    
    // Check if marketcaps table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'marketcaps'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ marketcaps table exists');
      
      // Check if dev_holding_percentage column exists
      const columnCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'marketcaps' 
          AND column_name = 'dev_holding_percentage'
        );
      `);
      
      if (columnCheck.rows[0].exists) {
        console.log('✅ dev_holding_percentage column exists');
      } else {
        console.log('⚠️ dev_holding_percentage column does not exist yet');
        console.log('💡 The column will be added when the server starts');
      }
    } else {
      console.log('⚠️ marketcaps table does not exist yet');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('💡 Make sure the database server is running');
    console.log('💡 You can start it with: docker compose up -d postgres');
  } finally {
    client.release();
    await pool.end();
  }
}

testConnection()
  .then(() => {
    console.log('🎉 Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
