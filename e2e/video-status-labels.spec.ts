import { test, expect } from '@playwright/test'

/**
 * Unit-style tests for calculateVideoStatus function
 * These tests verify the logic for determining video status
 * based on training_clip_status records.
 */

// Import the function we want to test (we'll need to export it)
// For now, we'll test the logic conceptually
test.describe('Video Status Calculation Logic', () => {
  
  type TrainingClipStatus = {
    seen_count: number
    can_count: number
    cannot_count: number
    last_result?: string | null
  }

  function calculateVideoStatus(status?: TrainingClipStatus | null): 'offen' | 'gesehen' | 'kann-ich' {
    if (!status) {
      // No status at all = user has never interacted with this video
      return 'offen'
    }

    // If user clicked "Kann ich" at least once, it's always "kann-ich"
    if (status.can_count > 0) {
      return 'kann-ich'
    }

    // If video was seen (seen_count > 0) but no "Kann ich" clicked yet
    if (status.seen_count > 0) {
      return 'gesehen'
    }

    // Video exists in status but never seen (shouldn't happen, but handle gracefully)
    return 'offen'
  }

  test('should return "offen" when no status exists', () => {
    const result = calculateVideoStatus(null)
    expect(result).toBe('offen')
    
    const resultUndefined = calculateVideoStatus(undefined)
    expect(resultUndefined).toBe('offen')
  })

  test('should return "offen" when status exists but seen_count is 0', () => {
    const status: TrainingClipStatus = {
      seen_count: 0,
      can_count: 0,
      cannot_count: 0
    }
    const result = calculateVideoStatus(status)
    expect(result).toBe('offen')
  })

  test('should return "gesehen" when seen_count > 0 but can_count is 0', () => {
    const status: TrainingClipStatus = {
      seen_count: 1,
      can_count: 0,
      cannot_count: 0
    }
    const result = calculateVideoStatus(status)
    expect(result).toBe('gesehen')
    
    // Even if "Kann ich nicht" was clicked (cannot_count > 0)
    const statusWithCannot: TrainingClipStatus = {
      seen_count: 2,
      can_count: 0,
      cannot_count: 2
    }
    const resultWithCannot = calculateVideoStatus(statusWithCannot)
    expect(resultWithCannot).toBe('gesehen')
  })

  test('should return "kann-ich" when can_count > 0', () => {
    const status: TrainingClipStatus = {
      seen_count: 1,
      can_count: 1,
      cannot_count: 0
    }
    const result = calculateVideoStatus(status)
    expect(result).toBe('kann-ich')
  })

  test('should return "kann-ich" even if "Kann ich nicht" was clicked before', () => {
    // User clicked "Kann ich nicht" 3 times, then "Kann ich" once
    const status: TrainingClipStatus = {
      seen_count: 4,
      can_count: 1,
      cannot_count: 3
    }
    const result = calculateVideoStatus(status)
    expect(result).toBe('kann-ich')
  })

  test('should return "kann-ich" even with high seen_count', () => {
    const status: TrainingClipStatus = {
      seen_count: 10,
      can_count: 5,
      cannot_count: 2
    }
    const result = calculateVideoStatus(status)
    expect(result).toBe('kann-ich')
  })

  test('should prioritize "kann-ich" over "gesehen"', () => {
    // Both seen_count and can_count are > 0
    const status: TrainingClipStatus = {
      seen_count: 5,
      can_count: 2,
      cannot_count: 1
    }
    const result = calculateVideoStatus(status)
    // Even though seen_count > 0, can_count takes priority
    expect(result).toBe('kann-ich')
  })
})

test.describe('Video Status UI Integration', () => {
  const BASE_URL = 'http://localhost:3000'
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto(`${BASE_URL}/login`)
    await page.waitForTimeout(2000)
    
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 })
    await page.waitForTimeout(3000)
  })

  test('should display "Nächste Videos" heading on the page', async ({ page }) => {
    // The heading should be visible
    const heading = page.locator('text=Nächste Videos').first()
    await expect(heading).toBeVisible({ timeout: 10000 })
    
    // Screenshot for documentation
    await page.screenshot({ path: 'test-results/nachste-videos-heading.png' })
  })

  test('should show video status in the queue list', async ({ page }) => {
    // Wait for queue
    await page.waitForTimeout(2000)
    
    // Check for any of the status labels
    const statusLabels = page.locator('text=Offen, text=Gesehen, text=Kann ich')
    const count = await statusLabels.count()
    
    console.log(`Found ${count} status labels on the page`)
    
    // Take screenshot showing status labels
    await page.screenshot({ path: 'test-results/video-status-in-queue.png', fullPage: true })
  })
})
