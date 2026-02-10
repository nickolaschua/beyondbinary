/**
 * UEB (Unified English Braille) conversion for digital display.
 * Unicode braille U+2800–U+28FF. Mirrors backend/app/services/braille_ueb.py.
 */

const UEB_LETTERS = '\u2801\u2803\u2809\u2819\u2811\u280b\u281b\u2813\u280a\u281a' +
  '\u2805\u2807\u280d\u281d\u2815\u280f\u281f\u2817\u280e\u281e' +
  '\u2825\u2827\u283a\u282d\u283d\u2835';
const LETTER_MAP = {};
'abcdefghijklmnopqrstuvwxyz'.split('').forEach((c, i) => { LETTER_MAP[c] = UEB_LETTERS[i]; });

const UEB_NUM = '\u283c';
const DIGIT_MAP = {};
'1234567890'.split('').forEach((d, i) => { DIGIT_MAP[d] = UEB_LETTERS[i]; });

const PUNCT = {
  '.': '\u2832', ',': '\u2802', '?': '\u2826', '!': '\u2816',
  "'": '\u2804', '-': '\u2824', ':': '\u2812', ';': '\u2806',
  '"': '\u2836', '(': '\u2810\u2823', ')': '\u2810\u281c',
};
const CAP = '\u2820';
const SP = '\u2800';

const CELLS_PER_LINE = 40;

function charToBraille(c, afterCap, inNumber) {
  if (c === ' ') return [SP, false, false];
  if (LETTER_MAP[c] !== undefined) {
    let cell = LETTER_MAP[c];
    if (afterCap) cell = CAP + cell;
    return [cell, false, false];
  }
  if (PUNCT[c] !== undefined) return [PUNCT[c], false, false];
  if (/\d/.test(c)) {
    let out = inNumber ? '' : UEB_NUM;
    out += DIGIT_MAP[c];
    return [out, false, true];
  }
  if (c === c.toUpperCase() && c !== c.toLowerCase()) {
    return [CAP + LETTER_MAP[c.toLowerCase()], false, false];
  }
  const lower = c.toLowerCase();
  if (LETTER_MAP[lower] !== undefined) return [CAP + LETTER_MAP[lower], false, false];
  return [SP, false, false];
}

function textToBrailleCells(text) {
  const cells = [];
  let afterCap = false;
  let inNumber = false;
  for (let i = 0; i < text.length; i++) {
    const [part, nextCap, nextNum] = charToBraille(text[i], afterCap, inNumber);
    afterCap = nextCap;
    inNumber = nextNum;
    if (part) cells.push(part);
  }
  return cells;
}

function wrapBrailleLines(cells, cellsPerLine = CELLS_PER_LINE) {
  const lines = [];
  let current = [];
  let length = 0;
  for (const cell of cells) {
    const cellLen = 1;
    if (length + cellLen > cellsPerLine && current.length) {
      let lastSpace = -1;
      for (let i = 0; i < current.length; i++) {
        if (current[i] === SP) lastSpace = i;
      }
      if (lastSpace >= 0) {
        const before = current.slice(0, lastSpace + 1);
        const after = current.slice(lastSpace + 1);
        lines.push(before.join(''));
        current = after;
        length = after.length;
      } else {
        lines.push(current.join(''));
        current = [];
        length = 0;
      }
      if (cell !== SP) {
        current.push(cell);
        length += 1;
      }
      continue;
    }
    current.push(cell);
    length += cellLen;
  }
  if (current.length) lines.push(current.join(''));
  return lines;
}

/**
 * Convert plain text to braille display string (multiple lines, wrapped).
 * Preserves paragraph/line breaks.
 */
export function textToBrailleDisplay(text, cellsPerLine = CELLS_PER_LINE) {
  if (!text || !String(text).trim()) return '';
  const paragraphs = String(text).split('\n');
  const out = [];
  for (const para of paragraphs) {
    const cells = textToBrailleCells(para);
    const lines = wrapBrailleLines(cells, cellsPerLine);
    out.push(...lines, '');
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}
