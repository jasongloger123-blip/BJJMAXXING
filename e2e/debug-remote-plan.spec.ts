import { test, expect } from '@playwright/test'

/**
 * DEBUG: Check if remotePlan is being set
 */

test.describe('Debug Remote Plan Loading', () => {
  test('check if remotePlan is loaded', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('DEBUG: Check Remote Plan Loading')
    console.log('========================================\n')
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(3000)
    
    // Navigate to gameplan and track API calls
    const apiResponses: any[] = []
    
    await page.route('**/api/gameplan/**', async (route, request) => {
      const response = await route.fetch()
      const body = await response.json()
      apiResponses.push({
        url: request.url(),
        status: response.status(),
        body
      })
      console.log(`API Call: ${request.url()}`)
      console.log(`  Status: ${response.status()}`)
      if (body.plan) {
        console.log(`  Plan ID: ${body.plan.id}`)
        console.log(`  Plan Source: ${body.plan.source}`)
        const standing = Object.values(body.plan.nodes || {}).find((n: any) => 
          n.title?.toLowerCase().includes('standing')
        ) as any
        if (standing) {
          console.log(`  Standing Progress: ${standing.progressCompletedRules}/${standing.progressTotalRules}`)
        }
      }
      if (body.plans) {
        console.log(`  Plans count: ${body.plans.length}`)
      }
      await route.fulfill({ response })
    })
    
    await page.goto('http://localhost:3000/gameplan')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(8000)
    
    console.log('\n\nAll API Responses:', JSON.stringify(apiResponses.map(r => ({ 
      url: r.url, 
      status: r.status,
      planId: r.body.plan?.id || r.body.plans?.[0]?.id,
      planSource: r.body.plan?.source,
      standingProgress: r.body.plan?.nodes ? 
        Object.values(r.body.plan.nodes).find((n: any) => n.title?.toLowerCase().includes('standing')) : null
    })), null, 2))
    
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
