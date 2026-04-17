import { test, expect } from '@playwright/test'

test.describe('Debug List API', () => {
  test('check list API response', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('DEBUG: Check List API')
    console.log('========================================\n')
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(3000)
    
    // Use browser fetch to call the API
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/gameplan/list', { cache: 'no-store' })
        const data = await response.json()
        
        console.log('API response:', JSON.stringify(data, null, 2))
        
        // Check for error
        if (data.error) {
          return { error: data.error, planCount: 0 }
        }
        
        // Find Standing node
        const nodes = data.plans?.[0]?.nodes || {}
        let standingNode: any = null
        let standingId = ''
        
        for (const [id, node] of Object.entries(nodes)) {
          const n = node as any
          if (n.title?.toLowerCase().includes('standing')) {
            standingNode = n
            standingId = id
            break
          }
        }
        
        return {
          planCount: data.plans?.length || 0,
          activePlanId: data.activePlanId,
          standingId,
          standingTitle: standingNode?.title,
          standingProgressCompleted: standingNode?.progressCompletedRules,
          standingProgressTotal: standingNode?.progressTotalRules,
          standingState: standingNode?.state,
          firstNodeTitles: Object.values(nodes).slice(0, 3).map((n: any) => n.title),
        }
      } catch (e: any) {
        return { error: e.message, planCount: 0 }
      }
    })
    
    console.log('Result:', JSON.stringify(result, null, 2))
    
    expect(result.standingProgressTotal).toBe(29)
    console.log('\n✅ TEST PASSED: Standing node has 29 total clips in List API')
  })
})