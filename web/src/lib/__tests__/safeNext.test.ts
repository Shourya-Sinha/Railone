import { describe, expect, it } from 'vitest';
import { safeNext } from '../safeNext';

describe('safeNext (post-login redirect guard)', () => {
  it('allows same-origin paths', () => {
    expect(safeNext('/wallet?topup=1')).toBe('/wallet?topup=1');
  });
  it.each([null, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)'])('rejects %s', (v) => {
    expect(safeNext(v)).toBeNull();
  });
});
