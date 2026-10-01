/**
 * Cases the first E2E pass missed (added in the critique step).
 */
import { expect, test } from '@playwright/test';
import { addCards, answer, createDeck, signIn, signUp } from './helpers';

test.describe('studying', () => {
  test('keyboard only: Space flips, → correct, ← incorrect, S skips', async ({ page }) => {
    await signUp(page);
    await createDeck(page, 'Keys');
    await addCards(page, [['one', '1'], ['two', '2'], ['three', '3']]);
    await page.getByRole('button', { name: /^Study/ }).click();
    await expect(page.getByText('Card 1 of 3')).toBeVisible();

    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: '✓ Correct' })).toBeVisible();
    await page.keyboard.press('ArrowRight'); // correct
    await expect(page.getByText('Card 2 of 3')).toBeVisible();
    await page.keyboard.press('ArrowRight'); // not flipped yet: must be ignored
    await expect(page.getByText('Card 2 of 3')).toBeVisible();
    await page.keyboard.press('s'); // skip
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowLeft'); // incorrect → comes back
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight'); // retry correct

    const summary = page.getByRole('region', { name: 'Session complete' });
    await expect(summary).toBeVisible();
    await expect(summary.getByText('67%')).toBeVisible(); // 2 correct of 3 answers
    await expect(summary.locator('div', { has: page.locator('dt', { hasText: /^Skipped$/ }) }).locator('dd')).toHaveText('1');
  });

  test('practice missed cards: runs only the missed ones and doesn’t change the schedule', async ({ page }) => {
    await signUp(page);
    await createDeck(page, 'Practice');
    await addCards(page, [['alpha', 'a'], ['beta', 'b']]);
    await page.getByRole('button', { name: /^Study/ }).click();
    await answer(page, false);
    await answer(page, true);
    await answer(page, false); // the missed card again → moves on
    const summary = page.getByRole('region', { name: 'Session complete' });
    await expect(summary.getByRole('listitem')).toHaveCount(1);

    await page.getByRole('button', { name: 'Practice missed cards (1)' }).click();
    await expect(page.getByText('Practice mode')).toBeVisible();
    await expect(page.getByText('Card 1 of 1')).toBeVisible();
    await answer(page, true);
    await expect(page.getByRole('heading', { name: 'Practice complete' })).toBeVisible();

    // Schedule untouched by practice: both cards are due tomorrow, not later
    await page.getByRole('button', { name: 'Back to deck' }).click();
    await expect(page.getByText('Due tomorrow')).toHaveCount(2);
  });

  test('an empty deck can’t be studied; a studied deck says nothing is due', async ({ page }) => {
    await signUp(page);
    await createDeck(page, 'Empty');
    await expect(page.getByRole('button', { name: /^Study/ })).toBeDisabled();
    await addCards(page, [['only', 'card']]);
    await page.getByRole('button', { name: /^Study/ }).click();
    await answer(page, true);
    await expect(page.getByRole('region', { name: 'Session complete' })).toBeVisible();
    await page.goto(page.url()); // study again right away
    await expect(page.getByText('Nothing due right now')).toBeVisible();
  });
});

test.describe('auth', () => {
  test('login expiring mid-study → sent to sign in with an explanation, then back to where you were', async ({ page, context }) => {
    const email = await signUp(page);
    await createDeck(page, 'Expiry');
    await addCards(page, [['q', 'a']]);
    await page.getByRole('button', { name: /^Study/ }).click();
    // Wait until the session has loaded and a card is showing, THEN let the login expire.
    await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();
    const studyUrl = page.url();
    await context.clearCookies(); // the auth cookie expires
    await answer(page, true);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Your session expired. Please sign in again.')).toBeVisible();
    await signIn(page, email);
    await expect(page).toHaveURL(studyUrl);
  });
});

test.describe('decks', () => {
  test('delete via the confirm dialog: Cancel and Esc keep the deck, Confirm removes it', async ({ page }) => {
    await signUp(page);
    await createDeck(page, 'Doomed');
    await page.getByRole('link', { name: '← All decks' }).click();
    const deck = page.getByRole('article', { name: 'Doomed' });
    const dialog = page.getByRole('dialog', { name: 'Delete deck?' });

    await page.getByRole('button', { name: 'Delete Doomed' }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(deck).toBeVisible();

    await page.getByRole('button', { name: 'Delete Doomed' }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(deck).toBeVisible();

    await page.getByRole('button', { name: 'Delete Doomed' }).click();
    await dialog.getByRole('button', { name: 'Delete deck' }).click();
    await expect(deck).toHaveCount(0);
    await expect(page.getByText('No decks yet')).toBeVisible();
  });

  test('validation messages reach the UI: empty title, and a 409 duplicate title', async ({ page }) => {
    await signUp(page);
    await createDeck(page, 'Chemistry');
    await page.getByRole('link', { name: '← All decks' }).click();
    await page.getByRole('button', { name: 'New deck' }).click();
    await page.getByRole('button', { name: 'Create deck' }).click();
    await expect(page.getByText('Title is required')).toBeVisible();
    await page.getByLabel('Title').fill('Chemistry');
    await page.getByRole('button', { name: 'Create deck' }).click();
    await expect(page.getByRole('alert')).toHaveText('You already have a deck named “Chemistry”');
    await expect(page.getByLabel('Title')).toHaveValue('Chemistry'); // input kept
  });

  test('mistyped or unknown deck URLs show "Deck not found", not a raw error', async ({ page }) => {
    await signUp(page);
    for (const url of ['/decks/typo', '/decks/typo/study', '/decks/01999999-9999-7999-8999-999999999999']) {
      await page.goto(url);
      await expect(page.getByText('Deck not found')).toBeVisible();
    }
  });
});

test('phone-sized screen: deck list and study mode fit without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await signUp(page);
  await createDeck(page, 'A deck with a fairly long title to test wrapping on small screens');
  await addCards(page, [['A reasonably long question that should wrap', 'And an answer']]);
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await noOverflow()).toBe(true);
  await page.getByRole('button', { name: /^Study/ }).click();
  await page.getByRole('button', { name: 'Show answer' }).click();
  expect(await noOverflow()).toBe(true);
  await page.getByRole('link', { name: '← All decks' }).or(page.getByRole('link', { name: /^←/ })).first().click();
  await page.goto('/');
  expect(await noOverflow()).toBe(true);
});
