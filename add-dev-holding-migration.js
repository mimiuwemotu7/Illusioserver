const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'quantum_geometry',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function addDevHoldingColumn() {
  const client = await pool.connect();
  try {
    console.log('🔧 Adding dev_holding_percentage column to marketcaps table...');
    
    // Add the column if it doesn't exist
    await client.query(`
      ALTER TABLE marketcaps 
      ADD COLUMN IF NOT EXISTS dev_holding_percentage DECIMAL(5, 2) DEFAULT 0
    `);
    
    console.log('✅ Column added successfully!');
    
    // Add index for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_marketcaps_dev_holding 
      ON marketcaps(dev_holding_percentage)
    `);
    
    console.log('✅ Index created successfully!');
    
    // Update existing records to have 0 as default value
    await client.query(`
      UPDATE marketcaps 
      SET dev_holding_percentage = 0 
      WHERE dev_holding_percentage IS NULL
    `);
    
    console.log('✅ Existing records updated!');
    
    // Verify the column exists
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'marketcaps' 
      AND column_name = 'dev_holding_percentage'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verification successful! Column details:', result.rows[0]);
    } else {
      console.log('❌ Column not found after creation');
    }
    
  } catch (error) {
    console.error('❌ Error adding column:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addDevHoldingColumn()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
