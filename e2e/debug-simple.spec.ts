import { test, expect } from '@playwright/test'

test('simple login test', async ({ page }) => {
  console.log('Starting simple login test...')
  
  // Track console messages
  const consoleMessages: string[] = []
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`
    consoleMessages.push(text)
    console.log('CONSOLE:', text.substring(0, 200))
  })
  
  // Track page errors
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message)
  })
  
  // Go to login
  console.log('Navigating to login...')
  await page.goto('http://localhost:3000/login', { timeout: 15000 })
  console.log('Page loaded:', page.url())
  
  await page.waitForTimeout(1000)
  
  // Fill login form
  console.log('Filling login form...')
  await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
  await page.fill('input[type="password"]', 'QwErTer312')
  
  // Take screenshot before submit
  await page.screenshot({ path: 'test-results/simple-before-submit.png' })
  
  // Submit and wait
  console.log('Submitting form...')
  await page.click('button[type="submit"]')
  
  // Wait for navigation with longer timeout
  console.log('Waiting for navigation...')
  try {
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    console.log('SUCCESS! Navigated to:', page.url())
  } catch (e) {
    console.log('Navigation timeout. Current URL:', page.url())
  }
  
  await page.waitForTimeout(3000)
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/simple-after-login.png', fullPage: true })
  
  // Print all console messages
  console.log('\n=== ALL CONSOLE MESSAGES ===')
  consoleMessages.forEach((msg, i) => {
    console.log(`${i + 1}. ${msg}`)
  })
  
  // Check page content
  const bodyText = await page.locator('body').textContent()
  console.log('\n=== PAGE TEXT (first 500 chars) ===')
  console.log(bodyText?.substring(0, 500) || 'EMPTY')
})
