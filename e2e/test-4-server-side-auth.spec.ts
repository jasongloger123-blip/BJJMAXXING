import { test, expect } from '@playwright/test'

/**
 * TEST 4: Server-Side Auth Test
 * 
 * Tests the server-side auth handling with various scenarios.
 * This helps identify if the problem is on the server (not recognizing auth)
 * or on the client (not sending auth).
 */

test.describe('TEST 4: Server-Side Auth', () => {

  test('test auth with different token formats', async ({ page, context, request }) => {
    console.log('\n========================================')
    console.log('TEST 4A: Different Token Formats')
    console.log('========================================\n')

    // Login to get a valid token
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(1000)
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 15000 })
    await page.waitForTimeout(3000)

    // Get cookies and extract token
    const cookies = await context.cookies()
    const authCookie = cookies.find(c => c.name.includes('auth-token'))

    if (!authCookie) {
      console.log('❌ No auth cookie found!')
      return
    }

    let validToken: string | null = null
    try {
      const parsed = JSON.parse(authCookie.value)
      validToken = parsed.access_token
    } catch { }

    if (!validToken) {
      console.log('❌ Could not extract token!')
      return
    }

    const results: any[] = []

    // Test 1: Valid Bearer token
    console.log('\n--- Test 1: Valid Bearer Token ---')
    const resp1 = await request.get('http://localhost:3000/api/start-queue', {
      headers: { 'Authorization': `Bearer ${validToken}` }
    })
    const body1 = await resp1.json()
    results.push({ name: 'Valid Bearer', status: resp1.status(), hasClips: body1.queue?.length > 0 })
    console.log('Status:', resp1.status())
    console.log('Has clips:', body1.queue?.length > 0)

    // Test 2: Token without "Bearer " prefix
    console.log('\n--- Test 2: Token without Bearer prefix ---')
    const resp2 = await request.get('http://localhost:3000/api/start-queue', {
      headers: { 'Authorization': validToken }
    })
    const body2 = await resp2.json()
    results.push({ name: 'No Bearer prefix', status: resp2.status(), hasClips: body2.queue?.length > 0 })
    console.log('Status:', resp2.status())
    console.log('Has clips:', body2.queue?.length > 0)

    // Test 3: Lowercase "bearer"
    console.log('\n--- Test 3: Lowercase bearer ---')
    const resp3 = await request.get('http://localhost:3000/api/start-queue', {
      headers: { 'Authorization': `bearer ${validToken}` }
    })
    const body3 = await resp3.json()
    results.push({ name: 'Lowercase bearer', status: resp3.status(), hasClips: body3.queue?.length > 0 })
    console.log('Status:', resp3.status())
    console.log('Has clips:', body3.queue?.length > 0)

    // Test 4: Invalid token
    console.log('\n--- Test 4: Invalid token ---')
    const resp4 = await request.get('http://localhost:3000/api/start-queue', {
      headers: { 'Authorization': 'Bearer invalid_token_12345' }
    })
    const body4 = await resp4.json()
    results.push({ name: 'Invalid token', status: resp4.status(), hasClips: body4.queue?.length > 0 })
    console.log('Status:', resp4.status())
    console.log('Has clips:', body4.queue?.length > 0)

    // Test 5: Expired token (random valid-looking JWT structure)
    console.log('\n--- Test 5: Malformed token ---')
    const resp5 = await request.get('http://localhost:3000/api/start-queue', {
      headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dummy' }
    })
    const body5 = await resp5.json()
    results.push({ name: 'Malformed token', status: resp5.status(), hasClips: body5.queue?.length > 0 })
    console.log('Status:', resp5.status())
    console.log('Has clips:', body5.queue?.length > 0)

    // Summary
    console.log('\n========================================')
    console.log('TOKEN FORMAT TEST SUMMARY')
    console.log('========================================')
    results.forEach(r => {
      const status = r.hasClips ? '✅ WORKS' : '❌ NO CLIPS'
      console.log(`${r.name.padEnd(20)}: ${status} (HTTP ${r.status})`)
    })
  })

  test('test server-side cookie parsing', async ({ page, context, request }) => {
    console.log('\n========================================')
    console.log('TEST 4B: Server-Side Cookie Parsing')
    console.log('========================================\n')

    // Login first
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(1000)
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 15000 })
    await page.waitForTimeout(3000)

    const cookies = await context.cookies()
    const authCookie = cookies.find(c => c.name.includes('auth-token'))

    if (!authCookie) {
      console.log('❌ No auth cookie!')
      return
    }

    console.log('Auth cookie details:')
    console.log('  Name:', authCookie.name)
    console.log('  Domain:', authCookie.domain)
    console.log('  Path:', authCookie.path)
    console.log('  Secure:', authCookie.secure)
    console.log('  HttpOnly:', authCookie.httpOnly)
    console.log('  SameSite:', authCookie.sameSite)

    const results: any[] = []

    // Test 1: Full cookie string as-is
    console.log('\n--- Test 1: Full cookie string ---')
    const fullCookie = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    const resp1 = await request.get('http://localhost:3000/api/start-queue', {
      headers: { 'Cookie': fullCookie }
    })
    const body1 = await resp1.json()
    results.push({ name: 'Full cookie string', hasClips: body1.queue?.length > 0 })
    console.log('Has clips:', body1.queue?.length > 0)

    // Test 2: URL-encoded cookie
    console.log('\n--- Test 2: URL-encoded cookie ---')
    const encodedCookie = cookies.map(c => `${c.name}=${encodeURIComponent(c.value)}`).join('; ')
    const resp2 = await request.get('http://localhost:3000/api/start-queue', {
      headers: { 'Cookie': encodedCookie }
    })
    const body2 = await resp2.json()
    results.push({ name: 'URL-encoded cookie', hasClips: body2.queue?.length > 0 })
    console.log('Has clips:', body2.queue?.length > 0)

    // Test 3: Only auth cookie
    console.log('\n--- Test 3: Only auth cookie (no others) ---')
    const resp3 = await request.get('http://localhost:3000/api/start-queue', {
      headers: { 'Cookie': `${authCookie.name}=${authCookie.value}` }
    })
    const body3 = await resp3.json()
    results.push({ name: 'Only auth cookie', hasClips: body3.queue?.length > 0 })
    console.log('Has clips:', body3.queue?.length > 0)

    // Test 4: Only auth cookie URL-encoded
    console.log('\n--- Test 4: Only auth cookie URL-encoded ---')
    const resp4 = await request.get('http://localhost:3000/api/start-queue', {
      headers: { 'Cookie': `${authCookie.name}=${encodeURIComponent(authCookie.value)}` }
    })
    const body4 = await resp4.json()
    results.push({ name: 'Auth cookie encoded', hasClips: body4.queue?.length > 0 })
    console.log('Has clips:', body4.queue?.length > 0)

    // Summary
    console.log('\n========================================')
    console.log('COOKIE PARSING TEST SUMMARY')
    console.log('========================================')
    results.forEach(r => {
      const status = r.hasClips ? '✅ WORKS' : '❌ NO CLIPS'
      console.log(`${r.name.padEnd(25)}: ${status}`)
    })

    // Find working method
    const workingMethod = results.find(r => r.hasClips)
    if (workingMethod) {
      console.log('\n✓ Working method:', workingMethod.name)
    } else {
      console.log('\n❌ No method worked - server may not be reading cookies correctly')
    }
  })

  test('test concurrent requests with same auth', async ({ page, context, request }) => {
    console.log('\n========================================')
    console.log('TEST 4C: Concurrent Requests Test')
    console.log('========================================\n')

    // Login first
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(1000)
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 15000 })
    await page.waitForTimeout(3000)

    const cookies = await context.cookies()
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    const authCookie = cookies.find(c => c.name.includes('auth-token'))
    const token = authCookie ? JSON.parse(authCookie.value).access_token : null

    console.log('Sending 5 concurrent requests with same auth...')

    // Send 5 concurrent requests
    const requests = Array(5).fill(null).map((_, i) =>
      request.get('http://localhost:3000/api/start-queue', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cookie': cookieHeader,
          'X-Request-Num': String(i + 1)
        }
      }).then(async resp => {
        const body = await resp.json()
        return {
          index: i + 1,
          status: resp.status(),
          hasClips: body.queue?.length > 0,
          queueLength: body.queue?.length ?? 0
        }
      })
    )

    const results = await Promise.all(requests)

    console.log('\nResults:')
    results.forEach(r => {
      const status = r.hasClips ? '✅' : '❌'
      console.log(`  Request ${r.index}: ${status} HTTP ${r.status}, ${r.queueLength} clips`)
    })

    const allHaveClips = results.every(r => r.hasClips)
    const noneHaveClips = results.every(r => !r.hasClips)

    if (allHaveClips) {
      console.log('\n✅ All requests returned clips - auth is working consistently')
    } else if (noneHaveClips) {
      console.log('\n❌ No requests returned clips - auth consistently failing')
    } else {
      console.log('\n⚠️ MIXED RESULTS - some worked, some did not')
      console.log('This suggests a race condition or intermittent issue')
    }
  })

  test('test auth behavior after page reload', async ({ page, context }) => {
    console.log('\n========================================')
    console.log('TEST 4D: Auth After Page Reload')
    console.log('========================================\n')

    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(1000)
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 15000 })
    await page.waitForTimeout(3000)

    // Check first load
    const cookies1 = await context.cookies()
    console.log('After initial login:')
    console.log('  Cookies:', cookies1.length)
    console.log('  Auth cookie:', cookies1.some(c => c.name.includes('auth-token')) ? '✅' : '❌')

    const hasVideo1 = await page.locator('iframe[src*="youtube"]').isVisible().catch(() => false)
    console.log('  Video visible:', hasVideo1 ? '✅' : '❌')

    // Reload page
    console.log('\nReloading page...')
    await page.reload()
    await page.waitForTimeout(5000)

    // Check after reload
    const cookies2 = await context.cookies()
    console.log('After reload:')
    console.log('  Cookies:', cookies2.length)
    console.log('  Auth cookie:', cookies2.some(c => c.name.includes('auth-token')) ? '✅' : '❌')

    const hasVideo2 = await page.locator('iframe[src*="youtube"]').isVisible().catch(() => false)
    console.log('  Video visible:', hasVideo2 ? '✅' : '❌')

    // Compare
    console.log('\n========================================')
    console.log('RELOAD TEST SUMMARY')
    console.log('========================================')
    console.log('First load:  ', hasVideo1 ? '✅ Video shown' : '❌ No video')
    console.log('After reload:', hasVideo2 ? '✅ Video shown' : '❌ No video')

    if (hasVideo1 && !hasVideo2) {
      console.log('\n❌ PROBLEM: Video shows on first load but not after reload!')
      console.log('This suggests:')
      console.log('  - Session not persisting correctly')
      console.log('  - Cookie being cleared on reload')
      console.log('  - Server-side auth issue')
    } else if (!hasVideo1 && hasVideo2) {
      console.log('\n⚠️ Video only shows after reload (timing issue?)')
    } else if (!hasVideo1 && !hasVideo2) {
      console.log('\n❌ Video never shows - persistent auth problem')
    } else {
      console.log('\n✅ Video shows consistently')
    }
  })
})
