import { test, expect } from '@playwright/test'

/**
 * DEBUG: Warum zeigt Gameplan zuerst 13/13, dann 28/29?
 * UND: Warum zeigt Startseite 0/5?
 * UND: Warum ist Half Guard freigeschaltet?
 */

test.describe('Debug Progress Issues', () => {
  test('Gameplan - track progress display changes', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('DEBUG: Gameplan Progress Changes');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Track console logs
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      if (text.includes('progress') || text.includes('clip') || text.includes('Standing') || text.includes('13') || text.includes('28')) {
        console.log('[BROWSER]', text.substring(0, 200));
      }
    });
    
    // Gehe zum Gameplan
    await page.goto('http://localhost:3000/gameplan');
    
    // Warte kurz und prüfe initialen Zustand
    await page.waitForTimeout(2000);
    const html1 = await page.content();
    const progress1 = html1.match(/(\d+)\/(\d+)/g);
    console.log('Progress nach 2s:', progress1);
    
    // Warte weitere 3 Sekunden
    await page.waitForTimeout(3000);
    const html2 = await page.content();
    const progress2 = html2.match(/(\d+)\/(\d+)/g);
    console.log('Progress nach 5s:', progress2);
    
    // Warte nochmal 3 Sekunden
    await page.waitForTimeout(3000);
    const html3 = await page.content();
    const progress3 = html3.match(/(\d+)\/(\d+)/g);
    console.log('Progress nach 8s:', progress3);
    
    // Screenshot
    await page.screenshot({ path: 'test-results/gameplan-progress-change.png', fullPage: true });
    
    // Prüfe Half Guard Status
    const halfGuardSection = html3.substring(
      html3.toLowerCase().indexOf('half guard') - 200,
      html3.toLowerCase().indexOf('half guard') + 300
    );
    console.log('\nHalf Guard HTML:', halfGuardSection);
    
    expect(true).toBe(true);
  });

  test('Startseite - check Standing progress display', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('DEBUG: Startseite Standing Progress');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    await page.waitForTimeout(8000); // Warte länger für Datenladen
    
    // Track API calls
    const apiCalls: any[] = [];
    await page.route('**/api/**', async (route, request) => {
      const response = await route.fetch();
      const body = await response.json().catch(() => ({}));
      apiCalls.push({
        url: request.url(),
        status: response.status(),
        hasPlan: !!body.plan,
        hasNodes: body.plan?.nodes ? Object.keys(body.plan.nodes).length : 0
      });
      await route.fulfill({ response });
    });
    
    // Lade Seite neu für API-Tracking
    await page.reload();
    await page.waitForTimeout(8000);
    
    console.log('API Calls:', apiCalls);
    
    // HTML analysieren
    const html = await page.content();
    
    // Suche Standing
    const standingIndex = html.toLowerCase().indexOf('standing');
    if (standingIndex > -1) {
      const surrounding = html.substring(
        Math.max(0, standingIndex - 500),
        Math.min(html.length, standingIndex + 500)
      );
      console.log('\nHTML um Standing auf Startseite:');
      console.log(surrounding);
      
      // Extrahiere Progress
      const progressMatch = surrounding.match(/(\d+)\/(\d+)/);
      if (progressMatch) {
        console.log(`\n⚠️  Startseite zeigt: ${progressMatch[1]}/${progressMatch[2]}`);
      }
    }
    
    // Alle Progress-Indikatoren
    const allProgress = html.match(/(\d+)\/(\d+)/g);
    const uniqueProgress = allProgress ? Array.from(new Set(allProgress)) : [];
    console.log('\nAlle Fortschritte auf Startseite:', uniqueProgress);
    
    // Screenshot
    await page.screenshot({ path: 'test-results/start-home-progress.png', fullPage: true });
    
    expect(true).toBe(true);
  });
});