import { test, expect } from '@playwright/test'

/**
 * TEST: Standing Videos müssen eigene Videos sein
 * NICHT die gleichen wie Half Guard
 */

test.describe('Standing Videos Test', () => {
  test('verify Standing has own videos, not Half Guard videos', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('TEST: Standing Videos');
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
    
    // 1. API-Test: Welche Videos hat Standing?
    console.log('1. Testing API for Standing...');
    const standingApiResponse = await request.get('http://localhost:3000/api/node-clips?nodeId=technique-08d5e574', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    });
    
    const standingData = await standingApiResponse.json();
    const standingVideos = standingData.groups?.main_reference || [];
    
    console.log(`   Standing has ${standingVideos.length} videos`);
    console.log('   First Standing video:', standingVideos[0]?.title);
    console.log('   Second Standing video:', standingVideos[1]?.title);
    
    // 2. API-Test: Welche Videos hat Half Guard?
    console.log('\n2. Testing API for Half Guard...');
    const halfGuardApiResponse = await request.get('http://localhost:3000/api/node-clips?nodeId=technique-23f0717b', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    });
    
    const halfGuardData = await halfGuardApiResponse.json();
    const halfGuardVideos = halfGuardData.groups?.main_reference || [];
    
    console.log(`   Half Guard has ${halfGuardVideos.length} videos`);
    console.log('   First Half Guard video:', halfGuardVideos[0]?.title);
    console.log('   Second Half Guard video:', halfGuardVideos[1]?.title);
    
    // 3. Vergleiche
    console.log('\n3. Comparison:');
    const standingFirstTitle = standingVideos[0]?.title?.toLowerCase() || '';
    const halfGuardFirstTitle = halfGuardVideos[0]?.title?.toLowerCase() || '';
    
    if (standingFirstTitle === halfGuardFirstTitle) {
      console.log('   ❌ ERROR: Standing and Half Guard have the SAME first video!');
      console.log('   Video title:', standingVideos[0]?.title);
    } else {
      console.log('   ✅ OK: Standing and Half Guard have different videos');
    }
    
    // 4. Check Standing has 29 videos
    const standingHas29 = standingVideos.length >= 29;
    console.log('\n4. Video count check:');
    console.log('   Standing has', standingVideos.length, 'videos (expected: 29)');
    
    if (standingHas29) {
      console.log('   ✅ Standing has 29 or more videos');
    } else {
      console.log('   ❌ Standing has only', standingVideos.length, 'videos (should be 29)');
    }
    
    // 5. UI-Test: Klicke auf Standing und prüfe Videos
    console.log('\n5. UI Test: Click on Standing...');
    await page.goto('http://localhost:3000/gameplan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Warte 5 Sekunden
    
    // Klicke auf Standing
    const standingButton = await page.locator('button:has-text("Standing")').first();
    if (await standingButton.isVisible().catch(() => false)) {
      await standingButton.click();
      console.log('   Clicked on Standing');
      
      // Warte 30 Sekunden auf Videos (wie vom Benutzer gewünscht)
      console.log('   Waiting 30 seconds for videos to load...');
      await page.waitForTimeout(30000);
      
      // Prüfe angezeigtes Video
      const html = await page.content();
      const videoTitleMatch = html.match(/Less Impressed|Half Guard|Standing|Wrestle Up|Takedown/i);
      
      console.log('   Video found:', videoTitleMatch ? videoTitleMatch[0] : 'None');
      
      // Prüfe Video-Counter
      const counterMatch = html.match(/(\d+)\s*\/\s*(\d+)/);
      if (counterMatch) {
        console.log('   Video counter:', counterMatch[0]);
      }
      
      // Screenshot
      await page.screenshot({ path: 'test-results/standing-videos.png', fullPage: true });
      
      // Überprüfe dass das Video nicht "Half Guard" enthält
      const hasHalfGuardInTitle = html.toLowerCase().includes('half guard passing') || 
                                   html.toLowerCase().includes('less impressed');
      
      if (hasHalfGuardInTitle) {
        console.log('   ❌ FAIL: Standing is showing Half Guard videos!');
      } else {
        console.log('   ✅ PASS: Standing has correct videos');
      }
      
      expect(hasHalfGuardInTitle).toBe(false);
    } else {
      console.log('   ❌ Standing button not found');
    }
    
    // Final assertions
    expect(standingHas29).toBe(true);
    expect(standingFirstTitle).not.toBe(halfGuardFirstTitle);
  });
  
  test('verify 30 second wait time for videos', async ({ page }) => {
    test.setTimeout(90000);
    
    console.log('\n========================================');
    console.log('TEST: 30 Second Wait Time');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Go to gameplan
    await page.goto('http://localhost:3000/gameplan');
    await page.waitForLoadState('networkidle');
    
    const startTime = Date.now();
    
    // Wait for Standing to be visible
    let standingVisible = false;
    while (!standingVisible && Date.now() - startTime < 30000) {
      const html = await page.content();
      standingVisible = html.includes('Standing');
      if (!standingVisible) {
        await page.waitForTimeout(500);
      }
    }
    
    const standingLoadTime = Date.now() - startTime;
    console.log(`Standing loaded after ${standingLoadTime}ms`);
    
    // Click on Standing
    const standingButton = await page.locator('button:has-text("Standing")').first();
    if (await standingButton.isVisible().catch(() => false)) {
      await standingButton.click();
      
      const clickTime = Date.now();
      
      // Wait for video panel to appear
      let videoLoaded = false;
      while (!videoLoaded && Date.now() - clickTime < 30000) {
        const html = await page.content();
        videoLoaded = html.includes('iframe') || html.includes('youtube');
        if (!videoLoaded) {
          await page.waitForTimeout(500);
        }
      }
      
      const videoLoadTime = Date.now() - clickTime;
      console.log(`Video loaded after ${videoLoadTime}ms`);
      
      if (videoLoadTime > 30000) {
        console.log('⚠️ Warning: Video took more than 30 seconds to load');
      } else {
        console.log(`✅ Video loaded within ${videoLoadTime}ms`);
      }
      
      expect(videoLoaded).toBe(true);
    }
  });
});