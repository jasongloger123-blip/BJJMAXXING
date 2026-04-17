import { test, expect } from '@playwright/test'

/**
 * DEBUG: Woher kommt 500/20?
 */

test.describe('Debug 500/20 Source', () => {
  test('find source of 500/20', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('DEBUG: Source of 500/20');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    await page.waitForTimeout(8000);
    
    // Extrahiere HTML um 500/20 herum
    const html = await page.content();
    
    // Suche nach 500/20 im HTML
    const index500 = html.indexOf('500/20');
    if (index500 > -1) {
      const surrounding = html.substring(
        Math.max(0, index500 - 200),
        Math.min(html.length, index500 + 200)
      );
      console.log('HTML um 500/20 herum:');
      console.log(surrounding);
    }
    
    // Suche nach allen Zahlen/Progress-Mustern
    const allMatches = html.match(/(\d{2,})\/(\d+)/g);
    console.log('\nAlle Zahlen-Muster (2+ Stellen):', allMatches);
    
    expect(true).toBe(true);
  });
});