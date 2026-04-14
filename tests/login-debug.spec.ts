import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = 'jasongloger@googlemail.com'
const ADMIN_PASSWORD = 'QwErTer312'

test('debug login process step by step', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  
  // Enable console logging
  page.on('console', msg => console.log('[Console]', msg.text()))
  page.on('pageerror', err => console.log('[Page Error]', err.message))
  
  // Step 1: Go to login
  console.log('Step 1: Navigate to login')
  await page.goto('http://localhost:3000/login')
  await page.waitForTimeout(1000)
  
  // Step 2: Fill credentials
  console.log('Step 2: Fill credentials')
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  
  // Step 3: Click submit and watch network
  console.log('Step 3: Submit form')
  
  // Listen to network requests
  const requests: any[] = []
  page.on('request', req => {
    if (req.url().includes('supabase') || req.url().includes('auth')) {
      requests.push({
        method: req.method(),
        url: req.url().substring(0, 100),
        headers: req.headers()
      })
    }
  })
  
  const responses: any[] = []
  page.on('response', async res => {
    if (res.url().includes('supabase') || res.url().includes('auth')) {
      const body = await res.json().catch(() => null)
      responses.push({
        status: res.status(),
        url: res.url().substring(0, 100),
        body: body ? JSON.stringify(body).substring(0, 200) : null
      })
    }
  })
  
  await page.click('button[type="submit"]')
  
  // Wait for auth requests
  await page.waitForTimeout(3000)
  
  console.log('Requests:', requests)
  console.log('Responses:', responses)
  
  // Check current URL
  console.log('Current URL:', page.url())
  
  // Check cookies after login
  const cookies = await context.cookies()
  console.log('Cookies after login:', cookies.length)
  cookies.forEach(c => {
    console.log(`  ${c.name}: ${c.value.substring(0, 50)}...`)
  })
  
  // Try manual API call to check session
  console.log('Trying manual session check...')
  const sessionCheck = await page.evaluate(async () => {
    try {
      // This would be your supabase client call
      const response = await fetch('http://localhost:3000/api/start-queue', {
        credentials: 'include'
      })
      return { status: response.status, ok: response.ok }
    } catch (e) {
      return { error: (e as Error).message }
    }
  })
  console.log('Session check result:', sessionCheck)
  
  await page.screenshot({ path: 'test-results/login-debug.png' })
  
  await context.close()
})
