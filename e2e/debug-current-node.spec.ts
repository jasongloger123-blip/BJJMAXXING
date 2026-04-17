import { test, expect } from '@playwright/test'

/**
 * DEBUG: Welcher Node ist current in API?
 */

test.describe('Debug Current Node', () => {
  test('check API current node vs Standing', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('DEBUG: API Current Node');
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
    
    // API-Daten
    const apiResponse = await request.get('http://localhost:3000/api/gameplan/active', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    });
    const apiData = await apiResponse.json();
    
    console.log('\nPlan Info:');
    console.log('  ID:', apiData.plan?.id);
    console.log('  Title:', apiData.plan?.title);
    console.log('  Source:', apiData.plan?.source);
    
    console.log('\nUnlock Summary:');
    console.log('  Current Node ID:', apiData.plan?.unlockSummary?.currentNodeId);
    console.log('  Current Source Node ID:', apiData.plan?.unlockSummary?.currentSourceNodeId);
    console.log('  Core Completed:', apiData.plan?.unlockSummary?.coreCompletedCount);
    console.log('  Core Total:', apiData.plan?.unlockSummary?.coreTotalCount);
    
    console.log('\nNodes:');
    Object.entries(apiData.plan?.nodes || {}).forEach(([id, node]: [string, any]) => {
      const isCurrent = id === apiData.plan?.unlockSummary?.currentNodeId;
      console.log(`  ${isCurrent ? '👉' : '  '} ${id}: ${node.title}`);
      console.log(`     State: ${node.state}`);
      console.log(`     Progress: ${node.progressCompletedRules}/${node.progressTotalRules}`);
    });
    
    // Prüfe was die Startseite anzeigt
    await page.waitForTimeout(5000);
    const html = await page.content();
    
    // Suche nach dem angezeigten Technik-Namen
    const techniqueMatch = html.match(/De La Riva|Closed Guard|Standing|Half Guard/);
    console.log('\nUI zeigt Technik:', techniqueMatch?.[0] || 'Nicht gefunden');
    
    // Suche Fortschritt
    const progressMatch = html.match(/(\d+)\/(\d+)/);
    console.log('UI zeigt Progress:', progressMatch?.[0] || 'Nicht gefunden');
    
    expect(true).toBe(true);
  });
});