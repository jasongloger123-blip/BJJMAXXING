import { test, expect } from '@playwright/test'

test.describe('Onboarding Flow', () => {
  test('should complete full onboarding flow', async ({ page }) => {
    // 1. Starte bei der Startseite (sollte zu login redirecten oder archetype zeigen)
    await page.goto('http://localhost:3001/')
    await page.waitForTimeout(5000)
    
    // Screenshot um zu sehen wo wir sind
    await page.screenshot({ path: 'test-results/01-start.png' })
    
    const url = page.url()
    console.log('Current URL:', url)
    
    // Wenn wir auf login sind, versuchen wir uns einzuloggen
    if (url.includes('/login')) {
      console.log('On login page, filling credentials...')
      await page.fill('input[type="email"]', 'test@example.com')
      await page.fill('input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      
      await page.waitForTimeout(5000)
      await page.screenshot({ path: 'test-results/02-after-login.png' })
      
      console.log('URL after login:', page.url())
    }
    
    // Warte und schaue wo wir gelandet sind
    await page.waitForTimeout(3000)
    const finalUrl = page.url()
    console.log('Final URL:', finalUrl)
    
    // Screenshot vom aktuellen Zustand
    await page.screenshot({ path: 'test-results/03-final-state.png', fullPage: true })
    
    // Prüfe ob wir nicht in einem Loop sind (URL ändert sich nicht mehr)
    const url1 = page.url()
    await page.waitForTimeout(2000)
    const url2 = page.url()
    await page.waitForTimeout(2000)
    const url3 = page.url()
    
    console.log('URL checks:', { url1, url2, url3 })
    
    if (url1 === url2 && url2 === url3) {
      console.log('✓ URL is stable, no redirect loop')
    } else {
      console.log('✗ URLs are changing - possible redirect loop!')
      throw new Error('Redirect loop detected!')
    }
  })
  
  test('should check specific onboarding pages', async ({ page }) => {
    // Teste direkten Zugriff auf /onboarding
    await page.goto('http://localhost:3001/onboarding')
    await page.waitForTimeout(5000)
    
    const url = page.url()
    console.log('/onboarding URL:', url)
    await page.screenshot({ path: 'test-results/04-onboarding.png', fullPage: true })
    
    // Teste direkten Zugriff auf /name-input
    await page.goto('http://localhost:3001/name-input')
    await page.waitForTimeout(5000)
    
    const url2 = page.url()
    console.log('/name-input URL:', url2)
    await page.screenshot({ path: 'test-results/05-name-input.png', fullPage: true })
    
    // Stelle sicher, dass keine Endlos-Redirects passieren
    const startTime = Date.now()
    let redirectCount = 0
    let lastUrl = page.url()
    
    while (Date.now() - startTime < 10000) {
      await page.waitForTimeout(1000)
      const currentUrl = page.url()
      if (currentUrl !== lastUrl) {
        redirectCount++
        lastUrl = currentUrl
        console.log(`Redirect ${redirectCount} to: ${currentUrl}`)
        if (redirectCount > 5) {
          throw new Error(`Too many redirects: ${redirectCount}`)
        }
      }
    }
    
    console.log('✓ No redirect loop detected')
  })
})