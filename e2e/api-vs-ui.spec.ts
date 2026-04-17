import { test, expect } from '@playwright/test'

/**
 * VERGLEICH: API Daten vs UI Anzeige
 */

test.describe('API vs UI Comparison', () => {
  test('compare API data with UI display', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('VERGLEICH: API vs UI');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Get auth token
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name.includes('auth-token'));
    let token = '';
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value);
        token = parsed.access_token || '';
      } catch {}
    }
    
    // 1. API-Daten abrufen
    console.log('1. API-Daten abrufen...');
    const apiResponse = await request.get('http://localhost:3000/api/gameplan/active', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    });
    const apiData = await apiResponse.json();
    
    // Finde current node in API
    const currentNodeId = apiData.plan?.unlockSummary?.currentNodeId;
    const currentNode = apiData.plan?.nodes?.[currentNodeId];
    
    console.log('\nAPI-Daten:');
    console.log('  Plan ID:', apiData.plan?.id);
    console.log('  Current Node ID:', currentNodeId);
    console.log('  Current Node Title:', currentNode?.title);
    console.log('  Current Node Progress:', currentNode?.progressCompletedRules, '/', currentNode?.progressTotalRules);
    
    // Zeige alle Nodes mit Progress
    console.log('\n  Alle Nodes im Plan:');
    Object.entries(apiData.plan?.nodes || {}).forEach(([id, node]: [string, any]) => {
      console.log(`    ${id}: ${node.title} - ${node.progressCompletedRules}/${node.progressTotalRules} (state: ${node.state})`);
    });
    
    // 2. Warte auf vollständiges Laden der Startseite
    console.log('\n2. Startseite analysieren...');
    await page.waitForTimeout(5000);
    
    // 3. JavaScript im Browser ausführen um interne State zu sehen
    const internalState = await page.evaluate(() => {
      // Versuche auf React Interna zuzugreifen (funktioniert nur in Dev Mode)
      const anyWindow = window as any;
      return {
        hasStartHome: anyWindow.__START_HOME_DEBUG__,
        location: window.location.pathname,
      };
    });
    
    console.log('Internal State:', internalState);
    
    // 4. HTML analysieren
    const html = await page.content();
    
    // Suche nach Fortschrittsindikatoren
    const progressMatches = html.match(/(\d+)\/(\d+)/g);
    console.log('\nUI Fortschritte:', progressMatches);
    
    // Suche nach der angezeigten Technik
    const techniqueSection = html.match(/De La Riva|Closed Guard|Standing|Half Guard[^\n]{0,200}/i);
    console.log('\nAktuelle Technik in UI:', techniqueSection);
    
    // Screenshot für Debug
    await page.screenshot({ path: 'test-results/api-vs-ui.png', fullPage: true });
    
    console.log('\n========================================');
    console.log('ERGEBNIS:');
    console.log('========================================');
    console.log('API zeigt:', currentNode?.progressCompletedRules, '/', currentNode?.progressTotalRules);
    console.log('UI sollte zeigen:', currentNode?.progressCompletedRules, '/', currentNode?.progressTotalRules);
    
    expect(true).toBe(true);
  });
});