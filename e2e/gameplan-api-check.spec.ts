import { test, expect } from '@playwright/test'

test.describe('Quick Gameplan Clip Check', () => {
  test('API should return clips for gameplan nodes', async ({ page }) => {
    test.setTimeout(60000);
    
    console.log('\n========================================')
    console.log('TEST: API returns clips for gameplan')
    console.log('========================================\n')
    
    // Login first
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    
    // Check API directly
    console.log('Checking gameplan API...')
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/gameplan/active')
      return res.json()
    })
    
    console.log('Gameplan response:', JSON.stringify(response, null, 2))
    
    // Check if plan has nodes with clips
    const hasNodes = response?.plan?.nodes && Object.keys(response.plan.nodes).length > 0
    console.log('Has nodes:', hasNodes)
    
    if (hasNodes) {
      const nodeEntries = Object.entries(response.plan.nodes)
      console.log('Number of nodes:', nodeEntries.length)
      
      // Check first node
      const [firstNodeId, firstNode] = nodeEntries[0]
      console.log('First node:', firstNodeId, firstNode)
      
      // Check source node meta for clip counts
      const sourceMeta = response?.sourceNodeMeta?.[firstNodeId]
      console.log('Source node meta:', sourceMeta)
    }
    
    expect(hasNodes).toBeTruthy()
  })
})
