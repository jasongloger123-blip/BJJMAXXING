import { test, expect } from '@playwright/test'

/**
 * TEST: Klicke auf Standing und warte 30 Sekunden auf Videos
 */

test.describe('Standing Video Loading Test', () => {
  test('click Standing and wait 30 seconds for videos', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('TEST: Click Standing + 30s Wait');
    console.log('========================================\n');
    
    // Login
    console.log('1. Login...');
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    
    // Gehe zum Gameplan
    console.log('2. Gehe zu Gameplan...');
    await page.goto('http://localhost:3000/gameplan');
    await page.waitForTimeout(5000);
    
    // Klicke auf Standing
    console.log('3. Klicke auf Standing...');
    const standingButton = page.locator('button:has-text("Standing")').first();
    
    // Warte bis Standing sichtbar
    let attempts = 0;
    let standingVisible = false;
    while (!standingVisible && attempts < 20) {
      standingVisible = await standingButton.isVisible().catch(() => false);
      if (!standingVisible) {
        await page.waitForTimeout(500);
        attempts++;
      }
    }
    
    if (!standingVisible) {
      console.log('❌ Standing Button nicht gefunden!');
      const html = await page.content();
      console.log('HTML enthält Standing:', html.includes('Standing'));
      throw new Error('Standing button not visible');
    }
    
    console.log('✅ Standing Button gefunden, klicke...');
    await standingButton.click();
    
    // WARTE 30 SEKUNDEN (wie gewünscht)
    console.log('4. Warte 30 Sekunden auf Videos...');
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      process.stdout.write('.');
    }
    console.log(''); // Neue Zeile
    
    // Prüfe das Ergebnis
    console.log('5. Prüfe Ergebnis...');
    const html = await page.content();
    
    // Suche nach Video-Elementen
    const hasVideo = html.includes('iframe') || html.includes('youtube.com/embed');
    const hasVideoPanel = html.includes('clip-embed-shell');
    const hasVideoTitle = html.match(/Less Impressed|Half Guard|Standing|Wrestle|Tim Gorer/i);
    
    console.log('\nErgebnis:');
    console.log('  - Video (iframe):', hasVideo);
    console.log('  - Video Panel:', hasVideoPanel);
    console.log('  - Video Titel:', hasVideoTitle ? hasVideoTitle[0] : 'Keiner gefunden');
    
    // Suche Counter (z.B. "1 / 29")
    const counterMatch = html.match(/(\d+)\s*\/\s*(\d+)/);
    if (counterMatch) {
      console.log('  - Video Counter:', counterMatch[0]);
    }
    
    // Suche Hashtags
    const hashtagMatch = html.match(/#standing|#halfguard|#wrestle/gi);
    if (hashtagMatch) {
      console.log('  - Hashtags:', hashtagMatch.slice(0, 5).join(', '));
    }
    
    // Screenshot
    await page.screenshot({ path: 'test-results/standing-after-30s.png', fullPage: true });
    
    // Überprüfe dass es kein Half Guard Video ist
    const hasHalfGuardTitle = html.toLowerCase().includes('half guard passing') ||
                              html.toLowerCase().includes('less impressed');
    
    if (hasHalfGuardTitle) {
      console.log('\n❌ FEHLER: Es wird immer noch ein Half Guard Video angezeigt!');
    } else if (hasVideo) {
      console.log('\n✅ ERFOLG: Standing Video wird angezeigt (kein Half Guard)!');
    } else {
      console.log('\n⚠️ Kein Video geladen');
    }
    
    // Ergebnis
    expect(hasHalfGuardTitle).toBe(false);
  });
  
  test('verify Standing has different videos than Half Guard', async ({ page, context, request }) => {
    test.setTimeout(60000);
    
    console.log('\n========================================');
    console.log('TEST: Standing vs Half Guard Videos');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
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
    
    // API-Test: Standing
    console.log('API Test: Standing...');
    const standingResponse = await request.get('http://localhost:3000/api/node-clips?nodeId=technique-08d5e574', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    });
    const standingData = await standingResponse.json();
    const standingVideos = standingData.groups?.main_reference || [];
    
    console.log(`  Standing hat ${standingVideos.length} Videos`);
    if (standingVideos.length > 0) {
      console.log('  Erstes Video:', standingVideos[0].title);
      console.log('  Zweites Video:', standingVideos[1]?.title);
    }
    
    // API-Test: Half Guard
    console.log('\nAPI Test: Half Guard...');
    const halfGuardResponse = await request.get('http://localhost:3000/api/node-clips?nodeId=technique-23f0717b', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    });
    const halfGuardData = await halfGuardResponse.json();
    const halfGuardVideos = halfGuardData.groups?.main_reference || [];
    
    console.log(`  Half Guard hat ${halfGuardVideos.length} Videos`);
    if (halfGuardVideos.length > 0) {
      console.log('  Erstes Video:', halfGuardVideos[0].title);
      console.log('  Zweites Video:', halfGuardVideos[1]?.title);
    }
    
    // Vergleiche
    console.log('\nVergleich:');
    const standingFirst = standingVideos[0]?.title?.toLowerCase() || '';
    const halfGuardFirst = halfGuardVideos[0]?.title?.toLowerCase() || '';
    
    if (standingFirst === halfGuardFirst) {
      console.log('  ❌ GLEICHE Videos!');
    } else {
      console.log('  ✅ VERSCHIEDENE Videos!');
    }
    
    // Standing muss 29 haben
    expect(standingVideos.length).toBeGreaterThanOrEqual(29);
    expect(standingFirst).not.toBe(halfGuardFirst);
  });
});