import { Router } from 'express';
import { pool } from '../../config/database.js';
import { requireAuthenticatedUser } from '../auth/session.js';
export const notificationRouter = Router(); notificationRouter.use(requireAuthenticatedUser);
notificationRouter.get('/', async (request, response, next) => { try { const notifications = await pool.query('SELECT id, title, message, link, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [request.user.id]); return response.json({ notifications: notifications.rows }); } catch (error) { return next(error); } });
notificationRouter.post('/:id/read', async (request, response, next) => { try { await pool.query('UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2', [request.params.id, request.user.id]); return response.status(204).send(); } catch (error) { return next(error); } });
notificationRouter.post('/read-all', async (request, response, next) => { try { await pool.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [request.user.id]); return response.status(204).send(); } catch (error) { return next(error); } });
