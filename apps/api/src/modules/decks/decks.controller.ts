import { deckDetailSchema, deckInputSchema, deckSummarySchema } from '@flashcards/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { deckParams } from '../../lib/params.js';
import { sendJson } from '../../lib/respond.js';
import { currentUserId } from '../../middleware/authenticate.js';
import { decksService } from './decks.service.js';

const deckListSchema = z.array(deckSummarySchema);

// Controllers own the HTTP boundary: parse params and body into typed values (a ZodError → 400),
// call the service, then send through sendJson, which parses the response with its shared schema.
export const decksController = {
  async list(req: Request, res: Response) {
    sendJson(res, deckListSchema, await decksService.list(currentUserId(req)));
  },
  async get(req: Request, res: Response) {
    const { deckId } = deckParams.parse(req.params);
    sendJson(res, deckDetailSchema, await decksService.get(currentUserId(req), deckId));
  },
  async create(req: Request, res: Response) {
    const input = deckInputSchema.parse(req.body);
    const deck = await decksService.create(currentUserId(req), input);
    res.location(`/api/decks/${deck.id}`);
    sendJson(res, deckDetailSchema, deck, 201);
  },
  async update(req: Request, res: Response) {
    const { deckId } = deckParams.parse(req.params);
    const input = deckInputSchema.parse(req.body);
    sendJson(res, deckSummarySchema, await decksService.update(currentUserId(req), deckId, input));
  },
  async remove(req: Request, res: Response) {
    const { deckId } = deckParams.parse(req.params);
    await decksService.remove(currentUserId(req), deckId);
    res.status(204).end();
  },
};
