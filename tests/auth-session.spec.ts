import { test, expect } from '@playwright/test'

const TEST_EMAIL = 'jagrsg@web.de'
const TEST_PASSWORD = 'suighru48'

test.describe('Authentication Session Tests', () => {
  test('should show videos for authenticated user on desktop', async ({ page }) => {
    // Navigate to login
    await page.goto('http://localhost:3000/login')
    
    // Login with test credentials
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    
    // Wait for redirect to home
    await page.waitForURL('http://localhost:3000/')
    
    // Wait for video to load
    await page.waitForTimeout(3000)
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/desktop-auth-home.png' })
    
    // Check if video element exists
    const videoFrame = await page.$('iframe')
    expect(videoFrame).toBeTruthy()
  })

  test('should show videos in incognito mode', async ({ browser }) => {
    // Create incognito context
    const context = await browser.newContext()
    const page = await context.newPage()
    
    // Navigate to login
    await page.goto('http://localhost:3000/login')
    
    // Login
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    
    // Wait for redirect
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 })
    await page.waitForTimeout(3000)
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/incognito-auth-home.png' })
    
    // Check for video
    const videoFrame = await page.$('iframe')
    expect(videoFrame).toBeTruthy()
    
    await context.close()
  })

  test('should check network requests for start-queue', async ({ page }) => {
    const apiResponses: any[] = []
    
    // Listen to API responses
    page.on('response', async (response) => {
      if (response.url().includes('/api/start-queue')) {
        const data = await response.json().catch(() => null)
        apiResponses.push({
          url: response.url(),
          status: response.status(),
          data
        })
      }
    })
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 })
    await page.waitForTimeout(3000)
    
    // Log API responses
    console.log('API Responses:', JSON.stringify(apiResponses, null, 2))
    
    // Check if queue has videos
    const startQueueResponse = apiResponses.find(r => r.url.includes('start-queue'))
    expect(startQueueResponse).toBeTruthy()
    expect(startQueueResponse?.data?.queue?.length).toBeGreaterThan(0)
  })
})
