import { test, expect } from '@playwright/test'

/**
 * DEBUG TEST: Analysiert, warum die App nicht lädt
 * 
 * Verwendet Admin-Credentials aus .env (nur zum Testen, keine Daten werden gespeichert):
 * - Admin Email: jasongloger@googlemail.com
 * - Admin Password: QwErTer312
 */

test.describe('DEBUG: App Loading Issues', () => {
  
  test('1. Check if Next.js dev server is running', async ({ page }) => {
    console.log('=== TEST 1: Checking Next.js dev server ===')
    
    try {
      const response = await page.goto('http://localhost:3000/', { 
        timeout: 30000,
        waitUntil: 'domcontentloaded'
      })
      
      console.log('Response status:', response?.status())
      console.log('Response URL:', page.url())
      
      // Take screenshot of initial load
      await page.screenshot({ path: 'test-results/01-initial-load.png', fullPage: true })
      
      // Check if we got a 404 (server not running)
      if (response?.status() === 404) {
        console.log('❌ ERROR: Got 404 - Next.js server might not be running')
        return
      }
      
      // Check console for JavaScript errors
      const consoleMessages: string[] = []
      page.on('console', msg => {
        const text = `[${msg.type()}] ${msg.text()}`
        consoleMessages.push(text)
        console.log('Console:', text)
      })
      
      // Check for page errors
      const pageErrors: string[] = []
      page.on('pageerror', error => {
        pageErrors.push(error.message)
        console.log('Page Error:', error.message)
      })
      
      // Wait a bit to capture console messages
      await page.waitForTimeout(3000)
      
      // Save console logs
      if (consoleMessages.length > 0) {
        console.log('\n=== Console Messages ===')
        consoleMessages.forEach(msg => console.log(msg))
      }
      
      if (pageErrors.length > 0) {
        console.log('\n=== Page Errors ===')
        pageErrors.forEach(err => console.log(err))
      }
      
      // Check what's on the page
      const bodyContent = await page.locator('body').innerHTML({ timeout: 5000 }).catch(() => 'BODY NOT FOUND')
      console.log('\n=== Body Content (first 1000 chars) ===')
      console.log(bodyContent?.substring(0, 1000))
      
    } catch (error) {
      console.log('❌ ERROR: Failed to load page:', error)
      throw error
    }
  })

  test('2. Test login page accessibility', async ({ page }) => {
    console.log('\n=== TEST 2: Testing login page ===')
    
    try {
      const response = await page.goto('http://localhost:3000/login', { 
        timeout: 30000,
        waitUntil: 'networkidle'
      })
      
      console.log('Login page status:', response?.status())
      console.log('Current URL:', page.url())
      
      await page.screenshot({ path: 'test-results/02-login-page.png', fullPage: true })
      
      // Check for form elements
      const emailInput = page.locator('input[type="email"]')
      const passwordInput = page.locator('input[type="password"]')
      const submitButton = page.locator('button[type="submit"]')
      
      const emailVisible = await emailInput.isVisible().catch(() => false)
      const passwordVisible = await passwordInput.isVisible().catch(() => false)
      const buttonVisible = await submitButton.isVisible().catch(() => false)
      
      console.log('Email input visible:', emailVisible)
      console.log('Password input visible:', passwordVisible)
      console.log('Submit button visible:', buttonVisible)
      
      expect(emailVisible || passwordVisible || buttonVisible).toBeTruthy()
      
    } catch (error) {
      console.log('❌ ERROR:', error)
      throw error
    }
  })

  test('3. Login with admin credentials and check app flow', async ({ page }) => {
    console.log('\n=== TEST 3: Testing login flow ===')
    
    const adminEmail = 'jasongloger@googlemail.com'
    const adminPassword = 'QwErTer312'
    
    try {
      // Go to login
      await page.goto('http://localhost:3000/login', { timeout: 30000 })
      await page.waitForTimeout(2000)
      
      // Fill credentials
      console.log('Filling in admin credentials...')
      await page.fill('input[type="email"]', adminEmail)
      await page.fill('input[type="password"]', adminPassword)
      
      await page.screenshot({ path: 'test-results/03-login-filled.png' })
      
      // Click submit
      console.log('Clicking submit...')
      await page.click('button[type="submit"]')
      
      // Wait for navigation
      console.log('Waiting for navigation...')
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
        console.log('Network idle timeout - checking current state...')
      })
      
      await page.waitForTimeout(3000)
      
      console.log('Current URL after login:', page.url())
      await page.screenshot({ path: 'test-results/04-after-login.png', fullPage: true })
      
      // Check for error messages
      const errorMessage = await page.locator('.text-red-300, .text-red-500, [class*="error"]').first().textContent().catch(() => null)
      if (errorMessage) {
        console.log('❌ Error message found:', errorMessage)
      }
      
      // Check what page we're on
      const headings = await page.locator('h1, h2, h3').allTextContents()
      console.log('Headings on page:', headings.slice(0, 5))
      
    } catch (error) {
      console.log('❌ ERROR during login:', error)
      await page.screenshot({ path: 'test-results/04-login-error.png', fullPage: true })
      throw error
    }
  })

  test('4. Check protected routes and redirects', async ({ page }) => {
    console.log('\n=== TEST 4: Checking protected routes ===')
    
    const protectedRoutes = [
      '/skill-tree',
      '/profile',
      '/gameplan',
      '/notifications',
      '/onboarding'
    ]
    
    // First try without being logged in
    for (const route of protectedRoutes.slice(0, 2)) {
      console.log(`Testing route: ${route}`)
      
      // Clear any auth state
      await page.context().clearCookies()
      
      try {
        const response = await page.goto(`http://localhost:3000${route}`, { 
          timeout: 10000,
          waitUntil: 'domcontentloaded'
        })
        
        await page.waitForTimeout(2000)
        
        console.log(`  - Status: ${response?.status()}`)
        console.log(`  - Final URL: ${page.url()}`)
        
        // Should redirect to login
        if (page.url().includes('/login')) {
          console.log('  ✓ Correctly redirected to login')
        } else if (page.url().includes(route)) {
          console.log('  ⚠️ Still on protected route (might be cached session)')
        }
        
      } catch (error) {
        console.log(`  ❌ Error loading ${route}:`, error)
      }
    }
  })

  test('5. Check console errors and network requests', async ({ page }) => {
    console.log('\n=== TEST 5: Analyzing console and network ===')
    
    const errors: string[] = []
    const failedRequests: string[] = []
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
        console.log('Console Error:', msg.text())
      }
    })
    
    page.on('requestfailed', request => {
      failedRequests.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`)
      console.log('Failed Request:', request.method(), request.url(), request.failure()?.errorText)
    })
    
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`HTTP ${response.status()}: ${response.url()}`)
      }
    })
    
    await page.goto('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(5000)
    
    await page.screenshot({ path: 'test-results/05-network-check.png', fullPage: true })
    
    console.log('\n=== Summary ===')
    console.log(`Console errors: ${errors.length}`)
    console.log(`Failed requests: ${failedRequests.length}`)
    
    if (errors.length > 0) {
      console.log('\nErrors found:')
      errors.forEach((err, i) => console.log(`  ${i + 1}. ${err.substring(0, 200)}`))
    }
    
    if (failedRequests.length > 0) {
      console.log('\nFailed requests:')
      failedRequests.forEach((req, i) => console.log(`  ${i + 1}. ${req}`))
    }
  })

})