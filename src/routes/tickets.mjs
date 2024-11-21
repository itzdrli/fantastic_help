import { formatDate } from '../utils/date.mjs';

export default async function (fastify) {
  // Create ticket
  fastify.post('/', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const ticket = await fastify.prisma.ticket.create({
      data: {
        title: request.body.title,
        creatorId: request.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    return {
      ...ticket,
      createdAt: formatDate(ticket.createdAt),
      updatedAt: formatDate(ticket.updatedAt)
    };
  });

  // Close ticket
  fastify.patch('/:id/close', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const ticket = await fastify.prisma.ticket.update({
      where: { id: request.params.id },
      data: { status: 'CLOSED' }
    });

    return ticket;
  });

  // Add reply
  fastify.post('/:id/replies', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const files = [];
    const base_url = process.env.BASE_URL || `${request.protocol}://${request.hostname}`;

    if (request.isMultipart()) {
      const parts = await request.parts();

      let content = '';
      for await (const part of parts) {
        if (part.file) {
          // 保存文件到本地
          const savedFile = await fastify.saveFile(part, request.params.id);
          
          // 构建文件的URL路径
          const fileUrl = `${base_url}/files/${request.params.id}/${savedFile.filename}`;
          
          files.push({
            ...savedFile,
            path: savedFile.path,  // 保留本地路径
            url: fileUrl          // 添加URL路径
          });
        } else if (part.type === 'field' && part.fieldname === 'content') {
          content = part.value;
        } else {
          console.log(part)
        }
      }

      if (content) {
        const ticket = await fastify.prisma.ticket.findUnique({
          where: { id: request.params.id },
          include: {
            creator: true
          }
        });

        if (!ticket) {
          reply.code(404).send({ error: 'Ticket not found' });
          return;
        }

        const replyData = await fastify.prisma.reply.create({
          data: {
            content,
            ticketId: ticket.id,
            userId: request.user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            files: {
              create: files.map(file => ({
                filename: file.filename,
                path: file.path,    // 本地路径
                url: file.url,      // URL路径
                createdAt: new Date(),
                ticketId: ticket.id
              }))
            }
          },
          include: {
            files: true
          }
        });

        return {
          ...replyData,
          createdAt: formatDate(replyData.createdAt),
          updatedAt: formatDate(replyData.updatedAt),
          files: replyData.files.map(file => ({
            ...file,
            createdAt: formatDate(file.createdAt)
          }))
        };
      } else {
        reply.code(400).send({ error: 'No content provided' });
      }
    } else {
      reply.code(400).send({ error: 'Multipart request expected' });
    }
  });

  // Get ticket route
  fastify.get('/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const ticket = await fastify.prisma.ticket.findUnique({
      where: { id: request.params.id },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatar: true,
            createdAt: true
          }
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            },
            files: true
          }
        },
        attachments: true
      }
    });

    if (!ticket) {
      reply.code(404).send({ error: 'Ticket not found' });
      return;
    }

    // Build participants object
    const participants = {};
    // Add ticket creator
    participants[ticket.creator.id] = {
      name: ticket.creator.username,
      avatarUrl: ticket.creator.avatar
    };
    // Add reply authors
    ticket.replies.forEach(reply => {
      if (!participants[reply.user.id]) {
        participants[reply.user.id] = {
          name: reply.user.username,
          avatarUrl: reply.user.avatar
        };
      }
    });

    // Build timeline
    const timeline = [
      {
        label: 'Opened',
        timestamp: ticket.createdAt.toISOString()
      }
    ];

    // Add replies to timeline
    ticket.replies.forEach(reply => {
      timeline.push({
        label: 'Replied',
        timestamp: reply.createdAt.toISOString(),
        userId: reply.user.id
      });
    });

    // Add closed status if applicable
    if (ticket.status === 'CLOSED') {
      timeline.push({
        label: 'Closed',
        timestamp: ticket.updatedAt.toISOString()
      });
    }

    const conversation = [];
    ticket.replies.forEach(reply => {
      conversation.push({
        senderId: reply.user.id,
        timestamp: reply.createdAt.toISOString(),
        content: {
          type: 'text',
          text: reply.content
        }
      });

      reply.files.forEach(file => {
        conversation.push({
          senderId: reply.user.id,
          timestamp: reply.createdAt.toISOString(),
          content: {
            type: getFileType(file.filename),
            name: file.filename,
            url: file.url,
            file_type: getFileExtension(file.filename),
            size: 0
          }
        });
      });
    });

    // Calculate duration (if needed)
    const duration = timeline[timeline.length - 1]
      ? new Date(timeline[timeline.length - 1].timestamp).getTime() - new Date(timeline[0].timestamp).getTime()
      : 0;

    const formattedTicket = {
      ticketId: ticket.id,
      asker: ticket.creator.id,
      parameters: {
        duration: duration
      },
      participants,
      timeline,
      conversation
    };

    return formattedTicket;
  });
}

function getFileType(filename) {
  const ext = getFileExtension(filename).toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
    return 'image';
  }
  return 'file';
}

function getFileExtension(filename) {
  return filename.split('.').pop();
}