/**
 * Demo data: `npm run db:seed`
 * Creates demo@example.com / password123 with one starter deck.
 */
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/lib/password.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url }) });

const CARDS: Array<[string, string]> = [
  ['What does HTTP status 404 mean?', 'Not Found: the server has no resource at that URL.'],
  ['What is a closure in JavaScript?', 'A function that remembers variables from the scope where it was created.'],
  ['What does SQL JOIN do?', 'Combines rows from two tables based on a related column.'],
  ['What is the time complexity of binary search?', 'O(log n)'],
  ['What does REST stand for?', 'Representational State Transfer'],
];

async function main() {
  const email = 'demo@example.com';
  await prisma.user.deleteMany({ where: { email } });
  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword('password123'),
      decks: {
        create: {
          title: 'CS Fundamentals',
          description: 'Starter deck to try the study mode',
          cards: { create: CARDS.map(([front, back]) => ({ front, back })) },
        },
      },
    },
  });
  console.log(`Seeded ${email} / password123 with ${CARDS.length} cards`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
