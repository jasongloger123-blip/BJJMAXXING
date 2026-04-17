import { test, expect } from '@playwright/test'

/**
 * QUICK TEST: Gameplan loading
 */

test.describe('Quick Gameplan Test', () => {
  test('load gameplan after login', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('QUICK TEST: Gameplan Loading');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Jetzt zum Gameplan navigieren
    console.log('Navigating to gameplan...');
    await page.goto('http://localhost:3000/gameplan');
    
    // Warte auf Laden
    await page.waitForTimeout(8000);
    
    // Prüfe was geladen wurde
    const html = await page.content();
    const url = page.url();
    
    console.log('Current URL:', url);
    console.log('Page title:', await page.title());
    
    // Prüfe auf Gameplan-Inhalt
    const hasGameplan = html.includes('Gameplan') || html.includes('Gamepläne');
    const hasStanding = html.includes('Standing');
    const hasNodes = html.includes('Position') || html.includes('technique');
    
    console.log('\nContent Check:');
    console.log('  Has Gameplan:', hasGameplan);
    console.log('  Has Standing:', hasStanding);
    console.log('  Has Nodes:', hasNodes);
    
    // Prüfe auf Fehler
    const has404 = html.includes('404') || html.includes('This page could not be found');
    const hasError = html.includes('error') || html.includes('Error');
    
    console.log('\nError Check:');
    console.log('  Has 404:', has404);
    console.log('  Has Error:', hasError);
    
    // Screenshot
    await page.screenshot({ path: 'test-results/quick-gameplan.png', fullPage: true });
    
    if (hasStanding) {
      console.log('\n✅ SUCCESS: Gameplan loaded with Standing node!');
    } else {
      console.log('\n❌ FAIL: Gameplan did not load Standing node!');
    }
    
    expect(hasStanding).toBe(true);
  });
});