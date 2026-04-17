import { test, expect } from '@playwright/test'

/**
 * DEBUG: Detaillierte API-Analyse
 */

test.describe('Debug API Detailed', () => {
  test('analyze API step by step', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('DETAILED API DEBUG')
    console.log('========================================\n')
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(3000)
    
    // Get cookies
    const cookies = await context.cookies()
    const authCookie = cookies.find(c => c.name.includes('auth-token'))
    let token = ''
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value)
        token = parsed.access_token || ''
      } catch {}
    }
    
    // Check user profile
    console.log('Step 1: Checking user profile...')
    const userResponse = await request.get('http://localhost:3000/api/user/profile', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    })
    
    if (userResponse.ok()) {
      const userData = await userResponse.json()
      console.log('User profile:', JSON.stringify(userData, null, 2))
    } else {
      console.log('User profile error:', await userResponse.text())
    }
    
    // Call gameplan/active
    console.log('\nStep 2: Calling gameplan/active...')
    const activeResponse = await request.get('http://localhost:3000/api/gameplan/active', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    })
    
    const activeData = await activeResponse.json()
    console.log('Plan ID:', activeData.plan?.id)
    console.log('Plan Title:', activeData.plan?.title)
    console.log('Plan Source:', activeData.plan?.source)
    console.log('Nodes count:', Object.keys(activeData.plan?.nodes || {}).length)
    console.log('Error:', activeData.error)
    
    if (activeData.plan?.nodes) {
      console.log('\nNodes in plan:')
      Object.entries(activeData.plan.nodes).forEach(([id, node]: [string, any]) => {
        console.log(`  ${id}: ${node.title} (progress: ${node.progressCompletedRules}/${node.progressTotalRules})`)
      })
    }
    
    // Check if Standing exists
    const standingNode = Object.values(activeData.plan?.nodes || {}).find((node: any) => 
      node.title?.toLowerCase().includes('standing')
    ) as any
    
    if (standingNode) {
      console.log('\n✅ Standing node found!')
      console.log('  Progress:', standingNode.progressCompletedRules, '/', standingNode.progressTotalRules)
      expect(standingNode.progressTotalRules).toBe(29)
    } else {
      console.log('\n❌ Standing node NOT found in API response!')
    }
    
    expect(activeData.plan).toBeDefined()
  })
})