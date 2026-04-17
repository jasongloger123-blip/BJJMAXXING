import { test, expect } from '@playwright/test'

/**
 * DEBUG: Warum öffnet sich der Gameplan nicht?
 */

test.describe('Debug Gameplan Opening', () => {
  test('verify gameplan page loads correctly', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('DEBUG: Gameplan Opening');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Versuche zum Gameplan zu navigieren
    console.log('Navigating to gameplan...');
    await page.goto('http://localhost:3000/gameplan');
    
    // Warte auf Laden
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // Prüfe URL
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // Prüfe ob wir auf Gameplan sind
    const onGameplan = currentUrl.includes('/gameplan');
    console.log('On gameplan page:', onGameplan);
    
    // Prüfe ob Gameplan-Inhalt geladen wurde
    const html = await page.content();
    
    // Suche nach Gameplan-spezifischen Elementen
    const hasGameplanTitle = html.includes('Gameplan') || html.includes('Gamepläne');
    const hasNodes = html.includes('Standing') || html.includes('Half Guard');
    const hasLoading = html.includes('loading') || html.includes('Loading');
    const hasError = html.includes('error') || html.includes('404');
    
    console.log('\nPage Analysis:');
    console.log('  Has Gameplan title:', hasGameplanTitle);
    console.log('  Has Nodes (Standing/Half Guard):', hasNodes);
    console.log('  Has Loading indicator:', hasLoading);
    console.log('  Has Error:', hasError);
    
    // Suche nach Fehlermeldungen in Konsole
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      if (text.includes('error') || text.includes('Error') || text.includes('failed')) {
        console.log('[CONSOLE ERROR]', text);
      }
    });
    
    // Screenshot
    await page.screenshot({ path: 'test-results/gameplan-opening-debug.png', fullPage: true });
    
    // Prüfe auf 404
    const has404 = html.includes('404') || html.includes('This page could not be found');
    if (has404) {
      console.log('\n❌ ERROR: Gameplan page returned 404!');
    } else if (!hasNodes) {
      console.log('\n❌ ERROR: Gameplan loaded but no nodes visible!');
    } else {
      console.log('\n✅ SUCCESS: Gameplan loaded correctly!');
    }
    
    expect(onGameplan).toBe(true);
    expect(has404).toBe(false);
  });
  
  test('check gameplan API response', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('DEBUG: Gameplan API');
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
    
    // Call gameplan API
    console.log('Calling gameplan API...');
    const response = await request.get('http://localhost:3000/api/gameplan/active', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    });
    
    console.log('Response status:', response.status());
    
    if (response.ok()) {
      const data = await response.json();
      console.log('\nAPI Response:');
      console.log('  Has plan:', !!data.plan);
      console.log('  Plan ID:', data.plan?.id);
      console.log('  Plan Title:', data.plan?.title);
      console.log('  Nodes count:', Object.keys(data.plan?.nodes || {}).length);
      console.log('  Error:', data.error);
      
      if (data.error) {
        console.log('\n❌ API returned error:', data.error);
      } else if (!data.plan) {
        console.log('\n❌ API returned no plan!');
      } else {
        console.log('\n✅ API returned plan successfully');
      }
    } else {
      console.log('\n❌ API request failed:', response.status());
      const text = await response.text();
      console.log('Response text:', text.substring(0, 500));
    }
    
    expect(response.ok()).toBe(true);
  });
});