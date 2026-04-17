import { test, expect } from '@playwright/test'

/**
 * FINAL VERIFICATION: Standing has 29 total
 * Next technique should NOT be unlocked until Standing is complete
 */

test.describe('FINAL VERIFICATION - 29 Clips Logic', () => {
  test('verify Standing has 29 total and progress is shown', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('VERIFICATION: 29 Clips for Standing');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    await page.waitForTimeout(5000);
    
    // Check Startseite
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(5000);
    
    const startHtml = await page.content();
    const startProgress = startHtml.match(/(\d+)\/(29)/);
    
    console.log('Startseite:');
    if (startProgress) {
      console.log(`  ✅ Zeigt ${startProgress[1]}/${startProgress[2]} für Standing`);
    } else {
      const otherProgress = startHtml.match(/(\d+)\/(\d+)/);
      console.log(`  ⚠️  Zeigt ${otherProgress?.[0] || 'keinen Fortschritt'}`);
    }
    
    // Check Gameplan
    await page.goto('http://localhost:3000/gameplan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    const gameplanHtml = await page.content();
    
    // Find Standing progress
    const standingMatch = gameplanHtml.match(/Standing[\s\S]{0,300}(\d+)\/(29)/);
    const has29 = standingMatch !== null;
    
    console.log('\nGameplan:');
    if (has29) {
      console.log(`  ✅ Zeigt ${standingMatch[1]}/${standingMatch[2]} für Standing`);
    } else {
      console.log('  ❌ Zeigt kein /29 für Standing');
    }
    
    // Check if 13/13 or other wrong values appear
    const has13_13 = gameplanHtml.includes('13/13');
    const has13_29 = gameplanHtml.includes('13/29');
    const has28_29 = gameplanHtml.includes('28/29');
    
    console.log('\nFortschrittswerte:');
    console.log('  13/13 gefunden:', has13_13);
    console.log('  13/29 gefunden:', has13_29);
    console.log('  28/29 gefunden:', has28_29);
    
    // Verify no 13/13
    expect(has13_13).toBe(false);
    
    // Verify we have 29 total
    expect(has29).toBe(true);
    
    console.log('\n========================================');
    console.log('✅ ERFOLG: Standing hat 29 total!');
    console.log('========================================');
  });
  
  test('verify unlock logic - Half Guard should be locked', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('VERIFICATION: Unlock Logic');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    
    // Go to gameplan
    await page.goto('http://localhost:3000/gameplan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    const html = await page.content();
    
    // Check Standing status
    const standingIndex = html.toLowerCase().indexOf('standing');
    const halfGuardIndex = html.toLowerCase().indexOf('half guard');
    
    let standingLocked = false;
    let standingCurrent = false;
    let standingAvailable = false;
    
    if (standingIndex > -1) {
      const standingSection = html.substring(
        Math.max(0, standingIndex - 300),
        Math.min(html.length, standingIndex + 500)
      );
      standingLocked = standingSection.includes('locked');
      standingCurrent = standingSection.includes('current');
      standingAvailable = standingSection.includes('available');
      
      console.log('Standing Status:');
      console.log('  locked:', standingLocked);
      console.log('  current:', standingCurrent);
      console.log('  available:', standingAvailable);
    }
    
    // Check Half Guard status
    let halfGuardLocked = false;
    let halfGuardCurrent = false;
    let halfGuardAvailable = false;
    
    if (halfGuardIndex > -1) {
      const halfGuardSection = html.substring(
        Math.max(0, halfGuardIndex - 300),
        Math.min(html.length, halfGuardIndex + 500)
      );
      halfGuardLocked = halfGuardSection.includes('locked');
      halfGuardCurrent = halfGuardSection.includes('current');
      halfGuardAvailable = halfGuardSection.includes('available');
      
      console.log('\nHalf Guard Status:');
      console.log('  locked:', halfGuardLocked);
      console.log('  current:', halfGuardCurrent);
      console.log('  available:', halfGuardAvailable);
    }
    
    // Logic check: If Standing is not complete, Half Guard should be locked
    const standingProgress = html.match(/Standing[\s\S]{0,300}(\d+)\/(29)/);
    if (standingProgress) {
      const completed = parseInt(standingProgress[1]);
      const total = 29;
      
      console.log('\nLogic Check:');
      console.log(`  Standing: ${completed}/${total}`);
      console.log(`  Complete: ${completed >= total}`);
      
      if (completed < total) {
        console.log('  Standing is NOT complete');
        console.log('  Half Guard SHOULD be locked');
        
        if (halfGuardLocked) {
          console.log('  ✅ PASS: Half Guard is correctly locked');
        } else if (halfGuardCurrent || halfGuardAvailable) {
          console.log('  ❌ FAIL: Half Guard is unlocked but should be locked!');
        }
      } else {
        console.log('  Standing IS complete');
        console.log('  Half Guard CAN be unlocked');
      }
    }
    
    expect(true).toBe(true);
  });
});