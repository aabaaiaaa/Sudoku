# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: variant-tier-caps.spec.ts >> Home difficulty picker hides infeasible tiers per variant
- Location: tests\e2e\variant-tier-caps.spec.ts:36:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByTestId('home-difficulty-medium')
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByTestId('home-difficulty-medium')
    8 × locator resolved to 1 element
      - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - heading "New game" [level=1] [ref=e5]
    - generic [ref=e6]:
      - heading "Variant" [level=2] [ref=e7]
      - radiogroup "Variant" [ref=e8]:
        - generic [ref=e9]:
          - radio "Classic" [ref=e10]
          - generic [ref=e11]: Classic
        - generic [ref=e12]:
          - radio "Mini" [ref=e13]
          - generic [ref=e14]: Mini
        - generic [ref=e15]:
          - radio "Six" [checked] [ref=e16]
          - generic [ref=e17]: Six
    - generic [ref=e18]:
      - heading "Difficulty" [level=2] [ref=e19]
      - radiogroup "Difficulty" [ref=e20]:
        - generic [ref=e21]:
          - radio "Easy" [checked] [ref=e22]
          - generic [ref=e23]: Easy
        - generic [ref=e24]:
          - radio "Medium" [ref=e25]
          - generic [ref=e26]: Medium
    - button "➕ New Game" [ref=e28] [cursor=pointer]
  - navigation "Primary" [ref=e29]:
    - button "Home" [ref=e30] [cursor=pointer]
    - button "Stats" [ref=e31] [cursor=pointer]
    - button "Learn" [ref=e32] [cursor=pointer]
    - button "Settings" [ref=e33] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * E2E — Difficulty picker hides infeasible tiers per variant.
  5  |  *
  6  |  * Iteration-4 §6 lever 3 descopes tiers the rater cannot reliably hit on a
  7  |  * given grid. The picker only exposes tiers each variant can realistically
  8  |  * produce — see `src/engine/generator/variant-tiers.ts`:
  9  |  *
  10 |  *   - Classic (9×9): Easy, Medium, Expert, Diabolical, Demonic, Nightmare
  11 |  *                    (Hard and Master descoped)
  12 |  *   - Six (6×6):     Easy only (harder tiers unreachable on the 6×6 grid)
  13 |  *   - Mini (4×4):    Easy only (harder tiers unreachable on the 4×4 grid)
  14 |  *
  15 |  * Switching the variant on Home must update the difficulty radio group to
  16 |  * match.
  17 |  */
  18 | 
  19 | const ALL_TIERS = [
  20 |   'easy',
  21 |   'medium',
  22 |   'hard',
  23 |   'expert',
  24 |   'master',
  25 |   'diabolical',
  26 |   'demonic',
  27 |   'nightmare',
  28 | ] as const;
  29 | 
  30 | const VARIANT_TIERS: Record<'classic' | 'six' | 'mini', readonly string[]> = {
  31 |   classic: ['easy', 'medium', 'expert', 'diabolical', 'demonic', 'nightmare'],
  32 |   six: ['easy'],
  33 |   mini: ['easy'],
  34 | };
  35 | 
  36 | test('Home difficulty picker hides infeasible tiers per variant', async ({
  37 |   page,
  38 | }) => {
  39 |   await page.goto('/');
  40 |   await page.evaluate(() => {
  41 |     window.localStorage.clear();
  42 |   });
  43 |   await page.reload();
  44 | 
  45 |   await expect(page.getByTestId('home-new-game')).toBeVisible();
  46 | 
  47 |   for (const variant of ['classic', 'six', 'mini'] as const) {
  48 |     await page.getByTestId(`home-variant-${variant}`).check();
  49 | 
  50 |     const expected = VARIANT_TIERS[variant];
  51 | 
  52 |     for (const tier of expected) {
  53 |       await expect(page.getByTestId(`home-difficulty-${tier}`)).toBeVisible();
  54 |     }
  55 | 
  56 |     for (const tier of ALL_TIERS) {
  57 |       if (expected.includes(tier)) continue;
> 58 |       await expect(page.getByTestId(`home-difficulty-${tier}`)).toHaveCount(0);
     |                                                                 ^ Error: expect(locator).toHaveCount(expected) failed
  59 |     }
  60 |   }
  61 | 
  62 |   // --- Explicit Mini check: only Easy is exposed. ------------------------
  63 |   await page.getByTestId('home-variant-mini').check();
  64 |   for (const tier of [
  65 |     'medium',
  66 |     'hard',
  67 |     'expert',
  68 |     'master',
  69 |     'diabolical',
  70 |     'demonic',
  71 |     'nightmare',
  72 |   ] as const) {
  73 |     await expect(page.getByTestId(`home-difficulty-${tier}`)).toHaveCount(0);
  74 |   }
  75 | 
  76 |   // Sanity: Mini exposes exactly 1 difficulty option.
  77 |   const miniRadios = page.locator(
  78 |     '[data-testid^="home-difficulty-"][type="radio"]',
  79 |   );
  80 |   await expect(miniRadios).toHaveCount(1);
  81 | });
  82 | 
```