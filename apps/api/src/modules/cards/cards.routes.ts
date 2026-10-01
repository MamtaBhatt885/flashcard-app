import { Router } from 'express';
import { cardsController as c } from './cards.controller.js';

// Mounted at /api/decks/:deckId/cards (mergeParams exposes :deckId to the controller).
export const deckCardsRouter = Router({ mergeParams: true })
  .get('/', c.list) //             200 · 400 · 404
  .post('/', c.create); //         201 · 400 · 404

// Mounted at /api/cards: a card is addressed by its own id once it exists.
export const cardsRouter = Router()
  .get('/:cardId', c.get) //       200 · 400 · 404
  .put('/:cardId', c.update) //    200 · 400 · 404
  .delete('/:cardId', c.remove); // 204 · 400 · 404
