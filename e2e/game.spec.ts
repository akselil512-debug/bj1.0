import { expect, Page, test } from '@playwright/test';

async function enter(page: Page, name = 'Testaaja') {
  await page.goto('/');
  await page.getByLabel('Nimimerkki').fill(name);
  await page.getByLabel('Kolminumeroinen koodi').fill('123');
  await page.getByRole('button', { name: 'Astu saluunaan' }).click();
  await page.getByRole('button', { name: 'Istu pöytään' }).click();
  await expect(page.getByRole('button', { name: 'Jaa kortit' })).toBeVisible();
}

/** Plays the hinted move until the round ends. Closes any bonus pop-up on the way. */
async function playRound(page: Page) {
  await page.getByRole('button', { name: 'Jaa kortit' }).click();
  const result = page.locator('.result-line');
  for (let i = 0; i < 60 && !(await result.isVisible()); i++) {
    const dialog = page.getByRole('dialog');
    if (await dialog.count()) await dialog.locator('button.primary').click();
    else if (await page.getByRole('button', { name: 'Ei vakuutusta' }).isVisible()) await page.getByRole('button', { name: 'Ei vakuutusta' }).click();
    else if (await page.locator('.action.best').count()) await page.locator('.action.best').click();
    await page.waitForTimeout(30);
  }
  await expect(result).toBeVisible();
}

async function axeViolations(page: Page) {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  return page.evaluate(async () => {
    const axe = (window as any).axe;
    const results = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return results.violations.map((v: any) => `${v.id}: ${v.nodes.map((n: any) => n.target.join(' ')).join(' | ')}`);
  });
}

test('a new player is guided through a full round', async ({ page }) => {
  await enter(page);
  await expect(page.getByText('1/3 Panos.')).toBeVisible();
  await playRound(page);
  await expect(page.getByText('3/3 Voitonmaksu.')).toBeVisible();
  await expect(page.locator('.feedback, .result-line').first()).toBeVisible();
});

test('the guide can be skipped and hints can be switched off', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: 'Ohita opastus' }).click();
  await expect(page.getByText('1/3 Panos.')).toBeHidden();
  await page.getByRole('button', { name: 'Profiili', exact: true }).click();
  await page.getByRole('button', { name: 'Asetukset', exact: true }).click();
  await page.getByLabel('Näytä paras siirto joka kädessä').uncheck();
  await page.getByRole('button', { name: 'Blackjack', exact: true }).click();
  await page.getByRole('button', { name: 'Jaa kortit' }).click();
  await expect(page.locator('.action.best')).toHaveCount(0);
});

test('several hands can be played side by side', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: 'Enemmän käsiä' }).click();
  await page.getByRole('button', { name: 'Enemmän käsiä' }).click();
  await expect(page.locator('.stake-total')).toContainText('1 500');
  await playRound(page);
  expect(await page.locator('.hand').count()).toBeGreaterThanOrEqual(3);
});

test('roulette pays a winning bet and takes a losing one', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: 'Ruletti', exact: true }).click();
  // Red and black together: exactly one wins unless the ball lands on zero.
  await page.getByRole('button', { name: 'Punainen', exact: true }).click();
  await page.getByRole('button', { name: 'Musta', exact: true }).click();
  await expect(page.locator('.roulette .bet-value')).toHaveText('1 000 $');
  await page.getByRole('button', { name: 'Pyöräytä', exact: true }).click();
  await expect(page.locator('.r-number')).toBeVisible({ timeout: 8000 });
  // Amounts use a non-breaking space as the thousands separator.
  const text = (await page.locator('.r-info .result-line').innerText()).replace(/\s/g, ' ');
  expect(['Omillesi', 'Hävisit 1 000 $']).toContain(text);
  const balance = (await page.locator('.balance-value').innerText()).replace(/\s/g, ' ');
  expect(balance).toBe(text === 'Omillesi' ? '100 000 $' : '99 000 $');
});

test('the daily wheel gives one free spin a day', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: 'Pyörä', exact: true }).click();
  await page.getByRole('button', { name: 'Pyöräytä', exact: true }).click();
  await expect(page.locator('.d-win')).toBeVisible({ timeout: 9000 });
  await expect(page.getByRole('button', { name: 'Seuraava pyöräytys huomenna' })).toBeDisabled();
  await expect(page.locator('.balance-value')).not.toHaveText('100 000 $');
  await page.reload();
  await page.getByRole('button', { name: 'Testaaja' }).click();
  await page.getByLabel('Kolminumeroinen koodi').fill('123');
  await page.getByRole('button', { name: 'Avaa profiili' }).click();
  await expect(page.getByText('Pyöräytetty tänään')).toBeVisible();
});

test('side bet odds are visible before betting', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: 'Sivupanosten kertoimet' }).click();
  await expect(page.getByText('Täydellinen pari (sama maa)')).toBeVisible();
  await expect(page.getByText('Kolmoset samaa maata')).toBeVisible();
});

test('progress survives a reload and moves with a transfer code', async ({ page }) => {
  await enter(page);
  await playRound(page);
  await page.getByRole('button', { name: 'Profiili', exact: true }).click();
  await page.getByRole('button', { name: 'Asetukset', exact: true }).click();
  await page.getByRole('button', { name: 'Luo siirtokoodi' }).click();
  const code = await page.getByLabel('Siirtokoodi').inputValue();

  await page.reload();
  await page.getByRole('button', { name: 'Testaaja' }).click();
  await page.getByLabel('Kolminumeroinen koodi').fill('999');
  await page.getByRole('button', { name: 'Avaa profiili' }).click();
  await expect(page.getByRole('alert')).toContainText('Väärä koodi');
  await page.getByLabel('Kolminumeroinen koodi').fill('123');
  await page.getByRole('button', { name: 'Avaa profiili' }).click();
  await page.getByRole('button', { name: 'Profiili', exact: true }).click();
  await expect(page.locator('.stats')).toContainText('Pelatut kädet');

  // A second device: empty storage, restore from the code.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Tuo siirtokoodilla' }).click();
  await page.getByLabel('Siirtokoodi').fill(code.slice(0, -2));
  await page.getByRole('button', { name: 'Tuo profiili' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Siirtokoodi').fill(code);
  await page.getByRole('button', { name: 'Tuo profiili' }).click();
  await expect(page.locator('.brand-sub')).toContainText('Testaaja');
});

test('fits a phone screen and meets WCAG 2.1 AA checks on every screen', async ({ page }) => {
  await page.goto('/');
  expect(await axeViolations(page)).toEqual([]);
  await enter(page);
  expect(await axeViolations(page)).toEqual([]);
  await page.getByRole('button', { name: 'Jaa kortit' }).click();
  await page.waitForTimeout(600);
  expect(await axeViolations(page)).toEqual([]);
  for (const tab of ['Aula', 'Ruletti', 'Pyörä', 'Profiili', 'Säännöt', 'Asetukset']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    expect(await axeViolations(page), tab).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), tab).toBe(true);
  }
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).filter((b) => b.offsetParent && (b.offsetHeight < 44 || b.offsetWidth < 44)).map((b) => b.textContent),
  );
  expect(small).toEqual([]);
});
