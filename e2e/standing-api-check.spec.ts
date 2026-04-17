import { test, expect } from '@playwright/test'

/**
 * TEST: Direct API check for Standing node clip count
 */

test.describe('Standing Node Direct API Check', () => {
  test('API should return 29 clips for Standing node', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('TEST: Direct API Check for Standing Node')
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
    console.log('Calling /api/gameplan/active...')
    const activeResponse = await request.get('http://localhost:3000/api/gameplan/active', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    })
    
    const activeData = await activeResponse.json()
    
    console.log('\n--- API Response ---')
    console.log('Plan ID:', activeData.plan?.id)
    console.log('Plan Title:', activeData.plan?.title)
    console.log('Plan Source:', activeData.plan?.source)
    
    // Find Standing node
    const nodes = activeData.plan?.nodes || {}
    console.log('\nAll nodes in plan:')
    Object.entries(nodes).forEach(([id, node]: [string, any]) => {
      console.log(`  ${id}: ${node.title}`)
      console.log(`    sourceNodeId: ${node.sourceNodeId || 'null'}`)
      console.log(`    progress: ${node.progressCompletedRules}/${node.progressTotalRules}`)
    })
    
    const standingNode = Object.values(nodes).find((node: any) => 
      node.title?.toLowerCase().includes('standing')
    ) as any
    
    if (standingNode) {
      console.log('\n========================================')
      console.log('STANDING NODE FOUND:')
      console.log('========================================')
      console.log('Title:', standingNode.title)
      console.log('ID:', standingNode.id)
      console.log('Source Node ID:', standingNode.sourceNodeId)
      console.log('Progress:', standingNode.progressCompletedRules, '/', standingNode.progressTotalRules)
      console.log('Progress %:', standingNode.progressPercent)
      
      // Verify
      expect(standingNode.progressTotalRules).toBe(29)
      console.log('\n✅ TEST PASSED: Standing node has 29 total clips in API response')
    } else {
      console.log('ERROR: Standing node not found in plan!')
      expect(standingNode).toBeDefined()
    }
  })
})
