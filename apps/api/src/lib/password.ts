import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Password hashing with Node's built-in scrypt. It replaces `bcrypt`, a native addon
 * that needs python/make/g++ in the Docker image and silently truncates input at 72 bytes.
 * Parameters follow OWASP guidance (N=2^16, r=8, p=2). They are stored alongside
 * each hash, so they can be raised later without breaking existing users.
 */
const PARAMS = { N: 2 ** 16, r: 8, p: 2 } as const;
const KEY_LEN = 64;
const SALT_LEN = 16;

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  const maxmem = 128 * (opts.N ?? PARAMS.N) * (opts.r ?? PARAMS.r) * 2;
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LEN, { ...opts, maxmem }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await derive(password, salt, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, N, r, p, saltB64, keyB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await derive(password, Buffer.from(saltB64, 'base64'), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
