const FILLER_PATTERNS = [
  /\buh+\b/gi,
  /\bum+\b/gi,
  /\ber+\b/gi,
  /\bah+\b/gi,
  /\blike\b/gi,
  /\byou\s+know\b/gi,
  /\bi\s+mean\b/gi,
  /\bso\b(?=,|\s)/gi,
  /\bwell\b(?=,|\s)/gi,
];

function removeFillerTokens(text: string) {
  let output = text;
  for (const pattern of FILLER_PATTERNS) {
    output = output.replace(pattern, " ");
  }
  return output;
}

function collapseRepeatedTokens(text: string) {
  return text.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
}

function normalizePunctuation(text: string) {
  return text
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,.!?;:]){2,}/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export function applyCleanupRules(text: string) {
  const noFillers = removeFillerTokens(text);
  const noRepeats = collapseRepeatedTokens(noFillers);
  return normalizePunctuation(noRepeats);
}
