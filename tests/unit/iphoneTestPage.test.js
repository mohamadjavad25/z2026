import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The iPhone check page is plain HTML, so nothing else notices when it drifts
// from the site it tests. It once told people to tap a top menu the phone site
// does not have. See docs/HEALTH.md, 2026-11-05.
const page = readFileSync(join(process.cwd(), 'public/iphone-test.html'), 'utf8');

describe('iPhone check page', () => {
  it('has every step picture it shows', () => {
    const pictures = [...page.matchAll(/img: '([^']+)'/g)].map((m) => m[1]);
    expect(pictures.length).toBeGreaterThan(0);
    for (const name of pictures) {
      expect(existsSync(join(process.cwd(), 'public/iphone-test', name)), name).toBe(true);
    }
  });

  it('opens each page from a button instead of asking people to find it', () => {
    expect(page).toContain("href: '/pricing'");
    expect(page).not.toContain('بالای صفحه، روی');
  });

  it('ends with copying the answers, not with a jump to Instagram', () => {
    expect(page).toContain('جواب‌ها رو کپی کن');
    expect(page).not.toContain('ig.me');
  });
});
