import { createReadStream } from 'fs';
import { basename } from 'path';

export default async function(fastify) {
  fastify.get('/:ticketId/:filename', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { ticketId, filename } = request.params;
    
    const file = await fastify.prisma.file.findFirst({
      where: {
        ticketId,
        filename
      }
    });

    if (!file) {
      reply.code(404).send({ error: 'File not found' });
      return;
    }

    const stream = createReadStream(file.path);
    reply.type('application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${basename(file.filename)}"`);
    return stream;
  });
}