import { pino } from 'pino';
import { env } from '../config/env.js';

// JSON logs everywhere. In development, `npm run dev` pipes them through pino-pretty,
// so the pretty-printer stays a devDependency and never loads in production.
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
});
