export type BrailleCellPattern = [boolean, boolean, boolean, boolean, boolean, boolean];

// Dot positions:
// [1, 2,
//  3, 4,
//  5, 6]
//
// This is a minimal Grade 1 (uncontracted) mapping for demo purposes.

const DOT = true;
const _ = false;

export const BRAILLE_MAP: Record<string, BrailleCellPattern> = {
  // Letters a–j
  a: [DOT, _, _, _, _, _], // 1
  b: [DOT, DOT, _, _, _, _], // 1 2
  c: [DOT, _, DOT, _, _, _], // 1 3
  d: [DOT, _, DOT, DOT, _, _], // 1 3 4
  e: [DOT, _, _, DOT, _, _], // 1 4
  f: [DOT, DOT, DOT, _, _, _], // 1 2 3
  g: [DOT, DOT, DOT, DOT, _, _], // 1 2 3 4
  h: [DOT, DOT, _, DOT, _, _], // 1 2 4
  i: [_, DOT, DOT, _, _, _], // 2 3
  j: [_, DOT, DOT, DOT, _, _], // 2 3 4

  // k–t = a–j with dot 3 added
  k: [DOT, _, _, _, DOT, _],
  l: [DOT, DOT, _, _, DOT, _],
  m: [DOT, _, DOT, _, DOT, _],
  n: [DOT, _, DOT, DOT, DOT, _],
  o: [DOT, _, _, DOT, DOT, _],
  p: [DOT, DOT, DOT, _, DOT, _],
  q: [DOT, DOT, DOT, DOT, DOT, _],
  r: [DOT, DOT, _, DOT, DOT, _],
  s: [_, DOT, DOT, _, DOT, _],
  t: [_, DOT, DOT, DOT, DOT, _],

  // u–z = k–o with dot 6 added (except w)
  u: [DOT, _, _, _, DOT, DOT],
  v: [DOT, DOT, _, _, DOT, DOT],
  x: [DOT, _, DOT, _, DOT, DOT],
  y: [DOT, _, DOT, DOT, DOT, DOT],
  z: [DOT, _, _, DOT, DOT, DOT],

  // Special: w is an exception in English Braille
  w: [_, DOT, DOT, DOT, _, DOT],

  " ": [_, _, _, _, _, _],

  // Basic punctuation
  ".": [_, DOT, _, DOT, DOT, DOT],
  ",": [_, DOT, _, _, _, _],
  "?": [_, DOT, DOT, _, _, DOT],
  "!": [_, DOT, DOT, DOT, _, _],
  "-": [_, _, DOT, _, _, DOT],
  "'": [_, _, _, _, DOT, _],
  "\"": [_, DOT, _, _, DOT, DOT],

  // Number sign (⠼) and digits 0–9 (using a–j with number sign prefix)
  "#": [_, _, DOT, DOT, DOT, DOT],
};

const DIGIT_TO_LETTER: Record<string, string> = {
  "1": "a",
  "2": "b",
  "3": "c",
  "4": "d",
  "5": "e",
  "6": "f",
  "7": "g",
  "8": "h",
  "9": "i",
  "0": "j",
};

export function textToBrailleCells(text: string): BrailleCellPattern[] {
  const cells: BrailleCellPattern[] = [];
  let numericMode = false;

  for (const ch of text) {
    if (/[0-9]/.test(ch)) {
      if (!numericMode) {
        // Enter numeric mode with number sign
        cells.push(BRAILLE_MAP["#"]);
        numericMode = true;
      }
      const letter = DIGIT_TO_LETTER[ch];
      if (letter && BRAILLE_MAP[letter]) {
        cells.push(BRAILLE_MAP[letter]);
      }
      continue;
    }

    // Any non-digit leaves numeric mode
    numericMode = false;

    const lower = ch.toLowerCase();
    const pattern = BRAILLE_MAP[lower];
    if (pattern) {
      cells.push(pattern);
    } else {
      // Unknown character → blank cell
      cells.push(BRAILLE_MAP[" "]);
    }
  }

  return cells;
}

