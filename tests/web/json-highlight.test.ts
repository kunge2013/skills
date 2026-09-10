import { describe, it, expect } from 'vitest';
import { escapeHtml, highlightJson } from '../../web/src/utils/jsonHighlight';

describe('jsonHighlight', () => {
  it('escapes HTML in string values', () => {
    expect(escapeHtml('<a>&"')).toBe('&lt;a&gt;&amp;&quot;');
  });

  it('wraps keys/strings/numbers/keywords with token classes', () => {
    const html = highlightJson('{"a":"x", "n": 1, "b": true}');
    expect(html).toContain('tok-key');
    expect(html).toContain('tok-string');
    expect(html).toContain('tok-number');
    expect(html).toContain('tok-keyword');
    expect(html).not.toContain('<a>');
  });

  it('highlights matching bracket pair and region when pair given', () => {
    const html = highlightJson('{"a":[1,2]}', [5, 10]);
    expect(html).toContain('tok-bracket');
    expect(html).toContain('tok-bracket-region');
  });
});
