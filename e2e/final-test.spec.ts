import { test, expect } from '@playwright/test'

/**
 * FINAL TEST: Complete Verification
 */

test.describe('FINAL VERIFICATION', () => {
  test('verify all requirements', async ({ page }) => {
    test.setTimeout(180000);
    
    console.log('\n========================================');
    console.log('FINAL VERIFICATION');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    await page.waitForTimeout(10000);
    
    // 1. Startseite prüfen
    console.log('1. Startseite:');
    const htmlStart = await page.content();
    const progressMatches = htmlStart.match(/(\d+)\/(\d+)/g);
    console.log('   Progress:', progressMatches);
    
    const has29 = progressMatches?.some((p: string) => p.includes('/29'));
    if (has29) {
      console.log('   ✅ Zeigt /29');
    } else {
      console.log('   ❌ Zeigt kein /29');
    }
    
    // 2. Gameplan prüfen
    console.log('\n2. Gameplan:');
    await page.goto('http://localhost:3000/gameplan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(8000);
    
    const htmlGameplan = await page.content();
    const gameplanProgress = htmlGameplan.match(/(\d+)\/(\d+)/g);
    console.log('   Progress:', gameplanProgress);
    
    const gameplanHas29 = gameplanProgress?.some((p: string) => p.includes('/29'));
    if (gameplanHas29) {
      console.log('   ✅ Zeigt /29');
    } else {
      console.log('   ❌ Zeigt kein /29');
    }
    
    // 3. Half Guard Status
    const halfGuardIndex = htmlGameplan.toLowerCase().indexOf('half guard');
    if (halfGuardIndex > -1) {
      const halfGuardSection = htmlGameplan.substring(
        Math.max(0, halfGuardIndex - 200),
        Math.min(htmlGameplan.length, halfGuardIndex + 300)
      );
      console.log('\n3. Half Guard Status:');
      const isLocked = halfGuardSection.includes('locked') || halfGuardSection.includes('Lock');
      const isSilhouette = halfGuardSection.includes('silhouette');
      const isCurrent = halfGuardSection.includes('current');
      console.log('   State:', isLocked ? 'locked' : isSilhouette ? 'silhouette' : isCurrent ? 'current' : 'unknown');
      
      const progressMatch = halfGuardSection.match(/(\d+)\/(\d+)/);
      if (progressMatch) {
        console.log('   Progress:', progressMatch[0]);
      }
    }
    
    // Screenshots
    await page.screenshot({ path: 'test-results/final-gameplan.png', fullPage: true });
    
    console.log('\n========================================');
    
    expect(gameplanHas29).toBeTruthy();
  });
});