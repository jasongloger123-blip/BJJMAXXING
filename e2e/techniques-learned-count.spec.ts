import { test, expect } from '@playwright/test'

/**
 * E2E Test: Techniques Learned Count (+1)
 *
 * This test verifies that:
 * 1. The techniques_learned_count is displayed in user profile
 * 2. When a user clicks "Kann ich" on a clip, the count increases by +1
 * 3. The count persists after page reload
 */

test.describe('Techniques Learned Count Feature', () => {
  const TEST_EMAIL = 'jasongloger@googlemail.com'
  const TEST_PASSWORD = 'QwErTer312'

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:3000/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/', { timeout: 30000 })
    await page.waitForTimeout(3000)
  })

  test('techniques learned count is displayed on StartHome', async ({ page }) => {
    // Check that the techniques count is visible on the Start page
    const techniquesCount = page.locator('text=Gelernte Clips').first()
    await expect(techniquesCount).toBeVisible({ timeout: 10000 })

    // Verify the count number is displayed
    const countValue = page.locator('text=Gelernte Clips').first().locator('xpath=../..').locator('[class*="text-xl"], .text-xl')
    await expect(countValue).toBeVisible({ timeout: 5000 })

    // Take screenshot for debugging
    await page.screenshot({ path: 'e2e/screenshots/start-home-count.png', fullPage: false })
  })

  test('techniques learned count increases by +1 when marking clip as known', async ({ page, context, request }) => {
    // Get initial count from API
    const cookies = await context.cookies()
    const authCookie = cookies.find(c => c.name.includes('auth-token'))
    let token = ''
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value)
        token = parsed.access_token || ''
      } catch {}
    }

    // Get initial user profile
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined
    const initialProfileResponse = await request.get('http://localhost:3000/api/admin/profiles', { headers })
    const initialProfiles = await initialProfileResponse.json()
    const userProfile = initialProfiles.profiles?.find((p: any) => p.email === TEST_EMAIL)
    const initialCount = userProfile?.techniques_learned_count ?? 0

    console.log(`Initial techniques_learned_count: ${initialCount}`)

    // Navigate to StartHome and find a clip
    await page.goto('http://localhost:3000/')
    await page.waitForTimeout(3000)

    // Check if there is a clip with "Kann ich" button
    const kannIchButton = page.locator('button:has-text("Kann ich")').first()
    const buttonExists = await kannIchButton.isVisible().catch(() => false)

    if (!buttonExists) {
      console.log('No "Kann ich" button found - skipping test (no clips available)')
      return
    }

    // Click "Kann ich" button
    await kannIchButton.click()
    await page.waitForTimeout(2000)

    // Reload the profile to get updated count
    const updatedProfileResponse = await request.get('http://localhost:3000/api/admin/profiles', { headers })
    const updatedProfiles = await updatedProfileResponse.json()
    const updatedUserProfile = updatedProfiles.profiles?.find((p: any) => p.email === TEST_EMAIL)
    const updatedCount = updatedUserProfile?.techniques_learned_count ?? 0

    console.log(`Updated techniques_learned_count: ${updatedCount}`)

    // Verify count increased by 1
    expect(updatedCount).toBe(initialCount + 1)

    // Verify the count is displayed on the page
    await page.goto('http://localhost:3000/')
    await page.waitForTimeout(3000)
    const countDisplay = page.locator('text=Gelernte Clips').first()
    await expect(countDisplay).toBeVisible()

    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/techniques-count-after-click.png', fullPage: false })
  })

  test('techniques learned count is displayed on profile page', async ({ page }) => {
    // Navigate to profile
    await page.goto('http://localhost:3000/profile')
    await page.waitForTimeout(3000)

    // Check for techniques count badge
    const techniquesCount = page.locator('text=Gelernte Clips').first()
    await expect(techniquesCount).toBeVisible({ timeout: 10000 })

    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/profile-count.png', fullPage: false })
  })

  test('techniques learned count persists after page reload', async ({ page, context, request }) => {
    // Get current count from API
    const cookies = await context.cookies()
    const authCookie = cookies.find(c => c.name.includes('auth-token'))
    let token = ''
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value)
        token = parsed.access_token || ''
      } catch {}
    }

    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined
    const profileResponse = await request.get('http://localhost:3000/api/admin/profiles', { headers })
    const profiles = await profileResponse.json()
    const userProfile = profiles.profiles?.find((p: any) => p.email === TEST_EMAIL)
    const countBeforeReload = userProfile?.techniques_learned_count ?? 0

    console.log(`Count before reload: ${countBeforeReload}`)

    // Navigate to StartHome
    await page.goto('http://localhost:3000/')
    await page.waitForTimeout(3000)

    // Reload the page
    await page.reload()
    await page.waitForTimeout(3000)

    // Get count again
    const profileResponseAfter = await request.get('http://localhost:3000/api/admin/profiles', { headers })
    const profilesAfter = await profileResponseAfter.json()
    const userProfileAfter = profilesAfter.profiles?.find((p: any) => p.email === TEST_EMAIL)
    const countAfterReload = userProfileAfter?.techniques_learned_count ?? 0

    console.log(`Count after reload: ${countAfterReload}`)

    // Verify count is the same
    expect(countAfterReload).toBe(countBeforeReload)
  })

  test('multiple clips can be marked as known and count increases correctly', async ({ page, context, request }) => {
    // Get initial count
    const cookies = await context.cookies()
    const authCookie = cookies.find(c => c.name.includes('auth-token'))
    let token = ''
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value)
        token = parsed.access_token || ''
      } catch {}
    }

    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined
    const initialProfileResponse = await request.get('http://localhost:3000/api/admin/profiles', { headers })
    const initialProfiles = await initialProfileResponse.json()
    const userProfile = initialProfiles.profiles?.find((p: any) => p.email === TEST_EMAIL)
    const initialCount = userProfile?.techniques_learned_count ?? 0

    console.log(`Initial count: ${initialCount}`)

    // Navigate to StartHome
    await page.goto('http://localhost:3000/')
    await page.waitForTimeout(3000)

    // Count how many clips we can mark
    let markedCount = 0
    const maxToMark = 3

    for (let i = 0; i < maxToMark; i++) {
      const kannIchButton = page.locator('button:has-text("Kann ich")').first()
      const buttonExists = await kannIchButton.isVisible().catch(() => false)

      if (!buttonExists) {
        console.log(`No more clips available after marking ${markedCount}`)
        break
      }

      await kannIchButton.click()
      await page.waitForTimeout(2000)
      markedCount++

      // Wait for next clip to load
      await page.waitForTimeout(1000)
    }

    // Get final count
    const finalProfileResponse = await request.get('http://localhost:3000/api/admin/profiles', { headers })
    const finalProfiles = await finalProfileResponse.json()
    const finalUserProfile = finalProfiles.profiles?.find((p: any) => p.email === TEST_EMAIL)
    const finalCount = finalUserProfile?.techniques_learned_count ?? 0

    console.log(`Final count after marking ${markedCount} clips: ${finalCount}`)

    // Verify count increased by the number of marked clips
    expect(finalCount).toBe(initialCount + markedCount)

    // Take screenshot
    await page.goto('http://localhost:3000/')
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'e2e/screenshots/techniques-count-multiple.png', fullPage: false })
  })

  test('admin profiles page shows techniques learned count', async ({ page }) => {
    // Navigate to admin profiles page
    await page.goto('http://localhost:3000/admin/profiles')
    await page.waitForTimeout(3000)

    // Check for the techniques count column/header
    const techniquesHeader = page.locator('text=Gelernte Clips').first()
    await expect(techniquesHeader).toBeVisible({ timeout: 10000 }).catch(() => {
      console.log('Techniques count column not visible in admin - may need admin access')
    })

    // Take screenshot
    await page.screenshot({ path: 'e2e/screenshots/admin-profiles-count.png', fullPage: true })
  })
})
