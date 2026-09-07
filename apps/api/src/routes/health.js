import { Router } from 'express';
import { pool } from '../config/database.js';

export const healthRouter = Router();

healthRouter.get('/', async (request, response, next) => {
  try {
    await pool.query('SELECT 1');
    response.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error) {
    next(error);
  }
});
