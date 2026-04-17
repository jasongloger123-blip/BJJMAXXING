import { test, expect } from '@playwright/test'

/**
 * PERFORMANCE TEST: Gameplan loading time analysis
 */

test.describe('Performance Analysis', () => {
  test('measure gameplan loading time', async ({ page }) => {
    test.setTimeout(180000);
    
    console.log('\n========================================');
    console.log('PERFORMANCE: Gameplan Loading Time');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Track API timing
    const apiTimings: { url: string; start: number; end: number; duration: number }[] = [];
    
    await page.route('**/api/**', async (route, request) => {
      const start = Date.now();
      const response = await route.fetch();
      const end = Date.now();
      
      apiTimings.push({
        url: request.url(),
        start,
        end,
        duration: end - start
      });
      
      await route.fulfill({ response });
    });
    
    // Navigate to gameplan and measure
    console.log('Navigating to gameplan...');
    const navigateStart = Date.now();
    
    await page.goto('http://localhost:3000/gameplan');
    
    // Wait for Standing to appear
    let foundStanding = false;
    let standingFoundTime = 0;
    
    for (let i = 0; i < 50; i++) {
      await page.waitForTimeout(500);
      const html = await page.content();
      
      if (html.includes('Standing') && !foundStanding) {
        foundStanding = true;
        standingFoundTime = Date.now() - navigateStart;
        console.log(`✅ Standing found after ${standingFoundTime}ms`);
        break;
      }
      
      if (i % 5 === 0) {
        console.log(`T+${i * 500}ms: Waiting for Standing...`);
      }
    }
    
    const totalTime = Date.now() - navigateStart;
    
    console.log('\n========================================');
    console.log('TIMING RESULTS:');
    console.log('========================================');
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Time until Standing visible: ${standingFoundTime}ms`);
    
    // Show API timings
    console.log('\nAPI Calls:');
    apiTimings.sort((a, b) => b.duration - a.duration).forEach(t => {
      console.log(`  ${t.url.split('/').pop()}: ${t.duration}ms`);
    });
    
    // Calculate slowest
    const slowest = apiTimings.sort((a, b) => b.duration - a.duration)[0];
    if (slowest) {
      console.log(`\nSlowest API call: ${slowest.url}`);
      console.log(`Duration: ${slowest.duration}ms`);
    }
    
    expect(foundStanding).toBe(true);
  });
});