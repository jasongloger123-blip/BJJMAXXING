import { test, expect } from '@playwright/test'

/**
 * FINAL TEST: Gameplan Complete Test
 */

test.describe('FINAL GAMEPLAN TEST', () => {
  test('complete gameplan test', async ({ page }) => {
    test.setTimeout(180000);
    
    console.log('\n========================================');
    console.log('FINAL GAMEPLAN TEST');
    console.log('========================================\n');
    
    // 1. Login
    console.log('1. Login...');
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    
    const urlAfterLogin = page.url();
    console.log('URL after login:', urlAfterLogin);
    
    // 2. Navigate to gameplan
    console.log('\n2. Navigate to gameplan...');
    await page.goto('http://localhost:3000/gameplan');
    
    // Wait and track loading
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(2000);
      const url = page.url();
      const html = await page.content();
      
      console.log(`T+${i*2}s: URL=${url}, Has Standing=${html.includes('Standing')}, Has 404=${html.includes('404')}`);
      
      if (html.includes('Standing')) {
        console.log('✅ SUCCESS: Standing found!');
        break;
      }
    }
    
    // Final check
    const finalHtml = await page.content();
    const hasStanding = finalHtml.includes('Standing');
    const has29 = finalHtml.includes('/29');
    const has1313 = finalHtml.includes('13/13');
    
    console.log('\n========================================');
    console.log('FINAL RESULT:');
    console.log('========================================');
    console.log('Has Standing:', hasStanding);
    console.log('Has /29:', has29);
    console.log('Has 13/13:', has1313);
    
    // Screenshot
    await page.screenshot({ path: 'test-results/final-gameplan.png', fullPage: true });
    
    expect(hasStanding).toBe(true);
  });
});