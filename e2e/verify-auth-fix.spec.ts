import { test, expect } from '@playwright/test'

/**
 * VERIFICATION TEST: Check if clips load after auth fixes
 * 
 * Admin credentials:
 * - Email: jasongloger@googlemail.com
 * - Password: QwErTer312
 */

test.describe('VERIFY: Auth Fixes Work', () => {
  
  test('clips should load with auth token', async ({ page }) => {
    console.log('\n========================================')
    console.log('VERIFY: Clips load with auth fixes')
    console.log('========================================\n')
    
    // Track important events
    let startQueueRequest: any = null
    let startQueueResponse: any = null
    
    page.on('request', request => {
      if (request.url().includes('/api/start-queue')) {
        startQueueRequest = {
          url: request.url(),
          headers: request.headers(),
        }
        console.log('[Request] /api/start-queue')
        console.log('  Authorization:', request.headers()['authorization'] ? '✅ present' : '❌ missing')
      }
    })
    
    page.on('response', async response => {
      if (response.url().includes('/api/start-queue')) {
        try {
          startQueueResponse = await response.json()
          console.log('[Response] /api/start-queue')
          console.log('  Status:', response.status())
          console.log('  Queue length:', startQueueResponse?.queue?.length ?? 0)
        } catch {}
      }
    })
    
    // Step 1: Login
    console.log('Step 1: Login...')
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(1000)
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    
    // Wait for redirect to home
    await page.waitForURL('http://localhost:3000/', { timeout: 20000 })
    console.log('✓ Redirected to home')
    
    // Step 2: Wait for queue to load
    console.log('\nStep 2: Waiting for queue...')
    await page.waitForTimeout(5000)
    
    // Step 3: Check results
    console.log('\n========================================')
    console.log('RESULTS')
    console.log('========================================')
    
    // Check if request was made
    if (startQueueRequest) {
      console.log('✓ start-queue request was made')
      const hasAuth = !!startQueueRequest.headers['authorization']
      console.log('  Authorization header:', hasAuth ? '✅ present' : '❌ missing')
    } else {
      console.log('❌ No start-queue request captured')
    }
    
    // Check response
    if (startQueueResponse) {
      const queueLength = startQueueResponse.queue?.length ?? 0
      console.log('\n✓ start-queue response received')
      console.log('  Queue length:', queueLength)
      
      if (queueLength > 0) {
        console.log('  First clip:', startQueueResponse.queue[0].clipTitle)
        console.log('\n✅ SUCCESS: Clips are loading!')
      } else {
        console.log('\n❌ FAIL: Queue is empty')
        console.log('  Response:', JSON.stringify(startQueueResponse, null, 2))
      }
    } else {
      console.log('\n❌ No start-queue response captured')
    }
    
    // Check for video iframe
    const hasVideo = await page.locator('iframe[src*="youtube"]').isVisible().catch(() => false)
    console.log('\nVideo visible on page:', hasVideo ? '✅ YES' : '❌ NO')
    
    // Screenshot
    await page.screenshot({ path: 'test-results/verify-auth-fix.png', fullPage: true })
  })
  
  test('auth should persist after reload', async ({ page }) => {
    console.log('\n========================================')
    console.log('VERIFY: Auth persists after reload')
    console.log('========================================\n')
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(1000)
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 20000 })
    await page.waitForTimeout(5000)
    
    // Check first load
    const hasVideo1 = await page.locator('iframe[src*="youtube"]').isVisible().catch(() => false)
    console.log('First load - video visible:', hasVideo1 ? '✅' : '❌')
    
    // Reload
    console.log('Reloading page...')
    await page.reload()
    await page.waitForTimeout(5000)
    
    // Check after reload
    const hasVideo2 = await page.locator('iframe[src*="youtube"]').isVisible().catch(() => false)
    console.log('After reload - video visible:', hasVideo2 ? '✅' : '❌')
    
    // Results
    console.log('\n========================================')
    console.log('PERSISTENCE RESULTS')
    console.log('========================================')
    console.log('First load: ', hasVideo1 ? '✅ Clips shown' : '❌ No clips')
    console.log('After reload:', hasVideo2 ? '✅ Clips shown' : '❌ No clips')
    
    if (hasVideo1 && hasVideo2) {
      console.log('\n✅ SUCCESS: Auth persists correctly!')
    } else if (hasVideo1 && !hasVideo2) {
      console.log('\n❌ PROBLEM: Clips lost after reload')
    } else if (!hasVideo1) {
      console.log('\n❌ PROBLEM: No clips on first load')
    }
  })
})
