const { Pool } = require('pg');

let pool = null;

const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : false,
      max: 1, // Serverless functions should use minimal connections
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
};

const connectDB = async () => {
  try {
    const client = await getPool().connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('Database connected successfully');
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};

// Query wrapper for serverless
const query = async (text, params) => {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

module.exports = {
  connectDB,
  query,
  db: {
    query,
    // Add knex-like methods if needed
    select: (table) => {
      // Simplified implementation
      return {
        where: (conditions) => {
          // Build and execute query
          return query(`SELECT * FROM ${table} WHERE ...`, []);
        }
      };
    }
  }
};