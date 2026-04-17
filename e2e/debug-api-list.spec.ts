import { test, expect } from '@playwright/test'

test.describe('Debug API list endpoint', () => {
  test('check list API response', async ({ page, context, request }) => {
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
      console.log('  Active plan ID:', listData.activePlanId)
      
      if (listData.plans?.length > 0) {
        const plan = listData.plans[0]
        console.log('\n  First plan:')
        console.log('    ID:', plan.id)
        console.log('    Title:', plan.title)
        console.log('    Source:', plan.source)
        console.log('    Nodes:')
        
        Object.entries(plan.nodes || {}).forEach(([id, node]: [string, any]) => {
          console.log(`      ${id}:`)
          console.log(`        title: ${node.title}`)
          console.log(`        progress: ${node.progressCompletedRules}/${node.progressTotalRules}`)
          console.log(`        state: ${node.state}`)
        })
      }
      
      const fs = require('fs')
      fs.writeFileSync('test-results/api-list-response.json', JSON.stringify(listData, null, 2))
      console.log('\nFull response saved to test-results/api-list-response.json')
    } else {
      console.log('List API error:', await listResponse.text())
    }
    
    expect(true).toBe(true)
  })
})
