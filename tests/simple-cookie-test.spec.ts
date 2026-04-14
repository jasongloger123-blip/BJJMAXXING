import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = 'jasongloger@googlemail.com'
const ADMIN_PASSWORD = 'QwErTer312'

test('check cookie after login', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  
  // Navigate to login
  await page.goto('http://localhost:3000/login')
  console.log('On login page')
  
  // Fill and submit
  await page.fill('input[type="email"]', ADMIN_EMAIL)
  await page.fill('input[type="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  
  // Wait for potential redirect
  await page.waitForTimeout(3000)
  
  console.log('Current URL:', page.url())
  
  // Check cookies
  const cookies = await context.cookies()
  console.log('Cookies found:', cookies.length)
  cookies.forEach(c => {
    console.log(`  ${c.name}: secure=${c.secure}, sameSite=${c.sameSite}, httpOnly=${c.httpOnly}`)
  })
  
  // Check if auth cookie exists
  const authCookie = cookies.find(c => c.name.includes('auth-token'))
  if (authCookie) {
    console.log('Auth cookie exists!')
    console.log('Cookie value length:', authCookie.value.length)
    console.log('Cookie details:', {
      domain: authCookie.domain,
      path: authCookie.path,
      secure: authCookie.secure,
      sameSite: authCookie.sameSite,
      httpOnly: authCookie.httpOnly
    })
  } else {
    console.log('No auth cookie found!')
  }
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/cookie-test.png' })
  
  // Check localStorage
  const localStorage = await page.evaluate(() => {
    const items: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) items[key] = localStorage.getItem(key) || ''
    }
    return items
  })
  console.log('localStorage keys:', Object.keys(localStorage))
  
  await context.close()
})
