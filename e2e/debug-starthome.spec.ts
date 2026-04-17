import { test, expect } from '@playwright/test'

/**
 * DEBUG: StartHome currentTechniqueProgress
 */

test.describe('Debug StartHome Progress', () => {
  test('check which node is used for progress calculation', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('DEBUG: StartHome Progress Node');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    
    // Warte länger für vollständiges Laden
    await page.waitForTimeout(8000);
    
    // Führe JavaScript im Browser aus um State zu analysieren
    const debugInfo = await page.evaluate(() => {
      const info: any = {};
      
      // Suche nach React-Props im DOM
      const mainContent = document.querySelector('[class*="min-h-screen"]');
      if (mainContent) {
        info.mainContentFound = true;
      }
      
      // Suche nach Technik-Titeln
      const headings = Array.from(document.querySelectorAll('h3'));
      info.techniqueTitles = headings.map(h => h.textContent).filter(t => t && t.length > 0);
      
      // Suche nach Progress-Texten
      const allText = document.body.innerText;
      const progressMatches = allText.match(/(\d+)\/(\d+)/g);
      info.progressMatches = progressMatches;
      
      // Suche nach Unlock-Texten
      const unlockElements = document.querySelectorAll('*');
      let unlockText = '';
      unlockElements.forEach(el => {
        if (el.textContent?.includes('Unlock')) {
          unlockText += el.textContent + '\n';
        }
      });
      info.unlockText = unlockText.substring(0, 500);
      
      return info;
    });
    
    console.log('Debug Info:', JSON.stringify(debugInfo, null, 2));
    
    expect(true).toBe(true);
  });
});