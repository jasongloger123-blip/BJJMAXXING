import { test, expect } from '@playwright/test'

test('complete archetype quiz flow and register', async ({ page }) => {
  // Navigate to landing page
  await page.goto('http://localhost:3000')
  
  // Click "Quiz starten" button on landing page
  const quizButton = await page.getByText(/Quiz starten|Archetyp finden/i).first()
  await quizButton.click()
  
  // Wait for quiz page
  await page.waitForURL('**/archetype-test')
  await expect(page.getByText('Welcher BJJ-Typ bist du?')).toBeVisible()
  
  // Answer all 6 questions
  for (let i = 0; i < 6; i++) {
    // Wait for question to be visible
    await page.waitForSelector('button', { timeout: 5000 })
    
    // Click first option
    const firstOption = await page.locator('button').first()
    await firstOption.click()
    
    // Wait a bit for transition
    await page.waitForTimeout(300)
  }
  
  // Wait for result page
  await page.waitForURL('**/archetype-result', { timeout: 10000 })
  
  // Check that result is shown (either blurred or clear)
  await expect(page.getByText(/Dein Archetyp|Archetyp ist bereit/i)).toBeVisible()
  
  // Click "Ergebnis freischalten"
  const unlockButton = await page.getByText('Ergebnis freischalten')
  await unlockButton.click()
  
  // Wait for register page with archetype params
  await page.waitForURL('**/register?**', { timeout: 5000 })
  
  // Fill registration form
  const testEmail = `test${Date.now()}@example.com`
  await page.fill('input[type="email"]', testEmail)
  await page.fill('input[type="password"]', 'testpassword123')
  
  // Submit registration
  await page.click('button[type="submit"]')
  
  // Wait for registration to complete and redirect
  await page.waitForTimeout(3000)
  
  // Check URL - should be home page or archetype-result
  const currentUrl = page.url()
  console.log('Final URL:', currentUrl)
  
  // Should be logged in now
  const { data: { user } } = await page.evaluate(async () => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    return await supabase.auth.getUser()
  })
  
  console.log('User after registration:', user)
  
  // Take screenshot for debugging
  await page.screenshot({ path: 'test-result.png' })
})
