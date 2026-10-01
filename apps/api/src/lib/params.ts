import { z } from 'zod';

// URL params parsed (not just asserted with Request<{ deckId: string }> generics) in controllers.
// A malformed id is a 400; a well-formed id that doesn't exist is a 404 from the service.
export const deckParams = z.object({ deckId: z.uuid('Invalid deck id') });
export const cardParams = z.object({ cardId: z.uuid('Invalid card id') });
export const sessionParams = z.object({ sessionId: z.uuid('Invalid session id') });
