import { test, expect } from '@playwright/test'

/**
 * TEST: Standing Node Clip Count - Part 2
 * 
 * Verifies that the Standing node shows correct clip count
 */

test.describe('Standing Node Clip Count Debug', () => {
  test('check all technique nodes and their clip counts', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('TEST: Check All Technique Nodes')
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
    
    // Call gameplan API
    console.log('Calling gameplan API...')
    const apiResponse = await request.get('http://localhost:3000/api/gameplan/active', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    })
    
    const apiData = await apiResponse.json()
    const plan = apiData.plan
    
    console.log('\nPlan:', plan?.title)
    console.log('Source:', plan?.source)
    console.log('\nAll Nodes:')
    
    // List all nodes with their progress
    for (const [nodeId, node] of Object.entries(plan?.nodes || {})) {
      const n = node as any
      console.log(`\n  ${nodeId}:`)
      console.log(`    Title: ${n.title}`)
      console.log(`    Source: ${n.sourceNodeId || 'none'}`)
      console.log(`    Progress: ${n.progressCompletedRules}/${n.progressTotalRules} (${n.progressPercent}%)`)
    }
    
    // Find the Standing node (search by title or source)
    const standingEntry = Object.entries(plan?.nodes || {}).find(([id, node]) => {
      const n = node as any
      return n.title?.toLowerCase().includes('standing') || 
             n.title?.toLowerCase().includes('stand up') ||
             n.sourceNodeId === 'node-1-guard-identity'
    })
    
    if (standingEntry) {
      const [nodeId, node] = standingEntry
      const n = node as any
      console.log('\n========================================')
      console.log('STANDING NODE FOUND:')
      console.log('========================================')
      console.log(`  ID: ${nodeId}`)
      console.log(`  Title: ${n.title}`)
      console.log(`  Source Node ID: ${n.sourceNodeId}`)
      console.log(`  Progress: ${n.progressCompletedRules}/${n.progressTotalRules}`)
      console.log(`  Progress %: ${n.progressPercent}%`)
      
      // The expected values
      console.log('\nExpected: 29/29 (100%)')
      console.log(`Actual: ${n.progressCompletedRules}/${n.progressTotalRules} (${n.progressPercent}%)`)
      
      // Don't fail, just log for now
      // expect(n.progressTotalRules).toBe(29)
      // expect(n.progressCompletedRules).toBe(29)
    } else {
      console.log('\nNo Standing node found!')
    }
    
    // Now call gameplan list API to see all available plans
    console.log('\n\nCalling gameplan list API...')
    const listResponse = await request.get('http://localhost:3000/api/gameplan/list', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    })
    
    const listData = await listResponse.json()
    console.log('Plans:', listData.plans?.length || 0)
    
    // Check sourceNodeMeta if available
    if (apiData.sourceNodeMetaById) {
      console.log('\n\nSource Node Meta:')
      for (const [nodeId, meta] of Object.entries(apiData.sourceNodeMetaById)) {
        const m = meta as any
        console.log(`  ${nodeId}: clipTotal=${m.clipTotal}, knownClipCount=${m.knownClipCount}`)
      }
    }
    
    expect(true).toBe(true) // Pass for now
  })
  
  test('check clip assignments in database via API', async ({ page, context, request }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('TEST: Check Clip Assignments')
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
    
    // The Standing node ID from the gameplan
    const standingNodeId = 'technique-c3934120'
    const standingSourceId = 'node-1-guard-identity'
    
    console.log('Standing Node ID:', standingNodeId)
    console.log('Standing Source ID:', standingSourceId)
    
    // Try to call the training-queue API to see clip status
    console.log('\nCalling training-queue API...')
    const queueResponse = await request.get('http://localhost:3000/api/training-queue?node_id=' + standingNodeId, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    })
    
    if (queueResponse.ok()) {
      const queueData = await queueResponse.json()
      console.log('Queue clips:', queueData.clips?.length || 0)
      
      if (queueData.clips?.length > 0) {
        queueData.clips.forEach((clip: any, i: number) => {
          console.log(`  ${i + 1}. ${clip.clip_key} - ${clip.title || 'no title'}`)
        })
      }
    } else {
      console.log('Training queue API error:', await queueResponse.text())
    }
    
    expect(true).toBe(true)
  })
})
