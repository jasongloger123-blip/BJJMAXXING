import { test, expect } from '@playwright/test'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Admin credentials from .env file
const ADMIN_EMAIL = 'jasongloger@googlemail.com'
const ADMIN_PASSWORD = 'QwErTer312'
const BASE_URL = 'http://localhost:3000'

test.describe('Auth Debug Tests', () => {
  test('admin login with detailed diagnostics', async ({ browser }) => {
    // Create fresh context (simulates clean browser)
    const context = await browser.newContext({
      // Clear all storage on start
      storageState: undefined,
    })
    
    const page = await context.newPage()
    
    // Enable detailed logging
    const logs: string[] = []
    const addLog = (msg: string) => {
      logs.push(msg)
      console.log(msg)
    }
    
    // Listen to console messages
    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`
      addLog(text)
    })
    
    page.on('pageerror', error => {
      addLog(`[Page Error] ${error.message}`)
    })
    
    // Listen to network
    page.on('request', request => {
      if (request.url().includes('/api/') || request.url().includes('auth')) {
        addLog(`[Request] ${request.method()} ${request.url()}`)
      }
    })
    
    page.on('response', async response => {
      if (response.url().includes('/api/start-queue')) {
        const data = await response.json().catch(() => null)
        addLog(`[Response] ${response.status()} ${response.url()}`)
        addLog(`[Response Body] ${JSON.stringify(data, null, 2)}`)
      }
    })

    // Step 1: Navigate to login
    addLog('=== Step 1: Navigate to login ===')
    await page.goto(`${BASE_URL}/login`)
    await page.waitForTimeout(2000)
    
    // Take screenshot before login
    await page.screenshot({ path: 'test-results/01-login-page.png' })
    
    // Step 2: Login with admin credentials
    addLog('=== Step 2: Login with admin credentials ===')
    addLog(`Email: ${ADMIN_EMAIL}`)
    
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    
    // Click submit and wait
    await page.click('button[type="submit"]')
    
    // Wait longer for login to complete
    await page.waitForTimeout(5000)
    
    addLog(`Current URL after login attempt: ${page.url()}`)
    
    // Take screenshot after login attempt
    await page.screenshot({ path: 'test-results/02-after-login.png', fullPage: true })
    
    // Step 3: If login successful, check home page
    if (page.url().includes('localhost:3000') && !page.url().includes('/login')) {
      addLog('=== Step 3: Check page elements ===')
      
      const videoFrame = await page.$('iframe')
      const loadingSpinner = await page.$('.animate-spin')
      const debugQueue = await page.$('text=Debug Queue')
      const loadingText = await page.$('text=Lade Clip')
      
      addLog(`Video iframe found: ${!!videoFrame}`)
      addLog(`Loading spinner found: ${!!loadingSpinner}`)
      addLog(`Debug Queue found: ${!!debugQueue}`)
      addLog(`Loading text found: ${!!loadingText}`)
      
      // Step 4: Check storage
      addLog('=== Step 4: Check storage ===')
      
      // Check cookies
      const cookies = await context.cookies()
      addLog(`Total cookies: ${cookies.length}`)
      cookies.forEach(cookie => {
        addLog(`  Cookie: ${cookie.name} (domain: ${cookie.domain}, path: ${cookie.path}, secure: ${cookie.secure}, sameSite: ${cookie.sameSite})`)
      })
      
      // Check localStorage
      const localStorage = await page.evaluate(() => {
        const items: Record<string, string> = {}
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key) {
            items[key] = localStorage.getItem(key)?.substring(0, 100) || ''
          }
        }
        return items
      })
      addLog(`localStorage items: ${Object.keys(localStorage).length}`)
      Object.entries(localStorage).forEach(([key, value]) => {
        if (key.includes('auth') || key.includes('supabase')) {
          addLog(`  localStorage[${key}]: ${value}...`)
        }
      })
      
      // Step 5: Check if API is working
      addLog('=== Step 5: Manual API check ===')
      
      // Try to call the API directly
      const apiResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/start-queue', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            headers: {
              'Accept': 'application/json'
            }
          })
          const data = await response.json()
          return { status: response.status, data }
        } catch (e) {
          return { error: (e as Error).message }
        }
      })
      
      addLog(`Direct API call result: ${JSON.stringify(apiResponse, null, 2)}`)
      
      // Step 6: Reload and check if session persists
      addLog('=== Step 6: Reload page ===')
      await page.reload()
      await page.waitForTimeout(3000)
      
      await page.screenshot({ path: 'test-results/03-after-reload.png', fullPage: true })
      
      const videoAfterReload = await page.$('iframe')
      addLog(`Video after reload: ${!!videoAfterReload}`)
    } else {
      addLog('Login may have failed - still on login page or redirected elsewhere')
    }
    
    // Save all logs
    addLog('=== Test Complete ===')
    
    await context.close()
    
    // Write logs to file
    const fs = require('fs')
    fs.mkdirSync('test-results', { recursive: true })
    fs.writeFileSync('test-results/test-log.txt', logs.join('\n'))
    
    // Assertions - for debug we just check the page loaded
    expect(page.url()).toContain('localhost:3000')
  })
  
  test('compare contexts with manual auth', async ({ browser }) => {
    const results: { name: string; hasVideo: boolean; cookies: string[]; queueLength: number }[] = []
    
    // Test in a fresh context
    console.log('=== Testing Fresh Context ===')
    const context = await browser.newContext({
      storageState: undefined,
    })
    const page = await context.newPage()
    
    // Navigate and login
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.fill('input[type="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(5000)
    
    // Check for video
    const video = await page.$('iframe[src*="youtube"]')
    const cookies = await context.cookies()
    
    // Get queue from API
    const apiResult = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/start-queue', {
          credentials: 'include',
          cache: 'no-store'
        })
        const data = await response.json()
        return data
      } catch (e) {
        return { error: (e as Error).message }
      }
    })
    
    results.push({
      name: 'Fresh Context',
      hasVideo: !!video,
      cookies: cookies.map(c => c.name),
      queueLength: apiResult.queue?.length || 0
    })
    
    await page.screenshot({ path: 'test-results/fresh-context.png' })
    await context.close()
    
    // Print results
    console.log('\n=== RESULTS ===')
    results.forEach(r => {
      console.log(`${r.name}:`)
      console.log(`  Video loaded: ${r.hasVideo}`)
      console.log(`  Queue length: ${r.queueLength}`)
      console.log(`  Cookies: ${r.cookies.join(', ') || 'none'}`)
    })
    
    // Video should load
    expect(results[0].queueLength).toBeGreaterThan(0)
  })
})