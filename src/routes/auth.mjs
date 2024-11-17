import bcrypt from 'bcrypt';

export default async function(fastify) {
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password', 'avatar'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
          avatar: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { username, password, avatar } = request.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await fastify.prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        avatar
      }
    });

    const token = fastify.jwt.sign({ id: user.id, role: user.role });
    
    return { token };
  });

  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { username, password } = request.body;
    
    const user = await fastify.prisma.user.findUnique({
      where: { username }
    });

    if (!user || !await bcrypt.compare(password, user.password)) {
      reply.code(401).send({ error: 'Invalid credentials' });
      return;
    }

    const token = fastify.jwt.sign({ id: user.id, role: user.role });
    
    return { token };
  });
}