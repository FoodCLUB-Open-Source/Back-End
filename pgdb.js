/* Establish connection with postgreSQL database */

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_PG_USER,
  host: process.env.DB_PG_HOST,
  database: process.env.DB_PG_NAME,
  password: process.env.DB_PG_PASSWORD,
  port: process.env.DB_PG_PORT,
  ssl: {
    rejectUnauthorized: false,
  },
});

module.exports = pool;