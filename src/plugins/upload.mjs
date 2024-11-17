import fp from 'fastify-plugin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multipart from '@fastify/multipart';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../uploads');

export default fp(async function(fastify) {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  fastify.register(multipart);

  fastify.decorate('saveFile', async function(file, ticketId) {
    const ticketDir = path.join(uploadDir, ticketId);
    if (!fs.existsSync(ticketDir)) {
      fs.mkdirSync(ticketDir, { recursive: true });
    }

    const filename = `${file.filename}`;
    const filepath = path.join(ticketDir, filename);
    
    await fs.promises.writeFile(filepath, await file.toBuffer());
    
    return {
      filename: filename,
      path: filepath
    };
  });
});