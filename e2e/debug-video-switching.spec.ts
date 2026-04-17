import { test, expect } from '@playwright/test'

/**
 * DEBUG TEST: Video Switching Performance
 * 
 * Verwendet Admin-Credentials aus .env:
 * - Admin Email: jasongloger@googlemail.com
 * - Admin Password: QwErTer312
 * 
 * Dieser Test untersucht:
 * 1. Warum das Video beim Klick auf "Kann ich" kurz weitergeht/repeats
 * 2. Warum es nach dem Wechsel kurz refresht/aktualisiert
 * 3. Wie man den Video-Switch schneller machen kann
 */

test.describe('DEBUG: Video Switching Issues', () => {
  
  test('1. Analyze video switching timing', async ({ page }) => {
    console.log('=== TEST 1: Analyzing video switching timing ===\n')
    
    // Track all console messages
    const consoleMessages: { type: string, text: string, time: number }[] = []
    const startTime = Date.now()
    
    page.on('console', msg => {
      const entry = {
        type: msg.type(),
        text: msg.text(),
        time: Date.now() - startTime
      }
      consoleMessages.push(entry)
      console.log(`[${entry.time}ms] [${entry.type}] ${entry.text.substring(0, 150)}`)
    })
    
    // Track network requests
    const networkRequests: { url: string, time: number }[] = []
    page.on('request', request => {
      const entry = { url: request.url(), time: Date.now() - startTime }
      networkRequests.push(entry)
      if (request.url().includes('youtube') || request.url().includes('api')) {
        console.log(`[${entry.time}ms] Request: ${request.url().substring(0, 100)}`)
      }
    })

    // Login
    console.log('Logging in...')
    await page.goto('http://localhost:3000/login', { timeout: 30000 })
    await page.waitForTimeout(2000)
    
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    
    await page.screenshot({ path: 'test-results/vs-01-login.png' })
    
    await page.click('button[type="submit"]')
    
    // Wait for redirect
    await page.waitForURL('http://localhost:3000/', { timeout: 20000 })
    console.log('Logged in, waiting for page to load...')
    
    // Wait for videos to load
    await page.waitForTimeout(5000)
    await page.screenshot({ path: 'test-results/vs-02-loaded.png', fullPage: true })
    
    // Find the video iframe
    const videoFrame = page.locator('iframe[src*="youtube"]').first()
    const hasVideo = await videoFrame.isVisible().catch(() => false)
    console.log('Video visible:', hasVideo)
    
    // Get current video info
    const videoTitle = await page.locator('h2').first().textContent().catch(() => 'No title')
    console.log('Current video title:', videoTitle)
    
    // Analyze video switching
    console.log('\n=== Clicking "Kann ich" button ===')
    const clickTime = Date.now()
    
    const kannIchButton = page.locator('button:has-text("Kann ich")').first()
    await expect(kannIchButton).toBeVisible({ timeout: 10000 })
    
    // Take screenshot before click
    await page.screenshot({ path: 'test-results/vs-03-before-click.png' })
    
    // Click and immediately start tracking
    await kannIchButton.click()
    console.log('Button clicked at', Date.now() - clickTime, 'ms')
    
    // Take screenshots at intervals to see the transition
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(100) // 100ms intervals
      const elapsed = Date.now() - clickTime
      
      // Check for visual changes
      const currentTitle = await page.locator('h2').first().textContent().catch(() => 'N/A')
      const hasSpinner = await page.locator('text=Lade Clip...').isVisible().catch(() => false)
      
      console.log(`[${elapsed}ms] Title: ${currentTitle?.substring(0, 30)}, Loading: ${hasSpinner}`)
      
      if (i % 3 === 0) { // Every 300ms
        await page.screenshot({ path: `test-results/vs-04-transition-${elapsed}ms.png` })
      }
    }
    
    // Final screenshot after transition
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/vs-05-after-transition.png', fullPage: true })
    
    // Analyze console messages for clues
    console.log('\n=== CONSOLE ANALYSIS ===')
    console.log(`Total console messages: ${consoleMessages.length}`)
    
    const videoRelated = consoleMessages.filter(m => 
      m.text.toLowerCase().includes('video') || 
      m.text.toLowerCase().includes('queue') ||
      m.text.toLowerCase().includes('clip') ||
      m.text.toLowerCase().includes('load')
    )
    
    console.log(`Video/Queue/Clip/Load related messages: ${videoRelated.length}`)
    videoRelated.forEach(m => {
      console.log(`[${m.time}ms] ${m.text}`)
    })
    
    // Check for duplicate video loads
    console.log('\n=== NETWORK REQUESTS ===')
    const youtubeRequests = networkRequests.filter(r => r.url.includes('youtube'))
    console.log(`YouTube requests: ${youtubeRequests.length}`)
    youtubeRequests.forEach(r => {
      console.log(`[${r.time}ms] ${r.url.substring(0, 80)}...`)
    })
  })

  test('2. Multiple rapid clicks', async ({ page }) => {
    console.log('\n=== TEST 2: Multiple rapid clicks ===\n')
    
    // Login
    await page.goto('http://localhost:3000/login', { timeout: 30000 })
    await page.waitForTimeout(2000)
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 20000 })
    await page.waitForTimeout(5000)
    
    // Click "Kann ich" multiple times rapidly
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now()
      
      const kannIchButton = page.locator('button:has-text("Kann ich")').first()
      await expect(kannIchButton).toBeVisible({ timeout: 10000 })
      
      // Get video title before
      const titleBefore = await page.locator('h2').first().textContent()
      
      await kannIchButton.click()
      console.log(`Click ${i + 1}: ${Date.now() - startTime}ms - Button clicked`)
      
      // Wait for transition
      await page.waitForTimeout(1500)
      
      // Get video title after
      const titleAfter = await page.locator('h2').first().textContent()
      const changed = titleBefore !== titleAfter
      
      console.log(`Click ${i + 1}: Title changed: ${changed} | Before: ${titleBefore?.substring(0, 30)} | After: ${titleAfter?.substring(0, 30)}`)
      
      await page.screenshot({ path: `test-results/vs-06-rapid-click-${i + 1}.png` })
    }
  })

  test('3. Check for video element reuse', async ({ page }) => {
    console.log('\n=== TEST 3: Checking video element behavior ===\n')
    
    // Login
    await page.goto('http://localhost:3000/login', { timeout: 30000 })
    await page.waitForTimeout(2000)
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 20000 })
    await page.waitForTimeout(5000)
    
    // Get initial iframe src
    const initialIframe = page.locator('iframe[src*="youtube"]').first()
    const initialSrc = await initialIframe.getAttribute('src')
    console.log('Initial iframe src:', initialSrc?.substring(0, 60))
    
    // Click Kann ich
    const kannIchButton = page.locator('button:has-text("Kann ich")').first()
    await kannIchButton.click()
    
    // Check iframe src during transition
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(50)
      const currentSrc = await page.locator('iframe[src*="youtube"]').first().getAttribute('src').catch(() => 'none')
      if (currentSrc !== initialSrc) {
        console.log(`Iframe src changed at ${i * 50}ms:`, currentSrc?.substring(0, 60))
        break
      }
    }
    
    await page.waitForTimeout(1500)
    
    // Get final iframe src
    const finalSrc = await page.locator('iframe[src*="youtube"]').first().getAttribute('src')
    console.log('Final iframe src:', finalSrc?.substring(0, 60))
    console.log('Src changed:', initialSrc !== finalSrc)
  })

})
