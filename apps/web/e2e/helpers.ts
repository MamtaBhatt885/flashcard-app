import { expect, type Page } from '@playwright/test';

let n = 0;
/** Signs up a brand-new user through the UI, so every test starts with an empty account. */
export async function signUp(page: Page) {
  const email = `e2e-${Date.now()}-${n++}@test.dev`;
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByRole('heading', { name: 'Your decks' })).toBeVisible();
  return email;
}

export async function signIn(page: Page, email: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Creates a deck from the deck list and lands on its page. */
export async function createDeck(page: Page, title: string, description?: string) {
  // Wait for the deck list to load, then click whichever button it shows:
  // "Create your first deck" on an empty account, "New deck" otherwise.
  const openForm = page
    .getByRole('button', { name: 'Create your first deck' })
    .or(page.getByRole('button', { name: 'New deck' }));
  await openForm.first().click();
  await page.getByLabel('Title').fill(title);
  if (description) await page.getByLabel('Description (optional)').fill(description);
  await page.getByRole('button', { name: 'Create deck' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

/** Adds cards on the deck page via the "Add a card" form (it clears itself after each save). */
export async function addCards(page: Page, cards: Array<[front: string, back: string]>) {
  const form = page.locator('section', { has: page.getByRole('heading', { name: 'Add a card' }) });
  for (const [front, back] of cards) {
    await form.getByLabel('Front').fill(front);
    await form.getByLabel('Back').fill(back);
    await form.getByRole('button', { name: 'Add card' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: front })).toBeVisible();
  }
}

/** Reveals the current card and grades it with the on-screen buttons. */
export async function answer(page: Page, correct: boolean) {
  await page.getByRole('button', { name: 'Show answer' }).click();
  await page.getByRole('button', { name: correct ? '✓ Correct' : '✗ Incorrect' }).click();
}
