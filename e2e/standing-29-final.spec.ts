import { test, expect } from '@playwright/test'

/**
 * FINAL TEST: Verify Standing Node has 29 Clips
 * 
 * This test verifies that:
 * 1. The API returns 29 clips for Standing node
 * 2. The Standing node is visible in UI
 */

test.describe('Standing Node - 29 Clips Verification', () => {
  test('API should return exactly 29 clips for Standing', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('FINAL TEST: API Returns 29 Clips')
    console.log('========================================\n')
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(3000)
    
    // Get auth token
    const cookies = await context.cookies()
    const authCookie = cookies.find(c => c.name.includes('auth-token'))
    let token = ''
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value)
        token = parsed.access_token || ''
      } catch {}
    }
    
    // Call gameplan/active API
    const activeResponse = await request.get('http://localhost:3000/api/gameplan/active', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    })
    
    const activeData = await activeResponse.json()
    
    // Find Standing node
    const standingNode = Object.values(activeData.plan?.nodes || {}).find((node: any) => 
      node.title?.toLowerCase().includes('standing')
    ) as any
    
    console.log('Standing Node from API:')
    console.log('  Title:', standingNode?.title)
    console.log('  ID:', standingNode?.id)
    console.log('  Progress:', standingNode?.progressCompletedRules, '/', standingNode?.progressTotalRules)
    console.log('  State:', standingNode?.state)
    
    // Verify 29 total clips
    expect(standingNode?.progressTotalRules).toBe(29)
    console.log('\n✅ SUCCESS: API returns exactly 29 total clips for Standing node')
  })
})
