import { chromium } from 'playwright-core';
// Play phone screenshots: 1080x1920 (9:16), min 2, max 8.
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' });
const ctx = await browser.newContext({
  viewport: { width: 540, height: 960 },
  deviceScaleFactor: 2,
  geolocation: { latitude: 10.4716, longitude: -68.0056 },
  permissions: ['geolocation'],
});
const page = await ctx.newPage();
const shot = (n) => page.screenshot({ path: `${process.env.D}/${n}.png` });

await page.goto('http://localhost:3002/map', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.click('button:has-text("Dev bypass")');
await page.waitForTimeout(11000);
await shot('01-map');

// place sheet
await page.locator('[aria-label="Arepera El Malecón [DEV]"]').click({ force: true }).catch(() => {});
await page.waitForTimeout(2500);
await shot('02-place');

// guaca answer
await page.click('button[aria-label="Guaca"]');
await page.waitForTimeout(900);
await page.locator('input[aria-label*="Plan"], input[aria-label*="Planifica"]').fill('Where can I eat arepas near the malecón?');
await page.keyboard.press('Enter');
await page.waitForTimeout(20000);
await shot('03-guaca');

// refusal (the hero state)
await page.locator('input[aria-label*="Plan"], input[aria-label*="Planifica"]').fill('Where can I dance salsa tonight?');
await page.keyboard.press('Enter');
await page.waitForTimeout(16000);
await shot('04-refusal');

// plan
await page.click('button[aria-label="Plan"]');
await page.waitForTimeout(2500);
await shot('05-plan');

// spotter side
await page.goto('http://localhost:3002/spotter', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.click('button:has-text("Dev bypass")');
await page.waitForTimeout(4000);
await shot('06-missions');
await page.click('button:has-text("Map")');
await page.waitForTimeout(9000);
await shot('07-spotter-map');
await page.click('button:has-text("Profile")');
await page.waitForTimeout(3500);
await shot('08-spotter-profile');
await browser.close();
