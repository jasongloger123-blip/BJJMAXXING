import { test, expect } from '@playwright/test'

/**
 * TEST 2: Request Interception Test
 * 
 * Intercepts all API requests to analyze headers, cookies, and auth behavior.
 * This helps identify if the client sends auth data correctly and how the server responds.
 */

test.describe('TEST 2: Request Interception', () => {
  
  test('intercept and analyze all API calls during login flow', async ({ page, context }) => {
    console.log('\n========================================')
    console.log('TEST 2: Request Interception Analysis')
    console.log('========================================\n')
    
    const requests: any[] = []
    const responses: any[] = []
    
    // Intercept ALL requests
    await page.route('**/*', async (route, request) => {
      const url = request.url()
      
      // Only log API and auth-related requests
      if (url.includes('/api/') || url.includes('supabase') || url.includes('auth')) {
        const headers = await request.allHeaders()
        const cookieHeader = headers['cookie'] || headers['Cookie'] || 'NO COOKIE HEADER'
        const authHeader = headers['authorization'] || headers['Authorization'] || 'NO AUTH HEADER'
        
        const requestInfo = {
          method: request.method(),
          url: url,
          timestamp: Date.now(),
          cookiePreview: cookieHeader.substring(0, 200),
          authPreview: authHeader.substring(0, 100),
        }
        
        requests.push(requestInfo)
        console.log(`\n[REQUEST] ${request.method()} ${url.split('/').pop()}`)
        console.log('  Cookie:', requestInfo.cookiePreview.substring(0, 80) + '...')
        console.log('  Auth:', requestInfo.authPreview)
      }
      
      await route.continue()
    })
    
    // Intercept responses
    page.on('response', async response => {
      const url = response.url()
      if (url.includes('/api/') || url.includes('auth')) {
        const request = response.request()
        const headers = await request.allHeaders()
        
        let body = null
        try {
          if (response.status() < 400) {
            body = await response.json()
          }
        } catch {}
        
        const responseInfo = {
          url: url,
          status: response.status(),
          hasAuth: !!(headers['authorization'] || headers['cookie']),
          bodyPreview: body ? JSON.stringify(body).substring(0, 200) : 'No body',
        }
        
        responses.push(responseInfo)
        console.log(`\n[RESPONSE] ${response.status()} ${url.split('/').pop()}`)
        if (body) {
          console.log('  Body preview:', responseInfo.bodyPreview.substring(0, 150))
        }
      }
    })
    
    // Step 1: Navigate to login
    console.log('\n--- Step 1: Navigate to login ---')
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(2000)
    
    const cookiesBefore = await context.cookies()
    console.log('\nCookies before login:', cookiesBefore.map(c => c.name))
    
    // Step 2: Fill and submit login
    console.log('\n--- Step 2: Submit login ---')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    
    // Click and wait for navigation
    await Promise.all([
      page.waitForNavigation({ url: 'http://localhost:3000/', timeout: 20000 }),
      page.click('button[type="submit"]')
    ])
    
    console.log('\n--- Step 3: After redirect ---')
    await page.waitForTimeout(3000)
    
    // Check cookies after login
    const cookiesAfter = await context.cookies()
    console.log('\nCookies after login:')
    const authCookie = cookiesAfter.find(c => c.name.includes('auth-token'))
    if (authCookie) {
      console.log(`  ${authCookie.name}:`)
      console.log(`    Domain: ${authCookie.domain}`)
      console.log(`    Path: ${authCookie.path}`)
      console.log(`    Secure: ${authCookie.secure}`)
      console.log(`    SameSite: ${authCookie.sameSite}`)
      console.log(`    HttpOnly: ${authCookie.httpOnly}`)
      try {
        const parsed = JSON.parse(authCookie.value)
        console.log(`    Has access_token: ${!!parsed.access_token}`)
        console.log(`    Has refresh_token: ${!!parsed.refresh_token}`)
      } catch {}
    } else {
      console.log('  ❌ No auth cookie found!')
    }
    
    // Step 4: Wait for start-queue call
    console.log('\n--- Step 4: Waiting for start-queue API call ---')
    await page.waitForTimeout(5000)
    
    // Find the start-queue request
    const startQueueRequest = requests.find(r => r.url.includes('/api/start-queue'))
    const startQueueResponse = responses.find(r => r.url.includes('/api/start-queue'))
    
    console.log('\n========================================')
    console.log('ANALYSIS SUMMARY')
    console.log('========================================')
    
    if (startQueueRequest) {
      console.log('\n✓ Found start-queue request:')
      console.log('  Method:', startQueueRequest.method)
      console.log('  Had Cookie header:', startQueueRequest.cookiePreview !== 'NO COOKIE HEADER')
      console.log('  Had Auth header:', startQueueRequest.authPreview !== 'NO AUTH HEADER')
    } else {
      console.log('\n❌ No start-queue request captured!')
    }
    
    if (startQueueResponse) {
      console.log('\n✓ Found start-queue response:')
      console.log('  Status:', startQueueResponse.status)
      console.log('  Preview:', startQueueResponse.bodyPreview.substring(0, 100))
    } else {
      console.log('\n❌ No start-queue response captured!')
    }
    
    // Full request log
    console.log('\n========================================')
    console.log('ALL CAPTURED REQUESTS')
    console.log('========================================')
    requests.forEach((req, i) => {
      console.log(`\n${i + 1}. ${req.method} ${req.url.split('/').pop()}`)
      console.log('   Cookie present:', req.cookiePreview !== 'NO COOKIE HEADER')
      console.log('   Auth present:', req.authPreview !== 'NO AUTH HEADER')
    })
    
    // Screenshot
    await page.screenshot({ path: 'test-results/test2-request-interception.png', fullPage: true })
  })
  
  test('manual start-queue call with extracted token', async ({ page, context, request }) => {
    console.log('\n========================================')
    console.log('TEST 2B: Manual API Call with Token')
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
      console.log('❌ No auth cookie found after login!')
      return
    }
    
    // Parse token
    let token: string | null = null
    let refreshToken: string | null = null
    try {
      const parsed = JSON.parse(authCookie.value)
      token = parsed.access_token
      refreshToken = parsed.refresh_token
      console.log('Token extracted:', token ? 'YES' : 'NO')
      console.log('Refresh token extracted:', refreshToken ? 'YES' : 'NO')
    } catch (e) {
      console.log('❌ Failed to parse cookie:', e)
      return
    }
    
    // Test 1: Call with Authorization header
    console.log('\n--- Test: Authorization Header ---')
    const resp1 = await request.get('http://localhost:3000/api/start-queue', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const body1 = await resp1.json()
    console.log('Status:', resp1.status())
    console.log('Queue length:', body1.queue?.length ?? 0)
    if (body1.queue?.length > 0) {
      console.log('✅ SUCCESS: API returns clips with Authorization header')
    } else {
      console.log('❌ FAIL: API returns empty queue even with valid token')
      console.log('Response:', JSON.stringify(body1, null, 2))
    }
    
    // Test 2: Call with Cookie header only
    console.log('\n--- Test: Cookie Header Only ---')
    const cookieHeader = cookies.map(c => `${c.name}=${encodeURIComponent(c.value)}`).join('; ')
    const resp2 = await request.get('http://localhost:3000/api/start-queue', {
      headers: { 'Cookie': cookieHeader }
    })
    const body2 = await resp2.json()
    console.log('Status:', resp2.status())
    console.log('Queue length:', body2.queue?.length ?? 0)
    if (body2.queue?.length > 0) {
      console.log('✅ SUCCESS: API returns clips with cookies only')
    } else {
      console.log('❌ FAIL: API returns empty queue with cookies only')
    }
    
    // Test 3: Call with both headers
    console.log('\n--- Test: Both Authorization + Cookie ---')
    const resp3 = await request.get('http://localhost:3000/api/start-queue', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Cookie': cookieHeader
      }
    })
    const body3 = await resp3.json()
    console.log('Status:', resp3.status())
    console.log('Queue length:', body3.queue?.length ?? 0)
    if (body3.queue?.length > 0) {
      console.log('✅ SUCCESS: API returns clips with both headers')
    } else {
      console.log('❌ FAIL: API returns empty queue with both headers')
    }
    
    // Test 4: Call without any auth
    console.log('\n--- Test: No Auth (Guest) ---')
    const resp4 = await request.get('http://localhost:3000/api/start-queue')
    const body4 = await resp4.json()
    console.log('Status:', resp4.status())
    console.log('Queue length:', body4.queue?.length ?? 0)
    if (body4.queue?.length === 0) {
      console.log('✅ EXPECTED: API returns empty queue without auth')
    } else {
      console.log('⚠️ WARNING: API returns clips without auth!')
    }
    
    console.log('\n========================================')
    console.log('COMPARISON SUMMARY')
    console.log('========================================')
    console.log('Auth Header only:  ', body1.queue?.length > 0 ? '✅ WORKS' : '❌ FAILS')
    console.log('Cookie only:       ', body2.queue?.length > 0 ? '✅ WORKS' : '❌ FAILS')
    console.log('Both headers:      ', body3.queue?.length > 0 ? '✅ WORKS' : '❌ FAILS')
    console.log('No auth:           ', body4.queue?.length === 0 ? '✅ EXPECTED' : '⚠️ WARNING')
  })
})
