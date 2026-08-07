/**
 * Belt-and-braces free-text sweep (plan §7.3, step 8). Normalises NFKD,
 * strips diacritics, maps homoglyphs (Cyrillic а/е/о → Latin), then flags
 * capitalised n-grams and quoted spans not covered by catalog name tokens,
 * a fixed Venezuelan gazetteer, and generic nouns.
 *
 * Returns the offending spans; an empty array means the text is clean.
 */
const HOMOGLYPH_MAP: Record<string, string> = {
  а: 'a', // Cyrillic а
  е: 'e', // Cyrillic е
  о: 'o', // Cyrillic о
  с: 'c', // Cyrillic с
  р: 'p', // Cyrillic р
  х: 'x', // Cyrillic х
  у: 'y', // Cyrillic у
};

const GAZETTEER = new Set([
  'puerto', 'cabello', 'malecon', 'malecón', 'casco', 'historico', 'histórico',
  'quizandal', 'borburata', 'patanemo', 'isla', 'larga', 'guaricha', 'trompillo',
  'san', 'esteban', 'centro', 'marina', 'bahia', 'bahía', 'fuerte', 'castillo',
  'solitario', 'playa', 'costa', 'rio', 'río', 'montana', 'montaña', 'valle',
  'cerro', 'laguna', 'puente', 'avenida', 'calle', 'plaza', 'parque', 'iglesia',
  'museo', 'mercado', 'malecón', 'fortin', 'fortín', 'muelle', 'faro',
]);

const GENERIC_NOUNS = new Set([
  'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al',
  'y', 'e', 'o', 'u', 'que', 'con', 'por', 'para', 'en', 'a', 'es', 'son',
  'está', 'esta', 'estan', 'están', 'hay', 'tiene', 'tienen', 'cerca', 'junto',
  'frente', 'detras', 'detrás', 'despues', 'después', 'antes', 'abre', 'cierra',
  'abierto', 'cerrado', 'nueve', 'ocho', 'diez', 'once', 'mediodia', 'mediodía',
  'tarde', 'noche', 'manana', 'mañana', 'hoy', 'ayer', 'entrada', 'salida',
  'precio', 'precios', 'barato', 'caro', 'recomendado', 'famoso', 'popular',
  'sitio', 'lugar', 'sitios', 'lugares', 'calle', 'esquina', 'numero', 'número',
  'direccion', 'dirección', 'horario', 'horarios', 'cuando', 'donde', 'dónde',
  'como', 'cómo', 'cuanto', 'cuánto', 'cual', 'cuál', 'mas', 'más', 'menos',
  'muy', 'mucho', 'poco', 'bueno', 'buena', 'buen', 'malo', 'mala',
]);

/** Normalise for matching: NFKD → diacritic strip → lowercase → homoglyphs. */
export function normaliseForSweep(text: string): string {
  const nfkd = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  let out = '';
  for (const ch of nfkd.toLowerCase()) {
    out += HOMOGLYPH_MAP[ch] ?? ch;
  }
  return out;
}

/**
 * Sweep `text` for spans that look like named entities the catalog cannot
 * account for. Returns matched spans (original casing preserved).
 */
export function lexicalSweep(
  text: string,
  catalogNames: readonly string[],
): string[] {
  const hits: string[] = [];
  const norm = normaliseForSweep(text);

  // Catalog name tokens — everything they cover is allowed.
  const catalogTokens = new Set<string>();
  for (const name of catalogNames) {
    for (const tok of normaliseForSweep(name).split(/\s+/)) {
      if (tok.length > 2) catalogTokens.add(tok);
    }
  }

  // Quoted spans — always suspect unless fully covered by catalog tokens.
  const quoted = text.match(/"([^"]+)"/g) ?? [];
  for (const q of quoted) {
    const inner = normaliseForSweep(q.replace(/"/g, ''));
    const words = inner.split(/\s+/).filter((w) => w.length > 2);
    const uncovered = words.filter(
      (w) => !catalogTokens.has(w) && !GAZETTEER.has(w) && !GENERIC_NOUNS.has(w),
    );
    if (uncovered.length > 0) hits.push(q);
  }

  // Capitalised n-grams (2+ words) that are not fully covered.
  const capitalised = text.match(/\b([A-ZÁÉÍÓÚÑ][\wáéíóúñÁÉÍÓÚÑ]*\s+){1,}[A-ZÁÉÍÓÚÑ][\wáéíóúñÁÉÍÓÚÑ]*\b/g) ?? [];
  for (const span of capitalised) {
    const words = normaliseForSweep(span).split(/\s+/).filter((w) => w.length > 2);
    const covered = words.every(
      (w) => catalogTokens.has(w) || GAZETTEER.has(w) || GENERIC_NOUNS.has(w),
    );
    // "Café El Puerto" contains stop-words; require at least one real token
    // to be covered, and flag only spans with an uncovered proper-looking word.
    const hasProper = words.some(
      (w) => /^[A-Z]/.test(span.split(/\s+/)[words.indexOf(w)] ?? ''),
    );
    if (!covered && hasProper && !words.every((w) => GENERIC_NOUNS.has(w))) {
      hits.push(span);
    }
  }

  return [...new Set(hits)];
}
