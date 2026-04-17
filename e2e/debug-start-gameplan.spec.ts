import { test, expect } from '@playwright/test'

/**
 * DEBUG: Startseite Fortschritt und Gameplan Clips
 */

test.describe('Debug Startseite und Gameplan', () => {
  test('Startseite - check Standing progress', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('DEBUG: Startseite Standing Progress')
    console.log('========================================\n')
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(5000)
    
    // Screenshot der Startseite
    await page.screenshot({ path: 'test-results/start-home-debug.png', fullPage: true })
    
    // HTML nach Fortschrittsindikatoren durchsuchen
    const html = await page.content()
    
    // Suche nach "Standing" auf der Startseite
    const standingIndex = html.toLowerCase().indexOf('standing')
    if (standingIndex > -1) {
      const surroundingHtml = html.substring(Math.max(0, standingIndex - 500), Math.min(html.length, standingIndex + 500))
      console.log('\nHTML um Standing herum auf Startseite:')
      console.log(surroundingHtml)
    }
    
    // Alle Fortschrittsindikatoren finden (z.B. "0/5", "28/29", etc.)
    const progressMatches = html.match(/(\d+)\/(\d+)/g)
    console.log('\nAlle Fortschrittsindikatoren auf Startseite:', progressMatches)
    
    // Nach "Unlock" oder Progress-Bars suchen
    const unlockMatches = html.match(/unlock[\s\S]{0,100}(\d+)\/(\d+)/gi)
    console.log('\nUnlock-Fortschritte:', unlockMatches)
    
    expect(true).toBe(true)
  })

  test('Gameplan - check if clips are shown', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('DEBUG: Gameplan Clips Anzeige')
    console.log('========================================\n')
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(3000)
    
    // Gehe zum Gameplan
    await page.goto('http://localhost:3000/gameplan')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)
    
    // Screenshot
    await page.screenshot({ path: 'test-results/gameplan-debug.png', fullPage: true })
    
    // Klicke auf Standing Node
    console.log('Klicke auf Standing Node...')
    const standingButton = await page.locator('button:has-text("Standing")').first()
    if (await standingButton.isVisible().catch(() => false)) {
      await standingButton.click()
      await page.waitForTimeout(3000)
      
      // Screenshot nach Klick
      await page.screenshot({ path: 'test-results/gameplan-standing-clicked.png', fullPage: true })
      
      // HTML nach Klick
      const html = await page.content()
      
      // Suche nach Clips/Videoindikatoren
      const hasVideo = html.includes('youtube') || html.includes('iframe')
      const hasClipTitles = html.match(/clip|video|tim gorer|rafaela|amy camp/i)
      
      console.log('\nVideo gefunden:', hasVideo)
      console.log('Clip-Titel gefunden:', hasClipTitles)
      
      // Suche nach "28/29" oder ähnlichem
      const progressMatch = html.match(/(\d+)\/(29)/)
      if (progressMatch) {
        console.log(`\nFortschritt gefunden: ${progressMatch[1]}/${progressMatch[2]}`)
      } else {
        console.log('\nKein 29-Fortschritt gefunden')
        const anyProgress = html.match(/(\d+)\/(\d+)/g)
        console.log('Andere Fortschritte:', anyProgress)
      }
    } else {
      console.log('Standing Button nicht gefunden!')
    }
    
    expect(true).toBe(true)
  })
})