const { Pool } = require('pg');
const config = require('../index').config;

const pool = new Pool(config.db);

module.exports = pool;
