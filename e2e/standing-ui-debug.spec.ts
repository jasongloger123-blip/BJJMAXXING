import { test, expect } from '@playwright/test'

/**
 * TEST: Debug Standing Node UI Progress
 */

test.describe('Standing Node UI Debug', () => {
  test('should show 29 in UI progress bar', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('TEST: Debug UI Progress for Standing')
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
    
    // First check API
    console.log('Step 1: Checking API...')
    const apiResponse = await request.get('http://localhost:3000/api/gameplan/active', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    })
    const apiData = await apiResponse.json()
    
    const standingNode = Object.values(apiData.plan?.nodes || {}).find((node: any) => 
      node.title?.toLowerCase().includes('standing')
    ) as any
    
    console.log('API - Standing progress:', standingNode?.progressCompletedRules, '/', standingNode?.progressTotalRules)
    
    // Now check UI
    console.log('\nStep 2: Checking UI...')
    await page.goto('http://localhost:3000/gameplan')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/standing-ui-debug.png', fullPage: true })
    
    // Get HTML content
    const html = await page.content()
    
    // Find Standing section
    const standingIndex = html.toLowerCase().indexOf('standing')
    if (standingIndex > -1) {
      // Extract surrounding HTML (500 chars before and after)
      const surroundingHtml = html.substring(Math.max(0, standingIndex - 500), Math.min(html.length, standingIndex + 500))
      console.log('\nHTML around Standing node:')
      console.log(surroundingHtml)
      
      // Look for progress patterns
      const progressMatches = surroundingHtml.match(/(\d+)\/(\d+)/g)
      console.log('\nProgress patterns found near Standing:', progressMatches)
    }
    
    // Check for the specific progress text
    const hasCorrectProgress = html.includes('0/29') || html.includes('/29')
    console.log('\nHas correct progress (0/29):', hasCorrectProgress)
    
    // Find all progress indicators in page
    const allProgress = html.match(/(\d+)\/(\d+)/g)
    console.log('\nAll progress indicators on page:', allProgress ? Array.from(new Set(allProgress)) : 'none')
    
    expect(hasCorrectProgress).toBeTruthy()
  })
})
