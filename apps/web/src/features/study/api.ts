import {
  answerResponseSchema,
  sessionDetailSchema,
  startSessionResponseSchema,
  type AnswerInput,
  type CompleteSessionInput,
  type StartSessionInput,
} from '@flashcards/shared';
import { api } from '../../lib/apiClient';

export const studyApi = {
  start: (deckId: string, body: StartSessionInput = {}) =>
    api(`/decks/${deckId}/sessions`, startSessionResponseSchema, { method: 'POST', body: JSON.stringify(body) }),
  answer: (sessionId: string, body: AnswerInput) =>
    api(`/sessions/${sessionId}/answers`, answerResponseSchema, { method: 'POST', body: JSON.stringify(body) }),
  complete: (sessionId: string, body: CompleteSessionInput) =>
    api(`/sessions/${sessionId}/complete`, sessionDetailSchema, { method: 'POST', body: JSON.stringify(body) }),
};
