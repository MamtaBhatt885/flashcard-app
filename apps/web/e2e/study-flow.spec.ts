import { expect, test } from '@playwright/test';
import { addCards, answer, createDeck, signUp } from './helpers';

test('create a deck, add cards, study it, and check the summary', async ({ page }) => {
  await signUp(page);

  // Create a deck
  await createDeck(page, 'Spanish Basics', 'Greetings');
  await expect(page.getByText('0 cards · 0 due')).toBeVisible();

  // Add cards
  await addCards(page, [
    ['hola', 'hello'],
    ['adiós', 'goodbye'],
    ['gracias', 'thank you'],
  ]);
  await expect(page.getByText('3 cards · 3 due')).toBeVisible();

  // It shows up in the deck list with its counts
  await page.getByRole('link', { name: '← All decks' }).click();
  const deckCard = page.getByRole('article', { name: 'Spanish Basics' });
  await expect(deckCard).toContainText('3 cards');
  await expect(deckCard).toContainText('3 due');

  // Study: right, wrong, right; the missed card comes back at the end
  await deckCard.getByRole('button', { name: 'Study' }).click();
  await expect(page.getByText('Card 1 of 3')).toBeVisible();
  const progress = page.getByRole('progressbar', { name: 'Session progress' });
  await expect(progress).toHaveAttribute('aria-valuenow', '0');

  await answer(page, true);
  await expect(page.getByText('Card 2 of 3')).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '1');

  const missedFront = (await page.locator('.flip-face').first().locator('p').innerText()).trim();
  await answer(page, false);
  await answer(page, true);
  await expect(page.getByText('You missed this one earlier. Try again!')).toBeVisible();
  await answer(page, true);

  // Summary: 3 correct, 1 incorrect → 75%, the missed card listed once
  const summary = page.getByRole('region', { name: 'Session complete' });
  await expect(summary).toBeVisible();
  await expect(summary.getByText('75%')).toBeVisible();
  const stat = (label: string) => summary.locator('div', { has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) }).locator('dd');
  await expect(stat('Correct')).toHaveText('3');
  await expect(stat('Incorrect')).toHaveText('1');
  await expect(stat('Skipped')).toHaveText('0');
  await expect(summary.getByRole('heading', { name: 'Cards to review' })).toBeVisible();
  await expect(summary.getByRole('listitem')).toHaveCount(1);
  await expect(summary.getByRole('listitem')).toContainText(missedFront);

  // The results were saved: nothing is due any more, even after a full reload
  await page.getByRole('button', { name: 'All decks' }).click();
  await page.reload();
  await expect(page.getByRole('article', { name: 'Spanish Basics' })).not.toContainText('due');
  await expect(page.getByText('You’re all caught up')).toBeVisible();
});
