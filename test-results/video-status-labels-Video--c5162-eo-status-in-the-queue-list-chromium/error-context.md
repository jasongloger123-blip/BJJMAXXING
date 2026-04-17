# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: video-status-labels.spec.ts >> Video Status UI Integration >> should show video status in the queue list
- Location: e2e\video-status-labels.spec.ts:146:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation to "http://localhost:3000/" until "load"
============================================================
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e6]:
    - link "BJJMAXXING" [ref=e8] [cursor=pointer]:
      - /url: /
      - img [ref=e10]
      - generic [ref=e12]: BJJMAXXING
    - generic [ref=e13]:
      - generic [ref=e14]:
        - heading "Willkommen zurück" [level=1] [ref=e15]
        - paragraph [ref=e16]: Logge dich ein, um mit deinem Gameplan weiterzumachen.
      - generic [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]: Email Adresse
          - textbox "deine@email.de" [ref=e22]
        - generic [ref=e23]:
          - generic [ref=e24]: Passwort
          - textbox "Passwort" [ref=e25]
        - button "ANMELDEN" [ref=e26] [cursor=pointer]
      - paragraph [ref=e28]:
        - text: Noch kein Konto?
        - link "Jetzt registrieren" [ref=e29] [cursor=pointer]:
          - /url: /register
```

# Test source

```ts
  33  |       return 'gesehen'
  34  |     }
  35  | 
  36  |     // Video exists in status but never seen (shouldn't happen, but handle gracefully)
  37  |     return 'offen'
  38  |   }
  39  | 
  40  |   test('should return "offen" when no status exists', () => {
  41  |     const result = calculateVideoStatus(null)
  42  |     expect(result).toBe('offen')
  43  |     
  44  |     const resultUndefined = calculateVideoStatus(undefined)
  45  |     expect(resultUndefined).toBe('offen')
  46  |   })
  47  | 
  48  |   test('should return "offen" when status exists but seen_count is 0', () => {
  49  |     const status: TrainingClipStatus = {
  50  |       seen_count: 0,
  51  |       can_count: 0,
  52  |       cannot_count: 0
  53  |     }
  54  |     const result = calculateVideoStatus(status)
  55  |     expect(result).toBe('offen')
  56  |   })
  57  | 
  58  |   test('should return "gesehen" when seen_count > 0 but can_count is 0', () => {
  59  |     const status: TrainingClipStatus = {
  60  |       seen_count: 1,
  61  |       can_count: 0,
  62  |       cannot_count: 0
  63  |     }
  64  |     const result = calculateVideoStatus(status)
  65  |     expect(result).toBe('gesehen')
  66  |     
  67  |     // Even if "Kann ich nicht" was clicked (cannot_count > 0)
  68  |     const statusWithCannot: TrainingClipStatus = {
  69  |       seen_count: 2,
  70  |       can_count: 0,
  71  |       cannot_count: 2
  72  |     }
  73  |     const resultWithCannot = calculateVideoStatus(statusWithCannot)
  74  |     expect(resultWithCannot).toBe('gesehen')
  75  |   })
  76  | 
  77  |   test('should return "kann-ich" when can_count > 0', () => {
  78  |     const status: TrainingClipStatus = {
  79  |       seen_count: 1,
  80  |       can_count: 1,
  81  |       cannot_count: 0
  82  |     }
  83  |     const result = calculateVideoStatus(status)
  84  |     expect(result).toBe('kann-ich')
  85  |   })
  86  | 
  87  |   test('should return "kann-ich" even if "Kann ich nicht" was clicked before', () => {
  88  |     // User clicked "Kann ich nicht" 3 times, then "Kann ich" once
  89  |     const status: TrainingClipStatus = {
  90  |       seen_count: 4,
  91  |       can_count: 1,
  92  |       cannot_count: 3
  93  |     }
  94  |     const result = calculateVideoStatus(status)
  95  |     expect(result).toBe('kann-ich')
  96  |   })
  97  | 
  98  |   test('should return "kann-ich" even with high seen_count', () => {
  99  |     const status: TrainingClipStatus = {
  100 |       seen_count: 10,
  101 |       can_count: 5,
  102 |       cannot_count: 2
  103 |     }
  104 |     const result = calculateVideoStatus(status)
  105 |     expect(result).toBe('kann-ich')
  106 |   })
  107 | 
  108 |   test('should prioritize "kann-ich" over "gesehen"', () => {
  109 |     // Both seen_count and can_count are > 0
  110 |     const status: TrainingClipStatus = {
  111 |       seen_count: 5,
  112 |       can_count: 2,
  113 |       cannot_count: 1
  114 |     }
  115 |     const result = calculateVideoStatus(status)
  116 |     // Even though seen_count > 0, can_count takes priority
  117 |     expect(result).toBe('kann-ich')
  118 |   })
  119 | })
  120 | 
  121 | test.describe('Video Status UI Integration', () => {
  122 |   const BASE_URL = 'http://localhost:3000'
  123 |   
  124 |   test.beforeEach(async ({ page }) => {
  125 |     // Login before each test
  126 |     await page.goto(`${BASE_URL}/login`)
  127 |     await page.waitForTimeout(2000)
  128 |     
  129 |     await page.fill('input[type="email"]', 'test@example.com')
  130 |     await page.fill('input[type="password"]', 'password123')
  131 |     await page.click('button[type="submit"]')
  132 |     
> 133 |     await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 })
      |                ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  134 |     await page.waitForTimeout(3000)
  135 |   })
  136 | 
  137 |   test('should display "Nächste Videos" heading on the page', async ({ page }) => {
  138 |     // The heading should be visible
  139 |     const heading = page.locator('text=Nächste Videos').first()
  140 |     await expect(heading).toBeVisible({ timeout: 10000 })
  141 |     
  142 |     // Screenshot for documentation
  143 |     await page.screenshot({ path: 'test-results/nachste-videos-heading.png' })
  144 |   })
  145 | 
  146 |   test('should show video status in the queue list', async ({ page }) => {
  147 |     // Wait for queue
  148 |     await page.waitForTimeout(2000)
  149 |     
  150 |     // Check for any of the status labels
  151 |     const statusLabels = page.locator('text=Offen, text=Gesehen, text=Kann ich')
  152 |     const count = await statusLabels.count()
  153 |     
  154 |     console.log(`Found ${count} status labels on the page`)
  155 |     
  156 |     // Take screenshot showing status labels
  157 |     await page.screenshot({ path: 'test-results/video-status-in-queue.png', fullPage: true })
  158 |   })
  159 | })
  160 | 
```