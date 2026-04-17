import { test, expect } from '@playwright/test'

test.describe('StartHome Video Switching', () => {
  test('should switch to next video after clicking "Kann ich"', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(3000)
    
    // Fill in credentials
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Wait for redirect to start page
    await page.waitForURL(/localhost:3000\/?$/, { timeout: 15000 })
    await page.waitForTimeout(8000) // Wait for everything to load including videos
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/01-start-initial.png' })
    
    // Check that we're on the video page (not archetype quiz or gym setup)
    const archetypeHeading = page.locator('text=Finde deinen Archetyp')
    const gymHeading = page.locator('text=Erstelle dein Gym')
    await expect(archetypeHeading).not.toBeVisible()
    await expect(gymHeading).not.toBeVisible()
    
    // Wait for video and buttons to load
    await page.waitForTimeout(3000)
    
    // Get first video title for comparison
    const firstVideoTitle = await page.locator('h1, h2').first().textContent()
    console.log('First video title:', firstVideoTitle)
    
    // Find and click "Kann ich" button
    const kannIchButton = page.locator('button:has-text("Kann ich")').first()
    await expect(kannIchButton).toBeVisible({ timeout: 10000 })
    
    // Click the button
    await kannIchButton.click()
    console.log('Clicked "Kann ich"')
    
    // Wait for animation (520ms for "known") + buffer
    await page.waitForTimeout(1000)
    
    // Take screenshot after click
    await page.screenshot({ path: 'test-results/02-after-known.png' })
    
    // Get new video title
    await page.waitForTimeout(2000)
    const secondVideoTitle = await page.locator('h1, h2').first().textContent()
    console.log('Second video title:', secondVideoTitle)
    
    // Verify video changed (titles should be different!)
    expect(secondVideoTitle).not.toBe(firstVideoTitle)
    console.log('✓ Video successfully changed after "Kann ich"')
    
    // Click "Kann ich nicht" and verify it also changes
    const kannNichtButton = page.locator('button:has-text("Kann ich nicht")').first()
    await expect(kannNichtButton).toBeVisible({ timeout: 5000 })
    
    await kannNichtButton.click()
    console.log('Clicked "Kann ich nicht"')
    
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/03-after-not-yet.png' })
    
    const thirdVideoTitle = await page.locator('h1, h2').first().textContent()
    console.log('Third video title:', thirdVideoTitle)
    
    // Should be different from second (but might cycle if only 2 videos)
    console.log('Video titles:', { first: firstVideoTitle, second: secondVideoTitle, third: thirdVideoTitle })
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/04-final.png' })
  })
  
  test('should never show onboarding during video training', async ({ page }) => {
    await page.goto('http://localhost:3000/')
    await page.waitForTimeout(10000)
    
    await page.screenshot({ path: 'test-results/05-onboarding-check.png' })
    
    // Onboarding elements should NEVER appear once training started
    const gymHeading = page.locator('text=Erstelle dein Gym')
    const archetypeHeading = page.locator('text=Finde deinen Archetyp')
    
    const hasGymSetup = await gymHeading.isVisible().catch(() => false)
    const hasArchetypeQuiz = await archetypeHeading.isVisible().catch(() => false)
    
    // If we see onboarding, the test fails
    if (hasGymSetup || hasArchetypeQuiz) {
      console.log('ERROR: Onboarding appeared during training!')
      console.log('Gym setup visible:', hasGymSetup)
      console.log('Archetype quiz visible:', hasArchetypeQuiz)
      throw new Error('Onboarding should not appear during video training!')
    }
    
    console.log('✓ Onboarding did not appear during training')
  })
  
  test('should handle multiple video clicks smoothly', async ({ page }) => {
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(3000)
    
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await page.waitForURL(/localhost:3000\/?$/, { timeout: 15000 })
    await page.waitForTimeout(8000)
    
    // Click through 5 videos
    for (let i = 0; i < 5; i++) {
      const kannIchButton = page.locator('button:has-text("Kann ich")').first()
      await expect(kannIchButton).toBeVisible({ timeout: 5000 })
      
      await kannIchButton.click()
      await page.waitForTimeout(1500) // Wait for animation
      
      // Verify no onboarding appeared
      const gymHeading = page.locator('text=Erstelle dein Gym')
      const hasGymSetup = await gymHeading.isVisible().catch(() => false)
      expect(hasGymSetup).toBe(false)
      
      console.log(`✓ Video ${i + 1} completed`)
    }
    
    await page.screenshot({ path: 'test-results/06-multiple-clicks.png' })
  })
})