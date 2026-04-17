import { test, expect } from '@playwright/test'

test.describe('Debug Plan Structure', () => {
  test('compare API vs UI data', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('DEBUG: Compare API vs UI')
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
    
    // Call gameplan/list API
    console.log('Calling /api/gameplan/list...')
    const listResponse = await request.get('http://localhost:3000/api/gameplan/list', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    })
    
    if (listResponse.ok()) {
      const listData = await listResponse.json()
      console.log('\nList API Response:')
      console.log('  Plans count:', listData.plans?.length || 0)
      if (listData.plans?.length > 0) {
        const firstPlan = listData.plans[0]
        console.log('  First plan ID:', firstPlan.id)
        console.log('  First plan nodes:')
        Object.entries(firstPlan.nodes || {}).forEach(([id, node]: [string, any]) => {
          console.log(`    ${id}: ${node.title} - progress ${node.progressCompletedRules}/${node.progressTotalRules}`)
        })
      }
    } else {
      console.log('List API error:', await listResponse.text())
    }
    
    // Call gameplan/active API
    console.log('\nCalling /api/gameplan/active...')
    const activeResponse = await request.get('http://localhost:3000/api/gameplan/active', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    })
    
    const activeData = await activeResponse.json()
    console.log('\nActive API Response:')
    console.log('  Plan ID:', activeData.plan?.id)
    console.log('  Plan Title:', activeData.plan?.title)
    console.log('  Plan Source:', activeData.plan?.source)
    console.log('  Nodes:')
    Object.entries(activeData.plan?.nodes || {}).forEach(([id, node]: [string, any]) => {
      console.log(`    ${id}: ${node.title}`)
      console.log(`      sourceNodeId: ${node.sourceNodeId}`)
      console.log(`      progress: ${node.progressCompletedRules}/${node.progressTotalRules}`)
      console.log(`      state: ${node.state}`)
    })
    
    // Save full response for analysis
    const fs = require('fs')
    fs.writeFileSync('test-results/api-active-response.json', JSON.stringify(activeData, null, 2))
    console.log('\nFull API response saved to test-results/api-active-response.json')
    
    // Now check what the UI loads
    console.log('\n\nStep 2: Navigating to gameplan page...')
    
    // Track API calls from the page
    const apiCalls: string[] = []
    await page.route('**/api/gameplan/**', async (route, request) => {
      apiCalls.push(request.url())
      console.log('  Page API call:', request.url())
      await route.continue()
    })
    
    await page.goto('http://localhost:3000/gameplan')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)
    
    console.log('\nAPI calls made by page:', apiCalls)
    
    // Get page content around Standing
    const html = await page.content()
    const standingIndex = html.toLowerCase().indexOf('standing')
    if (standingIndex > -1) {
      const surroundingHtml = html.substring(Math.max(0, standingIndex - 300), Math.min(html.length, standingIndex + 300))
      console.log('\nHTML around Standing:')
      console.log(surroundingHtml)
    }
    
    expect(true).toBe(true)
  })
})
