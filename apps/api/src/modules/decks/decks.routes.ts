import { Router } from 'express';
import { deckCardsRouter } from '../cards/cards.routes.js';
import { deckSessionsRouter } from '../sessions/sessions.routes.js';
import { decksController as c } from './decks.controller.js';

// Mounted at /api/decks (all routes require auth). Routes map URLs to controllers, nothing else.
export const decksRouter = Router()
  .get('/', c.list) //                  200
  .post('/', c.create) //               201 · 400 · 409
  .get('/:deckId', c.get) //            200 · 400 · 404
  .put('/:deckId', c.update) //         200 · 400 · 404 · 409
  .delete('/:deckId', c.remove) //      204 · 400 · 404
  // Nested collections belong to their own modules:
  .use('/:deckId/cards', deckCardsRouter)
  .use('/:deckId/sessions', deckSessionsRouter);
