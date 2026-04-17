import { test, expect } from '@playwright/test'

test.describe('Debug Clip Loading', () => {
  test('capture full page state', async ({ page }) => {
    test.setTimeout(60000);
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(2000)
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(10000)
    
    // Get full HTML
    const html = await page.content()
    
    // Check for key elements
    const hasQueue = html.includes('Queue')
    const hasClips = html.includes('clip') || html.includes('video') || html.includes('youtube')
    const hasDebug = html.includes('Debug Queue')
    
    console.log('\n========================================')
    console.log('PAGE ANALYSIS')
    console.log('========================================')
    console.log('Has Queue text:', hasQueue)
    console.log('Has Clips:', hasClips)
    console.log('Has Debug Queue:', hasDebug)
    
    // Look for specific text
    const queueMatch = html.match(/Top \d+ aus der Start-Queue/)
    const clipMatch = html.match(/\d+ Clips/)
    
    console.log('Queue indicator:', queueMatch?.[0] || 'Not found')
    console.log('Clip count:', clipMatch?.[0] || 'Not found')
    
    // Screenshot
    await page.screenshot({ path: 'test-results/debug-full-page.png', fullPage: true })
    
    // Save HTML for analysis
    const fs = require('fs')
    fs.writeFileSync('test-results/debug-page.html', html)
    
    console.log('Full page HTML saved to test-results/debug-page.html')
    console.log('Screenshot saved to test-results/debug-full-page.png')
    
    expect(true).toBeTruthy()
  })
})