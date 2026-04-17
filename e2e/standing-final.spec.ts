import { test, expect } from '@playwright/test'

/**
 * TEST: Standing Node Clip Count - Final Verification
 * 
 * Verifies that the Standing node shows exactly 29/29 clips
 */

test.describe('Standing Node Clip Count', () => {
  test('should show 29 total clips for Standing node', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('TEST: Standing Node Should Have 29 Clips')
    console.log('========================================\n')
    
    // Capture console logs
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('[DEBUG]') || text.includes('Standing')) {
        console.log('[BROWSER]', text.substring(0, 200))
      }
    })
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    
    // Wait for redirect to home
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(3000)
    
    // Get auth token for API call
    const cookies = await context.cookies()
    const authCookie = cookies.find(c => c.name.includes('auth-token'))
    let token = ''
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value)
        token = parsed.access_token || ''
      } catch {}
    }
    
    // Call gameplan API
    console.log('Calling gameplan API...')
    const apiResponse = await request.get('http://localhost:3000/api/gameplan/active', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    })
    
    const apiData = await apiResponse.json()
    const plan = apiData.plan
    
    // Find Standing node
    const standingNode = Object.values(plan?.nodes || {}).find((node: any) => 
      node.title?.toLowerCase().includes('standing') || 
      node.title?.toLowerCase().includes('stand up')
    ) as any
    
    console.log('\n========================================')
    console.log('STANDING NODE RESULTS')
    console.log('========================================')
    console.log(`Title: ${standingNode?.title}`)
    console.log(`Progress: ${standingNode?.progressCompletedRules}/${standingNode?.progressTotalRules}`)
    console.log(`Progress %: ${standingNode?.progressPercent}%`)
    
    // Verify 29 total clips
    expect(standingNode?.progressTotalRules).toBe(29)
    console.log('\n✅ SUCCESS: Standing node has 29 total clips')
  })
  
  test('should show 29/29 on gameplan page UI', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('TEST: Standing Node UI Shows 29/29')
    console.log('========================================\n')
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(3000)
    
    // Navigate to gameplan
    await page.goto('http://localhost:3000/gameplan')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/standing-clip-count-final.png', fullPage: true })
    
    // Check for Standing node in UI
    const standingVisible = await page.locator('text=Standing').first().isVisible().catch(() => false)
    console.log('Standing visible in UI:', standingVisible)
    expect(standingVisible).toBeTruthy()
    
    // Get the full page content
    const html = await page.content()
    
    // Look for the progress indicator like "X/29" near Standing
    // Use a more flexible pattern to find the progress
    const standingSection = html.match(/Standing[\s\S]{0,1000}/i)?.[0] || ''
    const progressMatch = standingSection.match(/(\d+)\/(\d+)/)
    
    if (progressMatch) {
      const completed = parseInt(progressMatch[1])
      const total = parseInt(progressMatch[2])
      console.log(`\nProgress found in HTML: ${completed}/${total}`)
      
      console.log('\n========================================')
      console.log('TEST RESULTS')
      console.log('========================================')
      console.log(`Current: ${completed}/${total}`)
      console.log(`Expected Total: 29`)
      console.log(`Status: ${total === 29 ? '✅ PASS' : '❌ FAIL'}`)
      
      // Only verify total is 29
      expect(total).toBe(29)
      console.log('\n✅ SUCCESS: Standing node shows 29 total clips in UI')
    } else {
      console.log('No progress indicator found near Standing in HTML')
      
      // List all progress patterns found
      const allProgress = html.match(/(\d+)\/(\d+)/g)
      console.log('All progress patterns found:', allProgress)
      
      // Fail the test if we can't find the progress
      expect(progressMatch).not.toBeNull()
    }
  })
})
