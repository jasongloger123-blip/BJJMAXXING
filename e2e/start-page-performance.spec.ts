import { test, expect } from '@playwright/test'

test('measure start page load time', async ({ page }) => {
  // Enable console logging
  const consoleLogs: string[] = []
  page.on('console', msg => consoleLogs.push(msg.text()))
  
  // Measure navigation time
  const startTime = Date.now()
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
  
  const navigationTime = Date.now() - startTime
  console.log(`Navigation took: ${navigationTime}ms`)
  
  // Wait for video to appear
  const videoStartTime = Date.now()
  await page.waitForSelector('iframe[src*="youtube"]', { timeout: 15000 })
  const videoLoadTime = Date.now() - videoStartTime
  console.log(`Video appeared after: ${videoLoadTime}ms after navigation`)
  
  // Check for loading states
  const shimmer = await page.locator('.shimmer').count()
  console.log(`Shimmer loaders found: ${shimmer}`)
  
  // Total time
  const totalTime = Date.now() - startTime
  console.log(`Total time: ${totalTime}ms`)
  
  // Expect video to be visible
  const video = page.locator('iframe[src*="youtube"]').first()
  await expect(video).toBeVisible()
  
  // Log all console messages
  console.log('Console logs:', consoleLogs.join('\n'))
})

test('measure authenticated start page', async ({ page }) => {
  // First login
  await page.goto('http://localhost:3000/login')
  await page.fill('input[type="email"]', 'test@example.com')
  await page.fill('input[type="password"]', 'password')
  await page.click('button[type="submit"]')
  
  // Wait for redirect to start page
  await page.waitForURL('http://localhost:3000/', { timeout: 10000 })
  
  // Measure load time after auth
  const startTime = Date.now()
  
  // Wait for video or content
  await page.waitForSelector('iframe[src*="youtube"], .shimmer', { timeout: 15000 })
  
  const loadTime = Date.now() - startTime
  console.log(`Authenticated load time: ${loadTime}ms`)
  
  // Check if video is loaded or still showing shimmer
  const hasVideo = await page.locator('iframe[src*="youtube"]').count() > 0
  const hasShimmer = await page.locator('.shimmer').count() > 0
  console.log(`Has video: ${hasVideo}, Has shimmer: ${hasShimmer}`)
})
