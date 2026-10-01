import {
  answerInputSchema,
  answerResponseSchema,
  completeSessionSchema,
  sessionDetailSchema,
  sessionSummarySchema,
  startSessionResponseSchema,
  startSessionSchema,
} from '@flashcards/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { deckParams, sessionParams } from '../../lib/params.js';
import { sendJson } from '../../lib/respond.js';
import { currentUserId } from '../../middleware/authenticate.js';
import { sessionsService } from './sessions.service.js';

const sessionListSchema = z.array(sessionSummarySchema);

export const sessionsController = {
  async start(req: Request, res: Response) {
    const { deckId } = deckParams.parse(req.params);
    const input = startSessionSchema.parse(req.body); // typed output, with `practice` defaulted
    const result = await sessionsService.start(currentUserId(req), deckId, input);
    // 201 + Location when a session was created; 200 with session:null when nothing was due.
    if (result.session) res.location(`/api/sessions/${result.session.id}`);
    sendJson(res, startSessionResponseSchema, result, result.session ? 201 : 200);
  },
  async listForDeck(req: Request, res: Response) {
    const { deckId } = deckParams.parse(req.params);
    sendJson(res, sessionListSchema, await sessionsService.listForDeck(currentUserId(req), deckId));
  },
  async get(req: Request, res: Response) {
    const { sessionId } = sessionParams.parse(req.params);
    sendJson(res, sessionDetailSchema, await sessionsService.get(currentUserId(req), sessionId));
  },
  async answer(req: Request, res: Response) {
    const { sessionId } = sessionParams.parse(req.params);
    const input = answerInputSchema.parse(req.body);
    sendJson(res, answerResponseSchema, await sessionsService.answer(currentUserId(req), sessionId, input), 201);
  },
  async complete(req: Request, res: Response) {
    const { sessionId } = sessionParams.parse(req.params);
    const input = completeSessionSchema.parse(req.body);
    sendJson(res, sessionDetailSchema, await sessionsService.complete(currentUserId(req), sessionId, input));
  },
};
