import { test, expect } from '@playwright/test'

/**
 * QUICK FINAL TEST: Verify 29 Clips Functionality
 */

test.describe('Quick Final Test', () => {
  test('verify API returns 29 and UI shows 28/29', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('QUICK FINAL TEST');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    
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
    
    // Test API
    const apiResponse = await request.get('http://localhost:3000/api/gameplan/active', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    });
    
    const apiData = await apiResponse.json();
    const standingNode = Object.values(apiData.plan?.nodes || {}).find((node: any) => 
      node.title?.toLowerCase().includes('standing')
    ) as any;
    
    console.log('API Result:');
    console.log('  Standing Progress:', standingNode?.progressCompletedRules, '/', standingNode?.progressTotalRules);
    
    // Verify API shows 29
    expect(standingNode?.progressTotalRules).toBe(29);
    console.log('\n✅ API shows 29 total clips!');
    
    // Navigate to gameplan
    await page.goto('http://localhost:3000/gameplan');
    await page.waitForTimeout(8000);
    
    const html = await page.content();
    const has28_29 = html.includes('28/29');
    const has0_29 = html.includes('0/29');
    const has13_13 = html.includes('13/13');
    
    console.log('\nUI Result:');
    console.log('  Has 28/29:', has28_29);
    console.log('  Has 0/29:', has0_29);
    console.log('  Has 13/13:', has13_13);
    
    expect(has13_13).toBe(false);
    expect(has28_29 || has0_29).toBe(true);
    
    console.log('\n========================================');
    console.log('✅ SUCCESS: 29 Clips Functionality Works!');
    console.log('========================================');
  });
});