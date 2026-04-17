import { test, expect } from '@playwright/test'

/**
 * DEBUG: Trace data flow from API to UI
 */

test.describe('Debug Data Flow', () => {
  test('trace how API data flows to UI', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('DEBUG: Trace Data Flow')
    console.log('========================================\n')
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(3000)
    
    // Track API calls and their responses
    const apiCalls: any[] = []
    
    await page.route('**/api/gameplan/**', async (route, request) => {
      const response = await route.fetch()
      const body = await response.json()
      apiCalls.push({
        url: request.url(),
        status: response.status(),
        body: body
      })
      await route.fulfill({ response })
    })
    
    // Navigate to gameplan
    await page.goto('http://localhost:3000/gameplan')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)
    
    // Log all API calls
    console.log('\nAPI Calls made:')
    for (const call of apiCalls) {
      console.log(`\n${call.url}:`)
      if (call.body.plans) {
        console.log(`  Plans count: ${call.body.plans.length}`)
        if (call.body.plans.length > 0) {
          const plan = call.body.plans[0]
          console.log(`  Plan ID: ${plan.id}`)
          console.log(`  Plan Title: ${plan.title}`)
          console.log('  Nodes:')
          Object.entries(plan.nodes || {}).forEach(([id, node]: [string, any]) => {
            console.log(`    ${id}: ${node.title} - ${node.progressCompletedRules}/${node.progressTotalRules}`)
          })
        }
      }
      if (call.body.plan) {
        console.log(`  Plan ID: ${call.body.plan.id}`)
        console.log(`  Plan Title: ${call.body.plan.title}`)
        console.log('  Nodes:')
        Object.entries(call.body.plan.nodes || {}).forEach(([id, node]: [string, any]) => {
          console.log(`    ${id}: ${node.title} - ${node.progressCompletedRules}/${node.progressTotalRules}`)
        })
      }
    }
    
    // Check UI
    const html = await page.content()
    const standingIndex = html.toLowerCase().indexOf('standing')
    if (standingIndex > -1) {
      const surroundingHtml = html.substring(Math.max(0, standingIndex - 300), Math.min(html.length, standingIndex + 300))
      console.log('\n\nUI HTML around Standing:')
      console.log(surroundingHtml)
    }
    
    expect(true).toBe(true)
  })
})
