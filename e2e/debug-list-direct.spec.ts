import { test, expect } from '@playwright/test'

test.describe('Debug List API Direct', () => {
  test('call list API with browser context', async ({ page, context }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('DEBUG: List API Direct Call')
    console.log('========================================\n')
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(3000)
    
    // Get current URL and cookies
    const cookies = await context.cookies()
    console.log('Cookies after login:')
    cookies.forEach(c => {
      console.log(`  ${c.name}: ${c.value.substring(0, 50)}...`)
    })
    
    // Use page.evaluate to make the fetch call in browser context
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/gameplan/list', {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        console.log('Response status:', response.status)
        const data = await response.json()
        
        if (data.error) {
          return { error: data.error, status: response.status }
        }
        
        // Find Standing node
        const plans = data.plans || []
        let standingNode = null
        
        for (const plan of plans) {
          const nodes = plan.nodes || {}
          for (const [id, node] of Object.entries(nodes)) {
            const n = node as any
            if (n.title?.toLowerCase().includes('standing')) {
              standingNode = {
                id,
                title: n.title,
                progressCompletedRules: n.progressCompletedRules,
                progressTotalRules: n.progressTotalRules,
                state: n.state
              }
              break
            }
          }
          if (standingNode) break
        }
        
        return {
          status: response.status,
          planCount: plans.length,
          standingNode,
          hasError: !!data.error
        }
      } catch (e: any) {
        return { error: e.message, hasError: true }
      }
    })
    
    console.log('\nResult:', JSON.stringify(result, null, 2))
    
    if (result.standingNode) {
      console.log('\nStanding Node found:')
      console.log('  Title:', result.standingNode.title)
      console.log('  Progress:', result.standingNode.progressCompletedRules, '/', result.standingNode.progressTotalRules)
      
      expect(result.standingNode.progressTotalRules).toBe(29)
      console.log('\n✅ TEST PASSED: List API returns 29 clips for Standing')
    } else {
      console.log('\nNo Standing node found or API returned error')
      console.log('  Error:', result.error)
      console.log('  Status:', result.status)
    }
  })
})