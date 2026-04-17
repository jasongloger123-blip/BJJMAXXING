import { test, expect } from '@playwright/test'

/**
 * DIAGNOSTIC TEST: Why clips don't show outside admin browser
 * 
 * Admin credentials from .env:
 * - Email: jasongloger@googlemail.com
 * - Password: QwErTer312
 * 
 * This test diagnoses the auth/queue loading issue.
 */

test.describe('DIAGNOSE: Clip Loading Issue', () => {
  
  test('full auth flow with queue check', async ({ page, context }) => {
    console.log('\n========================================')
    console.log('STARTING CLIP LOADING DIAGNOSTIC TEST')
    console.log('========================================\n')
    
    // Track console logs
    const logs: string[] = []
    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`
      logs.push(text)
      console.log(text)
    })
    
    // Track API responses
    let startQueueResponse: any = null
    let startQueueStatus = 0
    
    page.on('response', async response => {
      const url = response.url()
      if (url.includes('/api/start-queue')) {
        startQueueStatus = response.status()
        try {
          startQueueResponse = await response.json()
          console.log('\n>>> /api/start-queue response:')
          console.log('Status:', startQueueStatus)
          console.log('Queue length:', startQueueResponse?.queue?.length ?? 0)
          if (startQueueResponse?.queue?.length > 0) {
            console.log('First clip:', startQueueResponse.queue[0].clipTitle)
          }
        } catch (e) {
          console.log('Failed to parse start-queue response')
        }
      }
    })
    
    // Step 1: Navigate to login
    console.log('Step 1: Navigating to login...')
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(1000)
    
    // Check cookies before login
    const cookiesBefore = await context.cookies()
    console.log('\nCookies before login:', cookiesBefore.map(c => c.name))
    
    // Step 2: Fill credentials
    console.log('\nStep 2: Filling credentials...')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    
    // Step 3: Click login and wait
    console.log('\nStep 3: Submitting login...')
    const loginPromise = page.waitForResponse(r => r.url().includes('/api/auth/login'))
    await page.click('button[type="submit"]')
    const loginResp = await loginPromise
    console.log('Login API status:', loginResp.status())
    
    // Wait for redirect
    await page.waitForURL('http://localhost:3000/', { timeout: 15000 })
    console.log('\nStep 4: Redirected to home page')
    
    // Wait for queue to load
    await page.waitForTimeout(5000)
    
    // Check cookies after login
    const cookiesAfter = await context.cookies()
    console.log('\nCookies after login:')
    for (const c of cookiesAfter) {
      const isAuth = c.name.includes('auth-token')
      console.log(`  ${c.name}${isAuth ? ' [AUTH]' : ''}`)
      if (isAuth) {
        console.log(`    Domain: ${c.domain}`)
        console.log(`    Path: ${c.path}`)
        console.log(`    Secure: ${c.secure}`)
        console.log(`    SameSite: ${c.sameSite}`)
        try {
          const parsed = JSON.parse(c.value)
          console.log(`    Has access_token: ${!!parsed.access_token}`)
        } catch {}
      }
    }
    
    // Step 5: Check page state
    console.log('\nStep 5: Checking page state...')
    const pageContent = await page.content()
    
    // Check for various states
    const hasVideo = pageContent.includes('youtube.com/embed') || pageContent.includes('iframe')
    const hasLoading = pageContent.includes('Lade Clip') || pageContent.includes('Loading')
    const hasEmpty = pageContent.includes('Queue ist leer') || pageContent.includes('keine Videos')
    
    console.log('  Has video iframe:', hasVideo)
    console.log('  Shows loading:', hasLoading)
    console.log('  Shows empty queue:', hasEmpty)
    
    // Check for specific elements
    const videoFrame = page.locator('iframe').first()
    const isVideoVisible = await videoFrame.isVisible().catch(() => false)
    console.log('  Video iframe visible:', isVideoVisible)
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/diagnose-home-page.png', fullPage: true })
    console.log('\nScreenshot saved: test-results/diagnose-home-page.png')
    
    // Step 6: Summary
    console.log('\n========================================')
    console.log('DIAGNOSTIC SUMMARY')
    console.log('========================================')
    console.log('Start-queue API status:', startQueueStatus)
    console.log('Queue items returned:', startQueueResponse?.queue?.length ?? 0)
    console.log('Video visible on page:', isVideoVisible)
    
    if (startQueueResponse?.queue?.length === 0) {
      console.log('\n⚠️  PROBLEM: Queue is empty!')
      console.log('This means the API returned an empty queue.')
    }
    
    // Check auth-related console messages
    const authLogs = logs.filter(l => 
      l.toLowerCase().includes('auth') || 
      l.toLowerCase().includes('session') ||
      l.toLowerCase().includes('cookie') ||
      l.toLowerCase().includes('user') ||
      l.toLowerCase().includes('queue')
    )
    
    console.log('\nRelevant logs:')
    authLogs.forEach(l => console.log('  ', l))
  })
  
  test('direct API test with auth', async ({ page, context, request }) => {
    console.log('\n========================================')
    console.log('DIRECT API TEST')
    console.log('========================================\n')
    
    // Login first
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(1000)
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 15000 })
    await page.waitForTimeout(3000)
    
    // Get cookies
    const cookies = await context.cookies()
    const authCookie = cookies.find(c => c.name.includes('auth-token'))
    
    if (!authCookie) {
      console.log('❌ No auth cookie found!')
      return
    }
    
    console.log('Found auth cookie:', authCookie.name)
    
    // Parse cookie
    let token: string | null = null
    try {
      const parsed = JSON.parse(authCookie.value)
      token = parsed.access_token
      console.log('Access token extracted:', token ? 'YES' : 'NO')
    } catch (e) {
      console.log('❌ Failed to parse cookie')
      return
    }
    
    if (!token) {
      console.log('❌ No access token in cookie')
      return
    }
    
    // Make direct API call with Authorization header
    console.log('\nMaking direct API call with token...')
    const response = await request.get('http://localhost:3000/api/start-queue', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    console.log('Response status:', response.status())
    const body = await response.json()
    console.log('Queue length:', body.queue?.length ?? 0)
    
    if (body.queue?.length > 0) {
      console.log('\n✅ API returns clips when called with Authorization header!')
      console.log('First clip:', body.queue[0].clipTitle)
    } else {
      console.log('\n❌ API returns empty queue even with valid token')
      console.log('Response:', JSON.stringify(body, null, 2))
    }
    
    // Now test without Authorization header (cookie only)
    console.log('\nMaking API call with cookies only...')
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    const response2 = await request.get('http://localhost:3000/api/start-queue', {
      headers: {
        'Cookie': cookieHeader
      }
    })
    
    console.log('Response status (cookie only):', response2.status())
    const body2 = await response2.json()
    console.log('Queue length (cookie only):', body2.queue?.length ?? 0)
    
    if (body2.queue?.length > 0) {
      console.log('\n✅ API returns clips with cookies only!')
    } else {
      console.log('\n❌ API returns empty queue with cookies only')
      console.log('This suggests cookie-based auth is not working')
    }
  })
})
