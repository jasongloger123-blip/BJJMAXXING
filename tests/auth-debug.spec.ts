import { test, expect } from '@playwright/test'

const TEST_EMAIL = 'jagrsg@web.de'
const TEST_PASSWORD = 'suighru48'

test.describe('Auth Debug Tests', () => {
  test('debug auth in incognito mode', async ({ browser }) => {
    // Create fresh incognito context
    const context = await browser.newContext({
      // Simulate incognito/third-party cookie blocking
      bypassCSP: false,
    })
    
    const page = await context.newPage()
    
    // Listen to console messages
    const consoleMessages: string[] = []
    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`
      consoleMessages.push(text)
      console.log(text)
    })
    
    // Listen to network requests
    page.on('request', request => {
      if (request.url().includes('/api/') || request.url().includes('auth')) {
        console.log(`[Request] ${request.method()} ${request.url()}`)
      }
    })
    
    page.on('response', async response => {
      if (response.url().includes('/api/start-queue')) {
        const data = await response.json().catch(() => null)
        console.log(`[Response] ${response.status()} ${response.url()}`)
        console.log('Response data:', JSON.stringify(data, null, 2))
      }
    })

    // Step 1: Navigate to login
    console.log('=== Step 1: Navigate to login ===')
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(1000)
    
    // Step 2: Login
    console.log('=== Step 2: Login ===')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    
    // Wait for redirect
    await page.waitForTimeout(3000)
    console.log('Current URL:', page.url())
    
    // Step 3: Check if video loaded
    console.log('=== Step 3: Check video ===')
    const videoFrame = await page.$('iframe')
    const loadingSpinner = await page.$('.animate-spin')
    const debugQueue = await page.$('text=Debug Queue')
    
    console.log('Video iframe found:', !!videoFrame)
    console.log('Loading spinner found:', !!loadingSpinner)
    console.log('Debug Queue found:', !!debugQueue)
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/debug-home.png', fullPage: true })
    
    // Check cookies
    const cookies = await context.cookies()
    console.log('=== Cookies ===')
    cookies.forEach(cookie => {
      console.log(`  ${cookie.name}: ${cookie.value.substring(0, 50)}...`)
    })
    
    // Check localStorage
    const localStorage = await page.evaluate(() => {
      const items: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          items[key] = localStorage.getItem(key) || ''
        }
      }
      return items
    })
    console.log('=== localStorage ===')
    Object.entries(localStorage).forEach(([key, value]) => {
      if (key.includes('auth') || key.includes('supabase')) {
        console.log(`  ${key}: ${value.substring(0, 100)}...`)
      }
    })
    
    // Dump all console messages
    console.log('=== Console Messages ===')
    consoleMessages.forEach(msg => console.log(msg))
    
    // Assertions
    expect(videoFrame || loadingSpinner).toBeTruthy()
    
    await context.close()
  })
  
  test('compare normal vs incognito', async ({ browser }) => {
    // Test 1: Normal context
    console.log('=== Testing Normal Context ===')
    const normalContext = await browser.newContext()
    const normalPage = await normalContext.newPage()
    
    await normalPage.goto('http://localhost:3000/login')
    await normalPage.fill('input[type="email"]', TEST_EMAIL)
    await normalPage.fill('input[type="password"]', TEST_PASSWORD)
    await normalPage.click('button[type="submit"]')
    await normalPage.waitForTimeout(3000)
    
    const normalVideo = await normalPage.$('iframe[src*="youtube"]')
    console.log('Normal context - Video found:', !!normalVideo)
    await normalPage.screenshot({ path: 'test-results/normal-context.png' })
    
    // Check cookies
    const normalCookies = await normalContext.cookies()
    console.log('Normal context cookies:', normalCookies.map(c => c.name))
    
    await normalContext.close()
    
    // Test 2: Incognito context
    console.log('=== Testing Incognito Context ===')
    const incognitoContext = await browser.newContext()
    const incognitoPage = await incognitoContext.newPage()
    
    await incognitoPage.goto('http://localhost:3000/login')
    await incognitoPage.fill('input[type="email"]', TEST_EMAIL)
    await incognitoPage.fill('input[type="password"]', TEST_PASSWORD)
    await incognitoPage.click('button[type="submit"]')
    await incognitoPage.waitForTimeout(3000)
    
    const incognitoVideo = await incognitoPage.$('iframe[src*="youtube"]')
    console.log('Incognito context - Video found:', !!incognitoVideo)
    await incognitoPage.screenshot({ path: 'test-results/incognito-context.png' })
    
    // Check cookies
    const incognitoCookies = await incognitoContext.cookies()
    console.log('Incognito context cookies:', incognitoCookies.map(c => c.name))
    
    await incognitoContext.close()
  })
})
