import { test, expect } from '@playwright/test';
import { DEMO_STATE, pickStation } from './fixtures';

test.use({ storageState: DEMO_STATE });

test('unreserved: search → train → passengers → review → simulated UPI payment → DEMO ticket → cancel', async ({ page }) => {
  await page.goto('/unreserved');
  await expect(page.getByRole('heading', { name: /unreserved/i })).toBeVisible();

  // Validation: cannot continue without stations
  await page.getByRole('button', { name: 'Find trains on this route' }).click();
  await expect(page.getByText('Select a departure station')).toBeVisible();

  await pickStation(page, 'From', 'PNBE');
  await pickStation(page, 'To', 'ARA');
  await page.getByRole('button', { name: 'Find trains on this route' }).click();

  // Mock train list
  await expect(page.getByText('Mock schedule', { exact: true })).toBeVisible();
  const trains = page.getByRole('radiogroup', { name: 'Select a train' }).getByRole('radio');
  await trains.first().click();
  await page.getByRole('button', { name: /^Continue with/ }).click();

  // Passengers: invalid combo is blocked, then fixed
  await page.getByRole('button', { name: 'Decrease Adult' }).click();
  await expect(page.getByText('Add at least one passenger')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review booking' })).toBeDisabled();
  await page.getByRole('button', { name: 'Increase Adult' }).click();
  await page.getByRole('button', { name: 'Increase Child' }).click();
  await expect(page.getByText(/DEMO-FARE/).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Review booking' }).click();

  // Review requires demo acknowledgement
  await expect(page.getByText('Demo only — not valid for travel')).toBeVisible();
  await page.getByRole('button', { name: /Confirm & proceed to pay/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: /confirm|acknowledge|tick/i })).toBeVisible();
  await page.getByLabel('I understand this is a demo ticket and not a real railway ticket.').check();
  await page.getByRole('button', { name: /Confirm & proceed to pay/ }).click();

  // Checkout: failed then successful sandbox UPI payment
  await expect(page).toHaveURL(/\/checkout\//);
  await page.getByRole('radio', { name: /Demo UPI/ }).click();
  await page.getByLabel('UPI ID (sandbox)').fill('fail@demoupi');
  await page.getByRole('button', { name: /\(simulated\)$/ }).click();
  await expect(page.getByText('Payment not completed')).toBeVisible();
  await page.getByLabel('UPI ID (sandbox)').fill('success@demoupi');
  await page.getByRole('button', { name: /\(simulated\)$/ }).click();

  // Ticket
  await expect(page).toHaveURL(/\/tickets\/[^/?]+\?new=1/);
  await expect(page.getByText('Demo booking successful')).toBeVisible();
  await expect(page.getByText('DEMO ONLY — NOT VALID FOR TRAVEL').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(/DEMO-UTS-/).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(/simulated qr/i).filter({ visible: true }).first()).toBeVisible();

  // Cancellation simulation with refund preview
  await page.getByRole('button', { name: /Cancel ticket \(simulation\)/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Cancel this demo ticket?' });
  await expect(dialog.getByText(/refund/i).filter({ visible: true }).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel ticket' }).click();
  await expect(page.getByText(/cancelled/i).filter({ visible: true }).first()).toBeVisible();
});

test('platform ticket: declined test card then wallet payment', async ({ page }) => {
  await page.goto('/platform?station=PNBE');
  await expect(page.getByRole('button', { name: /^Station: .*PNBE/ })).toBeVisible();
  await page.getByLabel(/I understand/).check();
  await page.getByRole('button', { name: /proceed to pay|continue|book/i }).last().click();
  await expect(page).toHaveURL(/\/checkout\//);

  await page.getByRole('radio', { name: /Demo card/ }).click();
  await page.getByLabel('Card number (test)').fill('4000 0000 0000 0002');
  await page.getByLabel('Expiry (MM/YY)').fill('1230');
  await page.getByLabel('CVV').fill('123');
  await page.getByRole('button', { name: /\(simulated\)$/ }).click();
  await expect(page.getByText('Payment not completed')).toBeVisible();

  await page.getByRole('radio', { name: /Demo wallet/ }).click();
  await page.getByRole('button', { name: /\(simulated\)$/ }).click();
  await expect(page.getByText('DEMO ONLY — NOT VALID FOR TRAVEL').filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText(/DEMO-PF-/).filter({ visible: true }).first()).toBeVisible();
});
