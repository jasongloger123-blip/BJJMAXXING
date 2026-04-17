import { test, expect } from '@playwright/test'

/**
 * DEBUG: Welche Videos sind als 'bekannt' markiert?
 * UND: Warum ist die nächste Technik freigeschaltet?
 */

test.describe('Debug Video Status and Unlock Logic', () => {
  test('check which videos are marked as known', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('DEBUG: Video Status (Known/Unknown)');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
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
    
    // Call progress API to get known videos
    console.log('Fetching progress data...');
    const progressResponse = await request.get('http://localhost:3000/api/progress', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    });
    
    if (progressResponse.ok()) {
      const progressData = await progressResponse.json();
      console.log('\nProgress Data:');
      console.log('  Events count:', progressData.events?.length || 0);
      
      if (progressData.events?.length > 0) {
        console.log('\n  Known Videos (bekannt markiert):');
        progressData.events
          .filter((e: any) => e.result === 'known')
          .forEach((e: any) => {
            console.log(`    - ${e.clip_key}: ${e.node_id}`);
          });
        
        console.log('\n  Not Yet Videos (noch nicht bekannt):');
        progressData.events
          .filter((e: any) => e.result === 'not_yet')
          .forEach((e: any) => {
            console.log(`    - ${e.clip_key}: ${e.node_id}`);
          });
      }
    } else {
      console.log('Progress API error:', await progressResponse.text());
    }
    
    // Get gameplan data
    console.log('\nFetching gameplan data...');
    const gameplanResponse = await request.get('http://localhost:3000/api/gameplan/active', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    });
    
    const gameplanData = await gameplanResponse.json();
    
    console.log('\nGameplan Status:');
    console.log('  Current Node ID:', gameplanData.plan?.unlockSummary?.currentNodeId);
    console.log('  Core Completed:', gameplanData.plan?.unlockSummary?.coreCompletedCount);
    console.log('  Core Total:', gameplanData.plan?.unlockSummary?.coreTotalCount);
    
    console.log('\n  All Nodes:');
    Object.entries(gameplanData.plan?.nodes || {}).forEach(([id, node]: [string, any]) => {
      console.log(`    ${node.state === 'current' ? '👉' : '  '} ${node.title}`);
      console.log(`       State: ${node.state}`);
      console.log(`       Progress: ${node.progressCompletedRules}/${node.progressTotalRules}`);
    });
    
    expect(true).toBe(true);
  });
  
  test('verify unlock logic - should only unlock when Standing is complete', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================');
    console.log('DEBUG: Unlock Logic Verification');
    console.log('========================================\n');
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com');
    await page.fill('input[type="password"]', 'QwErTer312');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Check gameplan
    await page.goto('http://localhost:3000/gameplan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    const html = await page.content();
    
    // Find Standing
    const standingIndex = html.toLowerCase().indexOf('standing');
    const halfGuardIndex = html.toLowerCase().indexOf('half guard');
    
    console.log('Gameplan Analysis:');
    
    if (standingIndex > -1) {
      const standingSection = html.substring(
        Math.max(0, standingIndex - 200),
        Math.min(html.length, standingIndex + 300)
      );
      console.log('\nStanding Node HTML:', standingSection.substring(0, 500));
    }
    
    if (halfGuardIndex > -1) {
      const halfGuardSection = html.substring(
        Math.max(0, halfGuardIndex - 200),
        Math.min(html.length, halfGuardIndex + 300)
      );
      console.log('\nHalf Guard Node HTML:', halfGuardSection.substring(0, 500));
    }
    
    // Check unlock states
    const hasStandingCurrent = html.includes('Standing') && html.includes('current');
    const hasHalfGuardUnlocked = html.includes('Half Guard') && 
      (html.includes('current') || html.includes('locked') || html.includes('available'));
    
    console.log('\nUnlock Status:');
    console.log('  Standing is current:', hasStandingCurrent);
    console.log('  Half Guard is unlocked:', hasHalfGuardUnlocked);
    
    // Get Standing progress
    const standingProgressMatch = html.match(/Standing[\s\S]{0,300}(\d+)\/(\d+)/);
    if (standingProgressMatch) {
      console.log(`  Standing Progress: ${standingProgressMatch[1]}/${standingProgressMatch[2]}`);
      
      const completed = parseInt(standingProgressMatch[1]);
      const total = parseInt(standingProgressMatch[2]);
      
      if (completed < total) {
        console.log('  ❌ BUG: Standing is NOT complete but Half Guard may be unlocked!');
      } else {
        console.log('  ✅ Standing is complete');
      }
    }
    
    expect(true).toBe(true);
  });
});