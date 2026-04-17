import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/**
 * TEST 3: Session Persistence Test
 * 
 * Tests if sessions persist across browser restarts and contexts.
 * This helps identify if the issue is related to session storage/cookies.
 */

const STORAGE_STATE_PATH = path.join(__dirname, '..', 'test-results', 'auth-state.json')

test.describe('TEST 3: Session Persistence', () => {
  
  test('save auth state and restore in new context', async ({ browser }) => {
    console.log('\n========================================')
    console.log('TEST 3A: Save and Restore Auth State')
    console.log('========================================\n')
    
    // Step 1: Create context and login
    console.log('--- Step 1: Login in first context ---')
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()
    
    // Track console logs
    const logs1: string[] = []
    page1.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`
      logs1.push(text)
      console.log(text)
    })
    
    await page1.goto('http://localhost:3000/login')
    await page1.waitForTimeout(1000)
    await page1.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page1.fill('input[type="password"]', 'QwErTer312')
    await page1.click('button[type="submit"]')
    await page1.waitForURL('http://localhost:3000/', { timeout: 15000 })
    await page1.waitForTimeout(3000)
    
    // Check if logged in
    const cookies1 = await context1.cookies()
    const authCookie1 = cookies1.find(c => c.name.includes('auth-token'))
    console.log('\nAfter login in context 1:')
    console.log('  Auth cookie exists:', !!authCookie1)
    console.log('  Total cookies:', cookies1.length)
    
    if (!authCookie1) {
      console.log('❌ No auth cookie after login!')
      await context1.close()
      return
    }
    
    // Check if clips are visible
    const hasVideo1 = await page1.locator('iframe[src*="youtube"]').isVisible().catch(() => false)
    console.log('  Video visible:', hasVideo1)
    
    // Save storage state
    await context1.storageState({ path: STORAGE_STATE_PATH })
    console.log('\n✓ Storage state saved to:', STORAGE_STATE_PATH)
    
    // Read and log the saved state
    const savedState = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, 'utf8'))
    console.log('\nSaved storage state:')
    console.log('  Cookies:', savedState.cookies?.length || 0)
    console.log('  Origins:', savedState.origins?.length || 0)
    
    // Check for auth cookie in saved state
    const savedAuthCookie = savedState.cookies?.find((c: any) => c.name.includes('auth-token'))
    if (savedAuthCookie) {
      console.log('  ✓ Auth cookie saved:')
      console.log('    Name:', savedAuthCookie.name)
      console.log('    Domain:', savedAuthCookie.domain)
      console.log('    Path:', savedAuthCookie.path)
      console.log('    HttpOnly:', savedAuthCookie.httpOnly)
      console.log('    Secure:', savedAuthCookie.secure)
      console.log('    SameSite:', savedAuthCookie.sameSite)
    } else {
      console.log('  ❌ Auth cookie NOT in saved state!')
    }
    
    await context1.close()
    
    // Step 2: Create new context with saved state
    console.log('\n--- Step 2: Create new context with saved state ---')
    const context2 = await browser.newContext({ storageState: STORAGE_STATE_PATH })
    const page2 = await context2.newPage()
    
    // Track console logs
    const logs2: string[] = []
    page2.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`
      logs2.push(text)
      console.log(text)
    })
    
    // Intercept start-queue to see auth
    let startQueueAuth: { hasAuth: boolean; hasCookie: boolean } | null = null
    page2.on('request', request => {
      if (request.url().includes('/api/start-queue')) {
        const headers = request.headers()
        startQueueAuth = {
          hasAuth: !!headers['authorization'],
          hasCookie: !!headers['cookie'],
        }
        console.log('\n[start-queue request in context 2]')
        console.log('  Authorization header:', startQueueAuth.hasAuth)
        console.log('  Cookie header:', startQueueAuth.hasCookie)
      }
    })
    
    // Navigate to home
    await page2.goto('http://localhost:3000/')
    await page2.waitForTimeout(5000)
    
    // Check auth status
    const cookies2 = await context2.cookies()
    const authCookie2 = cookies2.find(c => c.name.includes('auth-token'))
    console.log('\nIn context 2 (after restoring state):')
    console.log('  Auth cookie exists:', !!authCookie2)
    console.log('  Total cookies:', cookies2.length)
    
    // Check if still logged in
    const isLoggedIn = await page2.evaluate(() => {
      // Check for logged-in indicators
      const hasProfileLink = document.querySelector('a[href="/profile"]') !== null
      const hasLogoutButton = document.body.innerHTML.includes('Abmelden') || document.body.innerHTML.includes('Logout')
      return { hasProfileLink, hasLogoutButton }
    })
    console.log('  Profile link visible:', isLoggedIn.hasProfileLink)
    console.log('  Logout button visible:', isLoggedIn.hasLogoutButton)
    
    // Check if clips are visible
    const hasVideo2 = await page2.locator('iframe[src*="youtube"]').isVisible().catch(() => false)
    console.log('  Video visible:', hasVideo2)
    
    // Take screenshots
    await page1.screenshot({ path: 'test-results/test3-context1.png', fullPage: true })
    await page2.screenshot({ path: 'test-results/test3-context2.png', fullPage: true })
    
    await context2.close()
    
    // Summary
    console.log('\n========================================')
    console.log('SESSION PERSISTENCE SUMMARY')
    console.log('========================================')
    console.log('Context 1 (original login):')
    console.log('  Auth cookie:', authCookie1 ? '✅ YES' : '❌ NO')
    console.log('  Video visible:', hasVideo1 ? '✅ YES' : '❌ NO')
    console.log('')
    console.log('Context 2 (restored state):')
    console.log('  Auth cookie:', authCookie2 ? '✅ YES' : '❌ NO')
    console.log('  Video visible:', hasVideo2 ? '✅ YES' : '❌ NO')
    console.log('  start-queue had auth:', startQueueAuth?.hasAuth || startQueueAuth?.hasCookie ? '✅ YES' : '❌ NO')
    
    if (!authCookie2) {
      console.log('\n❌ PROBLEM: Auth cookie not restored in new context!')
      console.log('This could mean:')
      console.log('  1. Cookie was not saved properly')
      console.log('  2. Cookie domain/path mismatch')
      console.log('  3. Cookie expired between contexts')
    }
    
    if (authCookie2 && !hasVideo2) {
      console.log('\n⚠️ PROBLEM: Auth cookie exists but clips not showing!')
      console.log('This suggests:')
      console.log('  1. Server not recognizing the cookie')
      console.log('  2. Cookie value is invalid/expired')
      console.log('  3. Different issue with clip loading')
    }
  })
  
  test('compare cookie properties across contexts', async ({ browser }) => {
    console.log('\n========================================')
    console.log('TEST 3B: Cookie Properties Comparison')
    console.log('========================================\n')
    
    // Context 1: Login
    const context1 = await browser.newContext()
    const page1 = await context1.newPage()
    
    await page1.goto('http://localhost:3000/login')
    await page1.waitForTimeout(1000)
    await page1.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page1.fill('input[type="password"]', 'QwErTer312')
    await page1.click('button[type="submit"]')
    await page1.waitForURL('http://localhost:3000/', { timeout: 15000 })
    await page1.waitForTimeout(3000)
    
    const cookies1 = await context1.cookies()
    const authCookie1 = cookies1.find(c => c.name.includes('auth-token'))
    
    console.log('Context 1 auth cookie:')
    if (authCookie1) {
      console.log('  Name:', authCookie1.name)
      console.log('  Value length:', authCookie1.value.length)
      console.log('  Domain:', authCookie1.domain)
      console.log('  Path:', authCookie1.path)
      console.log('  Secure:', authCookie1.secure)
      console.log('  HttpOnly:', authCookie1.httpOnly)
      console.log('  SameSite:', authCookie1.sameSite)
      console.log('  Expires:', authCookie1.expires ? new Date(authCookie1.expires * 1000).toISOString() : 'Session')
    } else {
      console.log('  ❌ Not found')
    }
    
    await context1.close()
    
    // Context 2: Fresh browser
    const context2 = await browser.newContext()
    const page2 = await context2.newPage()
    
    // Manually set the cookie
    if (authCookie1) {
      await context2.addCookies([{
        name: authCookie1.name,
        value: authCookie1.value,
        domain: authCookie1.domain,
        path: authCookie1.path,
        secure: authCookie1.secure,
        httpOnly: authCookie1.httpOnly,
        sameSite: authCookie1.sameSite as 'Lax' | 'Strict' | 'None',
      }])
      console.log('\n✓ Manually added cookie to context 2')
    }
    
    // Check cookies in context 2
    const cookies2 = await context2.cookies()
    const authCookie2 = cookies2.find(c => c.name.includes('auth-token'))
    
    console.log('\nContext 2 auth cookie (manually added):')
    if (authCookie2) {
      console.log('  Name:', authCookie2.name)
      console.log('  Value length:', authCookie2.value.length)
      console.log('  Domain:', authCookie2.domain)
      console.log('  Path:', authCookie2.path)
      console.log('  Secure:', authCookie2.secure)
      console.log('  HttpOnly:', authCookie2.httpOnly)
      console.log('  SameSite:', authCookie2.sameSite)
      
      // Compare values
      if (authCookie1 && authCookie1.value === authCookie2.value) {
        console.log('\n✅ Cookie values match!')
      } else {
        console.log('\n❌ Cookie values differ!')
        console.log('  Context 1 value preview:', authCookie1?.value.substring(0, 50))
        console.log('  Context 2 value preview:', authCookie2.value.substring(0, 50))
      }
    } else {
      console.log('  ❌ Not found')
    }
    
    // Navigate and check
    await page2.goto('http://localhost:3000/')
    await page2.waitForTimeout(5000)
    
    // Check if user is recognized
    const cookiesAfterNav = await context2.cookies()
    const authCookieAfterNav = cookiesAfterNav.find(c => c.name.includes('auth-token'))
    console.log('\nAfter navigation:')
    console.log('  Auth cookie still exists:', !!authCookieAfterNav)
    
    // Check video
    const hasVideo = await page2.locator('iframe[src*="youtube"]').isVisible().catch(() => false)
    console.log('  Video visible:', hasVideo)
    
    await context2.close()
    
    console.log('\n========================================')
    console.log('COOKIE COMPARISON SUMMARY')
    console.log('========================================')
    console.log('Context 1 (after login):', authCookie1 ? '✅ Has cookie' : '❌ No cookie')
    console.log('Context 2 (manual add):', authCookie2 ? '✅ Has cookie' : '❌ No cookie')
    console.log('Video in context 2:', hasVideo ? '✅ Visible' : '❌ Not visible')
    
    if (authCookie1 && authCookie2 && !hasVideo) {
      console.log('\n❌ PROBLEM: Cookie exists but not recognized by server!')
      console.log('Cookie properties that might cause issues:')
      console.log('  - Secure:', authCookie2.secure, '(should be false for localhost)')
      console.log('  - SameSite:', authCookie2.sameSite, '(lax should work)')
      console.log('  - HttpOnly:', authCookie2.httpOnly, '(should not affect client)')
      console.log('  - Domain:', authCookie2.domain, '(should match request domain)')
    }
  })
})
