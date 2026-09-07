import { Router } from 'express';
import { pool } from '../../config/database.js';
import { requireAuthenticatedUser } from '../auth/session.js';
export const documentRouter = Router(); documentRouter.use(requireAuthenticatedUser);
documentRouter.get('/', async (request, response, next) => { try {
  const documents = await pool.query(`SELECT id, title, description, file_name, access_level, published_at FROM documents WHERE published_at IS NOT NULL AND access_level IN ('public','client') ORDER BY published_at DESC`);
  return response.json({ documents: documents.rows });
} catch (error) { return next(error); } });
