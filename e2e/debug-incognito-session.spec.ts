import { test, expect } from '@playwright/test'

/**
 * DEBUG TEST: Session and Queue Loading in Incognito Mode
 * 
 * Verwendet Admin-Credentials aus .env
 * - Admin Email: jasongloger@googlemail.com  
 * - Admin Password: QwErTer312
 * 
 * Dieser Test analysiert:
 * 1. Warum Session in externen Browsern nicht klappt
 * 2. Warum die Queue leer ist
 * 3. Netzwerk-Requests und Cookies
 */

test.describe('DEBUG: Incognito Session Issues', () => {
  
  test('1. Analyze session and queue loading', async ({ page, context }) => {
    console.log('=== TEST 1: Session and Queue Analysis ===\n')
    
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
      console.log(`[${entry.time}ms] [${entry.type}] ${entry.text}`)
    })
    
    // Track network requests
    const networkRequests: { url: string, method: string, status: number, time: number }[] = []
    
    page.on('response', async response => {
      const url = response.url()
      if (url.includes('/api/') || url.includes('supabase')) {
        const entry = { 
          url, 
          method: response.request().method(),
          status: response.status(), 
          time: Date.now() - startTime 
        }
        
        // Try to get response body for API calls
        if (url.includes('/api/start-queue')) {
          try {
            const body = await response.json()
            console.log(`\n[${entry.time}ms] API Response from ${url}:`)
            console.log('Status:', entry.status)
            console.log('Body:', JSON.stringify(body, null, 2))
          } catch (e) {
            console.log(`\n[${entry.time}ms] API Response from ${url}:`, entry.status)
          }
        }
        
        networkRequests.push(entry)
      }
    })

    // Check cookies before login
    const cookiesBefore = await context.cookies()
    console.log('\n=== COOKIES BEFORE LOGIN ===')
    console.log('Count:', cookiesBefore.length)
    cookiesBefore.forEach(c => console.log(`  ${c.name}: ${c.value.substring(0, 50)}...`))

    // Login
    console.log('\n=== LOGIN PROCESS ===')
    await page.goto('http://localhost:3000/login', { timeout: 30000 })
    await page.waitForTimeout(2000)
    
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    
    await page.screenshot({ path: 'test-results/debug-01-login-page.png' })
    
    // Click login and wait for navigation
    const loginResponsePromise = page.waitForResponse(resp => resp.url().includes('/api/auth/login'), { timeout: 15000 })
    await page.click('button[type="submit"]')
    const loginResponse = await loginResponsePromise
    
    console.log('Login API status:', loginResponse.status())
    try {
      const loginBody = await loginResponse.json()
      console.log('Login response:', JSON.stringify(loginBody, null, 2))
    } catch (e) {
      console.log('Could not parse login response')
    }
    
    // Wait for redirect
    await page.waitForURL('http://localhost:3000/', { timeout: 20000 })
    console.log('Redirected to home page')
    
    // Check cookies after login
    await page.waitForTimeout(3000)
    const cookiesAfter = await context.cookies()
    console.log('\n=== COOKIES AFTER LOGIN ===')
    console.log('Count:', cookiesAfter.length)
    cookiesAfter.forEach(c => {
      const isAuthCookie = c.name.includes('auth') || c.name.includes('supabase')
      console.log(`  ${c.name}${isAuthCookie ? ' [AUTH]' : ''}:`)
      console.log(`    Domain: ${c.domain}`)
      console.log(`    Path: ${c.path}`)
      console.log(`    Secure: ${c.secure}`)
      console.log(`    HttpOnly: ${c.httpOnly}`)
      console.log(`    SameSite: ${c.sameSite}`)
      console.log(`    Value length: ${c.value.length}`)
      try {
        const parsed = JSON.parse(c.value)
        if (parsed.access_token) {
          console.log(`    Has access_token: YES`)
          console.log(`    Token preview: ${parsed.access_token.substring(0, 30)}...`)
        }
      } catch (e) {
        // Not JSON
      }
    })
    
    await page.screenshot({ path: 'test-results/debug-02-home-loaded.png', fullPage: true })
    
    // Wait for queue to load
    await page.waitForTimeout(5000)
    
    // Check if video is visible
    const videoFrame = page.locator('iframe[src*="youtube"]').first()
    const hasVideo = await videoFrame.isVisible().catch(() => false)
    console.log('\n=== VIDEO STATUS ===')
    console.log('Video visible:', hasVideo)
    
    // Check queue status
    const queueTitle = await page.locator('text=Standing').first().isVisible().catch(() => false)
    console.log('Queue loaded (Standing text visible):', queueTitle)
    
    // Get visible text on page for debugging
    const pageContent = await page.content()
    const hasLadeClip = pageContent.includes('Lade Clip')
    const hasQueueEmpty = pageContent.includes('Queue ist leer') || pageContent.includes('keine Videos')
    console.log('Contains "Lade Clip":', hasLadeClip)
    console.log('Contains empty queue message:', hasQueueEmpty)
    
    // Analyze console messages
    console.log('\n=== CONSOLE ANALYSIS ===')
    const authMessages = consoleMessages.filter(m => 
      m.text.toLowerCase().includes('auth') || 
      m.text.toLowerCase().includes('session') ||
      m.text.toLowerCase().includes('cookie') ||
      m.text.toLowerCase().includes('start-queue')
    )
    
    console.log(`Auth/Session/Queue related messages: ${authMessages.length}`)
    authMessages.forEach(m => {
      console.log(`[${m.time}ms] ${m.text}`)
    })
    
    // Network summary
    console.log('\n=== NETWORK REQUESTS ===')
    networkRequests.forEach(r => {
      console.log(`[${r.time}ms] ${r.method} ${r.url.split('/').pop()} - ${r.status}`)
    })
    
    // Try to get Supabase session from page
    const sessionInfo = await page.evaluate(async () => {
      // Try to access any global supabase or session info
      const result = {
        localStorage: {} as Record<string, string>,
        sessionStorage: {} as Record<string, string>,
        cookies: document.cookie
      }
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          result.localStorage[key] = localStorage.getItem(key) || ''
        }
      }
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key) {
          result.sessionStorage[key] = sessionStorage.getItem(key) || ''
        }
      }
      
      return result
    })
    
    console.log('\n=== BROWSER STORAGE ===')
    console.log('Document cookies:', sessionInfo.cookies.substring(0, 200))
    console.log('LocalStorage keys:', Object.keys(sessionInfo.localStorage))
    console.log('SessionStorage keys:', Object.keys(sessionInfo.sessionStorage))
  })

  test('2. Test manual queue API call with cookie', async ({ page, context }) => {
    console.log('\n=== TEST 2: Manual API Test ===\n')
    
    // Login first
    await page.goto('http://localhost:3000/login', { timeout: 30000 })
    await page.waitForTimeout(2000)
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 20000 })
    await page.waitForTimeout(3000)
    
    // Get cookies
    const cookies = await context.cookies()
    const authCookie = cookies.find(c => c.name.includes('auth-token'))
    
    if (authCookie) {
      console.log('Found auth cookie:', authCookie.name)
      
      // Try to parse the cookie
      try {
        const cookieValue = JSON.parse(authCookie.value)
        console.log('Cookie structure:', Object.keys(cookieValue))
        
        if (cookieValue.access_token) {
          console.log('Access token present: YES')
          console.log('Token starts with:', cookieValue.access_token.substring(0, 20))
          
          // Make manual fetch request
          const response = await page.evaluate(async (token) => {
            const res = await fetch('/api/start-queue', {
              headers: {
                'Authorization': `Bearer ${token}`
              },
              credentials: 'include'
            })
            return {
              status: res.status,
              body: await res.json()
            }
          }, cookieValue.access_token)
          
          console.log('\nManual API call result:')
          console.log('Status:', response.status)
          console.log('Queue length:', response.body.queue?.length || 0)
          console.log('Full response:', JSON.stringify(response.body, null, 2).substring(0, 500))
        }
      } catch (e) {
        console.log('Failed to parse cookie:', e)
      }
    } else {
      console.log('No auth cookie found!')
      console.log('Available cookies:', cookies.map(c => c.name))
    }
  })

  test('3. Check database access for user', async ({ page }) => {
    console.log('\n=== TEST 3: Database Access Check ===\n')
    
    // Login
    await page.goto('http://localhost:3000/login', { timeout: 30000 })
    await page.waitForTimeout(2000)
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 20000 })
    await page.waitForTimeout(3000)
    
    // Check if user can be determined from page
    const userInfo = await page.evaluate(() => {
      // Look for user info in the DOM
      const avatar = document.querySelector('img[alt]')
      const userName = document.querySelector('[href="/profile"] p')?.textContent
      
      return {
        avatarAlt: avatar?.getAttribute('alt'),
        userName
      }
    })
    
    console.log('User info from page:')
    console.log('Avatar alt:', userInfo.avatarAlt)
    console.log('User name:', userInfo.userName)
    
    // Screenshot for debugging
    await page.screenshot({ path: 'test-results/debug-03-user-check.png', fullPage: true })
  })

})