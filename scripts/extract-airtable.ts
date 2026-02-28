import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

async function extractAirtable() {
  console.log("Starting Airtable extraction via Playwright DOM scraping...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // AISafety Airtable embed view
  await page.goto("https://airtable.com/shrLgl03tMK4q6cyc");
  console.log("Navigated to Airtable view... waiting for rows to render.");
  
  // Wait for the rows to render
  await page.waitForSelector('.dataRow', { timeout: 15000 }).catch(() => console.log('Timeout waiting for .dataRow'));
  await page.waitForTimeout(5000); // let animations settle
  
  // Actually, we can just grab window.application from the page!
  const windowApp = await page.evaluate(() => {
     // @ts-ignore
     if (window.application) return window.application;
     return null;
  });

  if (windowApp) {
      console.log('Found window.application!');
      // Now we just need to drill down into the view data
  } else {
      console.log('No window.application. Grabbing text from DOM...');
  }

  // Let's scrape the actual row text directly from the DOM just to be perfectly bulletproof
  const events = await page.evaluate(() => {
     const rows = Array.from(document.querySelectorAll('.dataRow'));
     return rows.map(r => {
         const cells = Array.from(r.querySelectorAll('.cell'));
         // Text usually lives in .cell .truncate or similar. 
         // We can just get innerText of each cell.
         return cells.map(c => (c as HTMLElement).innerText);
     });
  });

  console.log(`Extracted ${events.length} rows directly from the DOM.`);
  
  if (events.length > 0) {
      console.log("Sample First Row:");
      console.log(events[0]);
  }

  require('fs').writeFileSync('airtable-data-dom.json', JSON.stringify(events, null, 2));

  await browser.close();
}

extractAirtable();
