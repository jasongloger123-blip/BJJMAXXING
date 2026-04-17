import { test, expect } from '@playwright/test'

test.describe('Debug List API with cookies', () => {
  test('check list API response using browser fetch', async ({ page, context }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('DEBUG: Check List API with Browser Fetch')
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
    const listData = await page.evaluate(async () => {
      const response = await fetch('/api/gameplan/list', { cache: 'no-store' })
      return await response.json()
    })
    
    console.log('List API Response:')
    console.log('  Plans count:', listData.plans?.length || 0)
    console.log('  Active plan ID:', listData.activePlanId)
    console.log('  Disabled plan IDs:', listData.disabledPlanIds)
    
    if (listData.plans?.length > 0) {
      const plan = listData.plans[0]
      console.log('\n  First plan:')
      console.log('    ID:', plan.id)
      console.log('    Title:', plan.title)
      console.log('    Source:', plan.source)
      console.log('    Nodes:')
      
      Object.entries(plan.nodes || {}).forEach((entry: [string, any]) => {
        const [id, node] = entry
        console.log(`      ${id}:`)
        console.log(`        title: ${node.title}`)
        console.log(`        progressCompletedRules: ${node.progressCompletedRules}`)
        console.log(`        progressTotalRules: ${node.progressTotalRules}`)
        console.log(`        state: ${node.state}`)
      })
      
      // Find Standing node
      const standingEntry = Object.entries(plan.nodes || {}).find((entry: [string, any]) => {
        const [, node] = entry
        return node.title?.toLowerCase().includes('standing')
      })
      
      if (standingEntry) {
        const [id, standingNode] = standingEntry
        console.log('\n  STANDING NODE FOUND:')
        console.log('    ID:', id)
        console.log('    Title:', standingNode.title)
        console.log('    progressCompletedRules:', standingNode.progressCompletedRules)
        console.log('    progressTotalRules:', standingNode.progressTotalRules)
        
        expect(standingNode.progressTotalRules).toBe(29)
        console.log('\n✅ TEST PASSED: Standing node has 29 total clips in List API')
      } else {
        console.log('\n  ERROR: Standing node not found!')
      }
    } else {
      console.log('  ERROR: No plans returned')
      console.log('  Response error:', listData.error)
    }
    
    expect(listData.plans?.length).toBeGreaterThan(0)
  })
})