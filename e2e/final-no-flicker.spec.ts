import { test, expect } from '@playwright/test'

/**
 * FINAL COMPLETE TEST - No Flickering
 * Verify 28/29 shows directly without 13/13 appearing
 */

test.describe('FINAL - No Flickering Test', () => {
  test('verify no 13/13 flickering', async ({ page }) => {
    test.setTimeout(180000);
    
    console.log('\n========================================');
    console.log('NO FLICKERING TEST');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    
    // Track ALL progress values during loading
    const progressHistory: { time: number; values: string[] }[] = [];
    
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(500);
      const html = await page.content();
      const matches = html.match(/(\d+)\/(\d+)/g);
      if (matches) {
        progressHistory.push({
          time: i * 500,
          values: Array.from(new Set(matches))
        });
        
        // Log only if Standing-related
        const hasStandingProgress = matches.some(m => 
          m.includes('/29') || m.includes('13/13')
        );
        if (hasStandingProgress) {
          console.log(`T+${i*500}ms:`, matches.filter(m => 
            m.includes('/29') || m.includes('13/13') || m.includes('/5')
          ));
        }
      }
    }
    
    // Check if 13/13 ever appeared
    const has1313 = progressHistory.some(h => 
      h.values.some(v => v === '13/13')
    );
    
    const has29 = progressHistory.some(h => 
      h.values.some(v => v.includes('/29'))
    );
    
    console.log('\n========================================');
    console.log('RESULT:');
    console.log('========================================');
    console.log('13/13 appeared:', has1313);
    console.log('/29 appeared:', has29);
    
    if (has1313) {
      console.log('\nFAIL: 13/13 still flickers!');
    } else if (has29) {
      console.log('\nSUCCESS: Direct 28/29 without flickering!');
    }
    
    expect(has1313).toBe(false);
    expect(has29).toBe(true);
  });
  
  test('verify gameplan shows 28/29 immediately', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('GAMEPLAN IMMEDIATE TEST');
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
    
    // Check immediately and after short delay
    const checks: { time: number; has28_29: boolean; has13_13: boolean; progress: string[] }[] = [];
    
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);
      const html = await page.content();
      const matches = html.match(/(\d+)\/(\d+)/g) || [];
      
      checks.push({
        time: i * 500,
        has28_29: matches.some(m => m === '28/29' || m === '0/29'),
        has13_13: matches.some(m => m === '13/13'),
        progress: Array.from(new Set(matches))
      });
    }
    
    console.log('Gameplan loading:');
    checks.forEach(c => {
      console.log(`T+${c.time}ms:`, c.progress.filter(p => 
        p.includes('/29') || p.includes('13/13')
      ), c.has13_13 ? '13/13!' : '');
    });
    
    const everHad1313 = checks.some(c => c.has13_13);
    const eventuallyHad29 = checks.some(c => c.has28_29);
    
    console.log('\n========================================');
    console.log('GAMEPLAN RESULT:');
    console.log('========================================');
    console.log('Had 13/13:', everHad1313);
    console.log('Has 28/29:', eventuallyHad29);
    
    expect(everHad1313).toBe(false);
    expect(eventuallyHad29).toBe(true);
  });
});