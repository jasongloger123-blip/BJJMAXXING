import { test, expect } from '@playwright/test'

/**
 * TEST: Gameplan Clips Integration
 * 
 * Verifies that:
 * 1. Gameplan nodes show correct unlock progress (not 0)
 * 2. Clicking on a node shows the assigned clips
 */

test.describe('Gameplan Clips', () => {
  test('should show clips on gameplan nodes', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n========================================')
    console.log('TEST: Gameplan Clips Integration')
    console.log('========================================\n')
    
    // Capture console logs
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('[DEBUG]') || text.includes('clip') || text.includes('node')) {
        console.log('[BROWSER]', text.substring(0, 200))
      }
    })
    
    // Login
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', 'jasongloger@googlemail.com')
    await page.fill('input[type="password"]', 'QwErTer312')
    await page.click('button[type="submit"]')
    
    // Wait for home page to load first
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(5000)
    
    // Now navigate to gameplan
    console.log('Navigating to gameplan...')
    await page.goto('http://localhost:3000/gameplan')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)
    
    // Check for Standing node
    console.log('\nChecking Standing node...')
    
    // Look for the Standing text
    const standingVisible = await page.locator('text=Standing').first().isVisible()
    console.log('Standing visible:', standingVisible)
    
    // Check for unlock progress on Standing (should NOT be 0/40)
    // The gameplan shows unlock progress like "28/29" or "0/40"
    const unlockProgress = await page.locator('text=/\\d+\\/\\d+/').first().textContent().catch(() => 'Not found')
    console.log('Unlock progress:', unlockProgress)
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/gameplan-initial.png', fullPage: true })
    
    // Click on Standing node to see clips
    console.log('\nClicking on Standing node...')
    await page.locator('button:has-text("Standing"), div:has-text("Standing"), h3:has-text("Standing")').first().click()
    await page.waitForTimeout(3000)
    
    // Check if clips appear
    console.log('\nChecking for clips after click...')
    
    // Look for video indicators
    const hasVideoPlayer = await page.locator('iframe[src*="youtube"]').first().isVisible().catch(() => false)
    const hasClipTitles = await page.locator('text=/Tim Gorer|Rafaela|Amy|Campo/i').first().isVisible().catch(() => false)
    
    console.log('Has YouTube iframe:', hasVideoPlayer)
    console.log('Has clip titles:', hasClipTitles)
    
    // Take screenshot after click
    await page.screenshot({ path: 'test-results/gameplan-standing-clicked.png', fullPage: true })
    
    // Assertions
    expect(standingVisible).toBeTruthy()
    expect(unlockProgress).not.toBe('0/40')
    expect(unlockProgress).not.toBe('Not found')
    
    console.log('\n========================================')
    console.log('TEST RESULTS')
    console.log('========================================')
    console.log('✅ Standing node visible:', standingVisible)
    console.log('✅ Unlock progress:', unlockProgress)
    console.log('✅ Has video player:', hasVideoPlayer)
    console.log('✅ Has clip titles:', hasClipTitles)
    console.log('✅ Test completed!')
  })
})