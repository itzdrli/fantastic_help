import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import bcrypt from 'bcrypt';

export default fp(async function(fastify) {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET
  });

  fastify.decorate('authenticate', async function(request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.decorate('isAdmin', async function(request, reply) {
    if (request.user.role !== 'ADMIN') {
      reply.code(403).send({ error: 'Forbidden' });
    }
  });
});