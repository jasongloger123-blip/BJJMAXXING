# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\auth-debug.spec.ts >> Auth Debug Tests >> admin login with detailed diagnostics
- Location: tests\auth-debug.spec.ts:9:7

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - link "Zurueck zur Landingpage" [ref=e6] [cursor=pointer]:
        - /url: /
        - img [ref=e7]
        - text: Zurueck zur Landingpage
      - link "BJJMAXXING" [ref=e9] [cursor=pointer]:
        - /url: /
        - img [ref=e11]
        - generic [ref=e13]: BJJMAXXING
    - generic [ref=e14]:
      - generic [ref=e15]:
        - heading "Willkommen zurueck" [level=1] [ref=e16]
        - paragraph [ref=e17]: Logge dich ein, um mit deinem Gameplan weiterzumachen.
      - generic [ref=e20]:
        - generic [ref=e21]:
          - text: Email Adresse
          - textbox "deine@email.de" [ref=e22]
        - generic [ref=e23]:
          - text: Passwort
          - textbox "Passwort" [ref=e24]
        - button "ANMELDEN" [ref=e25]
      - paragraph [ref=e27]:
        - text: Noch kein Konto?
        - link "Jetzt registrieren" [ref=e28] [cursor=pointer]:
          - /url: /register
```