/**
 * Number of calls an interviewer made before the interview was completed.
 *
 * From questionnaire version 2 this is a question (CALLS_VAR). In version 1 it did not exist, and some
 * supervisors typed it into their approval comment ("... And call attempt was 2."). This file reads the
 * number out of such comments so both versions report the same indicator.
 */

/** Questionnaire variable: "How many times did you call the firm before successful completion of interview" */
export const CALLS_VAR = "m6q04";
/** Values outside 1..CALLS_MAX are treated as typing errors and flagged, not reported. */
export const CALLS_MAX = 20;

const WORDS: Record<string, number> = {
  one: 1, once: 1, first: 1, two: 2, twice: 2, second: 2, three: 3, thrice: 3, third: 3, four: 4, fourth: 4,
  five: 5, fifth: 5, six: 6, sixth: 6, seven: 7, seventh: 7, eight: 8, eighth: 8, nine: 9, ninth: 9, ten: 10, tenth: 10,
};
const CARD = "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)";
const ORD = "(\\d{1,2}(?:st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)";

/** Tried in order; group 1 holds the number. Vague wording ("more than 5 times", "several") never matches. */
const PATTERNS: RegExp[] = [
  // "call attempt was 2", "call attempts: 3", "Call attempt 1", "attempts = 2", "number of calls was 3"
  new RegExp(`\\b(?:call(?:ing)?s?[\\s-]*)?attempts?(?:\\s+made)?\\s*(?:was|were|is|are|[:=–-])?\\s*${CARD}\\b(?!\\s*(?:st|nd|rd|th|%|:|\\.\\d|am|pm))`, "i"),
  new RegExp(`\\b(?:number|no\\.?)\\s+of\\s+calls?(?:\\s+made)?\\s*(?:was|were|is|are|[:=–-])?\\s*${CARD}\\b`, "i"),
  // "2 call attempts", "3 attempts", "2 calls were made"
  new RegExp(`\\b${CARD}\\s+(?:call(?:ing)?[\\s-]*)?attempts?\\b`, "i"),
  new RegExp(`\\b${CARD}\\s+calls?\\s+(?:was|were)?\\s*made\\b`, "i"),
  // "on the 3rd attempt", "answered at the second call attempt" (a bare "first attempt failed" is not a total)
  new RegExp(`\\b(?:on|at|in|after)\\s+(?:the|my|our)\\s+${ORD}\\s+(?:call(?:ing)?[\\s-]*)?(?:attempt|call|try)\\b`, "i"),
  // "called 3 times", "called the firm twice", "called once"
  new RegExp(`\\bcalled\\s+(?:the\\s+\\w+\\s+|them\\s+|him\\s+|her\\s+)?(?:${CARD}\\s+times|(once|twice|thrice))\\b`, "i"),
];

function toNumber(tok: string): number | null {
  const t = tok.toLowerCase().replace(/(st|nd|rd|th)$/, "");
  const n = /^\d+$/.test(t) ? Number(t) : WORDS[tok.toLowerCase()] ?? null;
  return n !== null && n >= 1 && n <= CALLS_MAX ? n : null;
}

/** Call attempts stated in one comment, or null when the comment does not give an exact number. */
export function callsFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  // an inexact count must not be read as an exact one
  if (/\b(more than|over|at least|about|around|several|many|countless)\b[^.;]*\b(times|attempts?|calls?)\b/i.test(text)) return null;
  for (const re of PATTERNS) {
    const m = text.match(re);
    const tok = m?.[1] ?? m?.[2];
    if (tok) {
      const n = toNumber(tok);
      if (n !== null) return n;
    }
  }
  return null;
}

/**
 * The call count for an interview from its comment thread: the most recent comment that states one.
 * Supervisors' comments win over interviewers' when both give a number (they listened to the audio).
 */
export function callsFromComments(comments: { role: number; text: string; order?: number }[]): number | null {
  const found = comments
    .map((c, k) => ({ n: callsFromText(c.text), sup: c.role === 2 ? 1 : 0, k: c.order ?? k }))
    .filter((c): c is { n: number; sup: number; k: number } => c.n !== null)
    .sort((a, b) => b.sup - a.sup || b.k - a.k);
  return found.length ? found[0].n : null;
}
