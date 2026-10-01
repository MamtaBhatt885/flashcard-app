import { apiErrorSchema, userSchema } from '@flashcards/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, contract, signedInUser } from './helpers.js';

describe('auth API', () => {
  it('signup → 201, a User, and an httpOnly auth cookie', async () => {
    const email = `signup-${Date.now()}@test.dev`;
    const res = await request(app).post('/api/auth/signup').send({ email, password: 'password123' }).expect(201);
    expect(contract(userSchema, res.body).email).toBe(email);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/^token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|scrypt/);
  });

  it('signup with an existing email → 409', async () => {
    const { email } = await signedInUser();
    const res = await request(app).post('/api/auth/signup').send({ email, password: 'password123' }).expect(409);
    expect(contract(apiErrorSchema, res.body).message).toMatch(/already exists/);
  });

  it('login: normalizes email case/spaces; wrong password and unknown email both → the same 401', async () => {
    const { email } = await signedInUser();
    await request(app).post('/api/auth/login').send({ email: `  ${email.toUpperCase()} `, password: 'password123' }).expect(200);
    const wrong = await request(app).post('/api/auth/login').send({ email, password: 'wrongpass1' }).expect(401);
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@test.dev', password: 'wrongpass1' }).expect(401);
    expect(wrong.body).toEqual(unknown.body); // doesn't reveal which emails exist
  });

  it('me: 401 without a cookie, 200 with one; logout → 204, then 401', async () => {
    await request(app).get('/api/auth/me').expect(401);
    const { agent, user } = await signedInUser();
    expect((await agent.get('/api/auth/me').expect(200)).body).toEqual(user);
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('invalid body → 400 with per-field details', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'nope', password: 'x' }).expect(400);
    const body = contract(apiErrorSchema, res.body);
    expect(Object.keys(body.details ?? {})).toEqual(expect.arrayContaining(['email', 'password']));
  });
});
