// Middleware to verify JWT token
const jwt = require('jsonwebtoken');
const config = require('../index').config;

const authenticateToken = async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const user = jwt.verify(token, config.security.jwtSecret);
    request.user = user;
  } catch (err) {
    return reply.code(403).send({ error: 'Forbidden' });
  }
};

// Middleware to check if user is admin
const isAdmin = async (request, reply) => {
  if (request.user.role !== 'admin') {
    return reply.code(403).send({ error: 'Forbidden - Admin access required' });
  }
};

module.exports = { authenticateToken, isAdmin };
