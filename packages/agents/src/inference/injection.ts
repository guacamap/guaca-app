export interface InjectionSignal {
  suspected: boolean;
  reasons: string[];
}

const PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: 'ignore_instructions', re: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i },
  { id: 'you_are_now', re: /you\s+are\s+now\b/i },
  { id: 'system_override', re: /\bsystem\s*:/i },
  { id: 'im_start', re: /<\|im_start\|>|<\|im_end\|>/i },
  { id: 'fake_ref_block', re: /\[REF\s+\d+\]/i },
];

export function detectInjection(text: string): InjectionSignal {
  const reasons: string[] = [];
  for (const { id, re } of PATTERNS) {
    if (re.test(text)) reasons.push(id);
  }
  if (/[A-Za-z0-9+/]{200,}={0,2}/.test(text)) reasons.push('long_base64');
  const cyrillic = (text.match(/[\u0400-\u04FF]/g) ?? []).length;
  if (cyrillic > 3) reasons.push('homoglyph_density');
  return { suspected: reasons.length > 0, reasons };
}
