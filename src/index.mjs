import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import cors from '@fastify/cors';
import authPlugin from './plugins/auth.mjs';
import uploadPlugin from './plugins/upload.mjs';
import authRoutes from './routes/auth.mjs';
import ticketRoutes from './routes/tickets.mjs';
import fileRoutes from './routes/files.mjs';

const prisma = new PrismaClient();
const fastify = Fastify({
  logger: true
});

// Register plugins
fastify.register(cors);
fastify.register(authPlugin);
fastify.register(uploadPlugin);

// Decorate fastify instance with prisma client
fastify.decorate('prisma', prisma);

// Register routes
fastify.register(authRoutes, { prefix: '/auth' });
fastify.register(ticketRoutes, { prefix: '/tickets' });
fastify.register(fileRoutes, { prefix: '/files' });

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3888, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();