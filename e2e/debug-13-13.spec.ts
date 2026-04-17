import { test, expect } from '@playwright/test'

/**
 * DEBUG: Woher kommt 13/13?
 * Und woher kommt 500/20?
 */

test.describe('Debug 13/13 and 500/20', () => {
  test('track where 13/13 appears in page lifecycle', async ({ page }) => {
    test.setTimeout(180000);
    
    console.log('\n========================================');
    console.log('DEBUG: Finding 13/13 source');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    
    // Track alle Änderungen im DOM
    const changes: { time: number; text: string; source: string }[] = [];
    
    // Überwache DOM-Änderungen
    await page.evaluate(() => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            const text = document.body.innerText;
            if (text.includes('13/13') || text.includes('/29')) {
              (window as any).lastMutationText = text.substring(0, 1000);
            }
          }
        });
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    
    // Prüfe alle 500ms den Inhalt
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      
      const html = await page.content();
      const has1313 = html.includes('13/13');
      const has28_29 = html.includes('28/29');
      const has0_29 = html.includes('0/29');
      const has500_20 = html.includes('500/20');
      
      if (has1313 || has28_29 || has0_29 || has500_20) {
        console.log(`T+${i*500}ms:`, {
          '13/13': has1313,
          '28/29': has28_29,
          '0/29': has0_29,
          '500/20': has500_20
        });
        
        // Wenn 13/13 gefunden, extrahiere Kontext
        if (has1313) {
          const idx = html.indexOf('13/13');
          const context = html.substring(Math.max(0, idx - 200), idx + 200);
          console.log('\nContext um 13/13:');
          console.log(context);
          
          // Versuche React DevTools zu nutzen
          const reactInfo = await page.evaluate(() => {
            const anyWindow = window as any;
            return {
              hasReactDevTools: !!anyWindow.__REACT_DEVTOOLS_GLOBAL_HOOK__,
              fiberRoots: anyWindow.__REACT_DEVTOOLS_GLOBAL_HOOK__?._fiberRoots?.size || 0
            };
          });
          console.log('React DevTools:', reactInfo);
        }
      }
    }
    
    // Screenshot am Ende
    await page.screenshot({ path: 'test-results/start-13-13-debug.png', fullPage: true });
    
    expect(true).toBe(true);
  });
  
  test('check network requests and responses', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('DEBUG: Network Analysis');
    console.log('========================================\n');
    
    // Track alle API-Responses
    const responses: any[] = [];
    
    await page.route('**/api/**', async (route, request) => {
      const response = await route.fetch();
      const body = await response.json().catch(() => ({}));
      responses.push({
        url: request.url(),
        status: response.status(),
        body: body
      });
      await route.fulfill({ response });
    });
    
    // Login und Startseite laden
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    await page.waitForTimeout(8000);
    
    // Prüfe gameplan/active Response
    const gameplanResponse = responses.find(r => r.url.includes('gameplan/active'));
    if (gameplanResponse) {
      console.log('\nGameplan/active Response:');
      console.log('  Plan ID:', gameplanResponse.body.plan?.id);
      console.log('  Plan Title:', gameplanResponse.body.plan?.title);
      
      const nodes = gameplanResponse.body.plan?.nodes || {};
      Object.entries(nodes).forEach(([id, node]: [string, any]) => {
        console.log(`  Node ${id}:`, {
          title: node.title,
          progress: `${node.progressCompletedRules}/${node.progressTotalRules}`,
          state: node.state
        });
      });
    }
    
    // Prüfe start-queue Response
    const queueResponse = responses.find(r => r.url.includes('start-queue'));
    if (queueResponse) {
      console.log('\nStart-queue Response:');
      console.log('  Queue length:', queueResponse.body.queue?.length);
      
      // Suche nach Karten mit 13 total
      const cards = queueResponse.body.queue || [];
      const cardsWith13 = cards.filter((c: any) => c.totalVideos === 13 || c.clipCount === 13);
      console.log('  Cards with total=13:', cardsWith13.length);
      cardsWith13.forEach((c: any) => {
        console.log(`    - ${c.title} (${c.nodeId}): total=${c.totalVideos}, count=${c.clipCount}`);
      });
    }
    
    expect(true).toBe(true);
  });
});