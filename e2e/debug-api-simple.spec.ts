import { test, expect } from '@playwright/test'

test.describe('Simple API Debug', () => {
  test('check what API returns', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('DEBUG: Simple API Check')
    console.log('========================================\n')
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(3000)
    
    // Get auth token from cookies
    const cookies = await context.cookies()
    const authCookie = cookies.find(c => c.name.includes('auth-token'))
    console.log('Auth cookie found:', !!authCookie)
    if (authCookie) {
      console.log('Cookie name:', authCookie.name)
      try {
        const parsed = JSON.parse(authCookie.value)
        console.log('Has access_token:', !!parsed.access_token)
        console.log('Token length:', parsed.access_token?.length || 0)
      } catch {}
    }
    
    // Get auth token
    let token = ''
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value)
        token = parsed.access_token || ''
      } catch {}
    }
    
    // Call gameplan/active API
    console.log('\nCalling /api/gameplan/active...')
    const activeResponse = await request.get('http://localhost:3000/api/gameplan/active', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    })
    
    console.log('Response status:', activeResponse.status())
    const activeData = await activeResponse.json()
    
    console.log('\nAPI Response:')
    console.log('  Plan ID:', activeData.plan?.id)
    console.log('  Plan Title:', activeData.plan?.title)
    console.log('  Plan Source:', activeData.plan?.source)
    console.log('  Error:', activeData.error)
    
    if (activeData.plan?.nodes) {
      console.log('\n  Nodes:')
      Object.entries(activeData.plan.nodes).forEach(([id, node]: [string, any]) => {
        console.log(`    ${id}: ${node.title}`)
      })
    }
    
    expect(activeData.plan).toBeDefined()
  })
})