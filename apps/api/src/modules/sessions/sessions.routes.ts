import { Router } from 'express';
import { sessionsController as c } from './sessions.controller.js';

// Mounted at /api/decks/:deckId/sessions (mergeParams exposes :deckId to the controller).
export const deckSessionsRouter = Router({ mergeParams: true })
  .get('/', c.listForDeck) //                    200 · 400 · 404
  .post('/', c.start); //                        201 (200 if nothing due) · 400 · 404

// Mounted at /api/sessions.
export const sessionsRouter = Router()
  .get('/:sessionId', c.get) //                  200 · 400 · 404
  .post('/:sessionId/answers', c.answer) //      201 · 400 · 404 · 409
  .post('/:sessionId/complete', c.complete); //  200 · 400 · 404
