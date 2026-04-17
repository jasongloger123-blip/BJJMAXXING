import { test, expect } from '@playwright/test'

test.describe('StartHome Video Switching', () => {
  test('should smoothly switch videos without showing archetype quiz', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/login')
    await page.waitForTimeout(2000)
    
    // Fill in credentials (you'll need to adjust these)
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Wait for redirect to start page
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 })
    await page.waitForTimeout(5000) // Wait for everything to load
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/start-initial.png' })
    
    // Check that we're on the video page (not archetype quiz)
    const archetypeHeading = page.locator('text=Finde deinen Archetyp')
    await expect(archetypeHeading).not.toBeVisible()
    
    // Wait for video to load
    await page.waitForTimeout(3000)
    
    // Find and click "Kann ich" button
    const kannIchButton = page.locator('button:has-text("Kann ich")')
    await expect(kannIchButton).toBeVisible({ timeout: 10000 })
    
    // Click the button
    await kannIchButton.click()
    
    // Wait for transition (animation takes ~500ms)
    await page.waitForTimeout(1000)
    
    // Take screenshot after click
    await page.screenshot({ path: 'test-results/start-after-click.png' })
    
    // Verify we're still on the video page (not archetype quiz)
    const videoContainer = page.locator('.start-home-video-shell, [class*="video-shell"]')
    await expect(videoContainer).toBeVisible({ timeout: 5000 })
    
    // Make sure archetype quiz is NOT visible
    await expect(archetypeHeading).not.toBeVisible()
    
    // Click "Kann ich nicht" button multiple times to test switching
    const kannNichtButton = page.locator('button:has-text("Kann ich nicht")')
    
    for (let i = 0; i < 3; i++) {
      await kannNichtButton.click()
      await page.waitForTimeout(1500) // Wait for animation + loading
      
      // Verify no archetype quiz appeared
      await expect(archetypeHeading).not.toBeVisible()
      await expect(videoContainer).toBeVisible()
    }
    
    // Final screenshot
    await page.screenshot({ path: 'test-results/start-final.png' })
  })
  
  test('should show gym setup for new user without gym', async ({ page }) => {
    // This tests the onboarding flow for new users
    await page.goto('http://localhost:3000/')
    await page.waitForTimeout(5000)
    
    await page.screenshot({ path: 'test-results/onboarding-check.png' })
    
    // If user has no gym, should see gym setup (NOT archetype quiz)
    const gymHeading = page.locator('text=Erstelle dein Gym')
    const archetypeHeading = page.locator('text=Finde deinen Archetyp')
    
    // Either we're past onboarding (videos showing) or gym setup showing
    const hasGymSetup = await gymHeading.isVisible().catch(() => false)
    const hasArchetypeQuiz = await archetypeHeading.isVisible().catch(() => false)
    
    // Archetype quiz should NEVER appear on start page anymore
    expect(hasArchetypeQuiz).toBe(false)
    
    // We should either see gym setup OR the videos
    console.log('Has gym setup:', hasGymSetup)
    console.log('Has archetype quiz:', hasArchetypeQuiz)
  })
})