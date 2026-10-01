import { cardInputSchema, cardSchema } from '@flashcards/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { cardParams, deckParams } from '../../lib/params.js';
import { sendJson } from '../../lib/respond.js';
import { currentUserId } from '../../middleware/authenticate.js';
import { cardsService } from './cards.service.js';

const cardListSchema = z.array(cardSchema);

export const cardsController = {
  async list(req: Request, res: Response) {
    const { deckId } = deckParams.parse(req.params);
    sendJson(res, cardListSchema, await cardsService.list(currentUserId(req), deckId));
  },
  async create(req: Request, res: Response) {
    const { deckId } = deckParams.parse(req.params);
    const input = cardInputSchema.parse(req.body);
    const card = await cardsService.create(currentUserId(req), deckId, input);
    res.location(`/api/cards/${card.id}`);
    sendJson(res, cardSchema, card, 201);
  },
  async get(req: Request, res: Response) {
    const { cardId } = cardParams.parse(req.params);
    sendJson(res, cardSchema, await cardsService.get(currentUserId(req), cardId));
  },
  async update(req: Request, res: Response) {
    const { cardId } = cardParams.parse(req.params);
    const input = cardInputSchema.parse(req.body);
    sendJson(res, cardSchema, await cardsService.update(currentUserId(req), cardId, input));
  },
  async remove(req: Request, res: Response) {
    const { cardId } = cardParams.parse(req.params);
    await cardsService.remove(currentUserId(req), cardId);
    res.status(204).end();
  },
};
