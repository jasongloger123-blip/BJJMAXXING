import { test, expect } from '@playwright/test'

/**
 * TEST: Standing Node Clip Count
 * 
 * Verifies that the Standing node shows 29/29 clips (not 28/29)
 */

test.describe('Standing Node Clip Count', () => {
  test('should show 29/29 clips for Standing node', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('TEST: Standing Node Should Have 29 Clips')
    console.log('========================================\n')
    
    // Capture console logs
    const consoleLogs: string[] = []
    page.on('console', msg => {
      const text = msg.text()
      consoleLogs.push(text)
      if (text.includes('[DEBUG]') || text.includes('clip') || text.includes('Standing')) {
        console.log('[BROWSER]', text.substring(0, 200))
      }
    })
    
    // Step 1: Login
    console.log('Step 1: Logging in...')
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    
    // Wait for redirect to home
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(3000)
    
    // Step 2: Get auth token for API call
    const cookies = await context.cookies()
    const authCookie = cookies.find(c => c.name.includes('auth-token'))
    let token = ''
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value)
        token = parsed.access_token || ''
      } catch {}
    }
    
    // Step 3: Call gameplan API directly to check clip counts
    console.log('\nStep 2: Calling gameplan API...')
    const apiResponse = await request.get('http://localhost:3000/api/gameplan/active', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    })
    
    const apiData = await apiResponse.json()
    const plan = apiData.plan
    
    console.log('Plan title:', plan?.title)
    console.log('Plan source:', plan?.source)
    
    // Find Standing node
    const standingNode = plan?.nodes?.['stand-up']
    if (!standingNode) {
      console.log('ERROR: Standing node not found in plan!')
      console.log('Available nodes:', Object.keys(plan?.nodes || {}))
    }
    
    console.log('\nStanding Node:')
    console.log('  Title:', standingNode?.title)
    console.log('  Source Node ID:', standingNode?.sourceNodeId)
    console.log('  Progress:', standingNode?.progressCompletedRules, '/', standingNode?.progressTotalRules)
    console.log('  Progress %:', standingNode?.progressPercent)
    
    // Step 4: Navigate to gameplan page and check UI
    console.log('\nStep 3: Navigating to gameplan...')
    await page.goto('http://localhost:3000/gameplan')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/standing-clip-count.png', fullPage: true })
    
    // Check for Standing node in UI
    const standingVisible = await page.locator('text=Standing').first().isVisible().catch(() => false)
    console.log('Standing visible in UI:', standingVisible)
    
    // Get the full page content
    const html = await page.content()
    
    // Look for the progress indicator near Standing
    // Pattern like "28/29" or "29/29"
    const progressMatch = html.match(/Standing[\s\S]{0,500}(\d+)\/(\d+)/i)
    if (progressMatch) {
      const completed = parseInt(progressMatch[1])
      const total = parseInt(progressMatch[2])
      console.log('\nProgress found in HTML:', completed, '/', total)
      
      console.log('\n========================================')
      console.log('TEST RESULTS')
      console.log('========================================')
      console.log(`Current: ${completed}/${total}`)
      console.log(`Expected: 29/29`)
      console.log(`Status: ${total === 29 && completed === 29 ? '✅ PASS' : '❌ FAIL'}`)
      
      // Assertions
      expect(total).toBe(29)
      expect(completed).toBe(29)
    } else {
      console.log('No progress indicator found near Standing in HTML')
      
      // Try to find any progress pattern
      const anyProgress = html.match(/(\d+)\/(\d+)/g)
      console.log('All progress patterns found:', anyProgress)
      
      // Fail the test if we can't find the progress
      expect(progressMatch).not.toBeNull()
    }
  })
  
  test('debug clip loading for Standing', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('DEBUG: Clip Loading for Standing')
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
    
    // Call start-queue API directly
    console.log('Calling start-queue API...')
    const queueResponse = await request.get('http://localhost:3000/api/start-queue', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    })
    
    const queueData = await queueResponse.json()
    console.log('Queue length:', queueData.queue?.length || 0)
    
    // Filter for Standing node clips
    const standingClips = queueData.queue?.filter((card: any) => 
      card.nodeId?.includes('guard-identity') || 
      card.nodeId?.includes('stand') ||
      card.title?.toLowerCase().includes('standing') ||
      card.title?.toLowerCase().includes('stand up')
    ) || []
    
    console.log('\nStanding-related clips in queue:', standingClips.length)
    standingClips.forEach((clip: any, i: number) => {
      console.log(`  ${i + 1}. ${clip.title} (${clip.nodeId})`)
    })
    
    // Save debug info
    const debugInfo = {
      queueLength: queueData.queue?.length || 0,
      standingClipsCount: standingClips.length,
      standingClips: standingClips.map((c: any) => ({ title: c.title, nodeId: c.nodeId })),
      allNodeIds: [...new Set(queueData.queue?.map((c: any) => c.nodeId) || [])]
    }
    
    const fs = require('fs')
    fs.writeFileSync('test-results/standing-debug.json', JSON.stringify(debugInfo, null, 2))
    console.log('\nDebug info saved to test-results/standing-debug.json')
  })
})
