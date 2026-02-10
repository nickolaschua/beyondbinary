"""
UEB (Unified English Braille) translation for digital braille display mockup.
Uses Unicode braille patterns (U+2800–U+28FF). No physical hardware.
"""

# UEB base letters a–z (Unicode braille U+2801 etc.)
_BASE = "abcdefghijklmnopqrstuvwxyz"
_UEB_LETTERS = (
    "\u2801\u2803\u2809\u2819\u2811\u280b\u281b\u2813\u280a\u281a"  # a-j
    "\u2805\u2807\u280d\u281d\u2815\u280f\u281f\u2817\u280e\u281e"  # k-t
    "\u2825\u2827\u283a\u282d\u283d\u2835"  # u-z
)
_LETTER_MAP = dict(zip(_BASE, _UEB_LETTERS))

# Number indicator and digits 1–9, 0 (a–j in number mode)
_UEB_NUM = "\u283c"  # ⠼
_UEB_DIGITS = _UEB_LETTERS[:10]  # a=1,b=2,...,j=0
_DIGIT_MAP = {str(d): _UEB_DIGITS[i] for i, d in enumerate("1234567890")}

# Punctuation (UEB)
_PUNCT = {
    ".": "\u2832",  # ⠲
    ",": "\u2802",  # ⠂
    "?": "\u2826",  # ⠦
    "!": "\u2816",  # ⠖
    "'": "\u2804",  # ⠄
    "-": "\u2824",  # ⠤
    ":": "\u2812",  # ⠒
    ";": "\u2806",  # ⠆
    '"': "\u2836",  # ⠶
    "(": "\u2810\u2823",  # ⠐⠣
    ")": "\u2810\u281c",  # ⠐⠜
}
# Capital indicator
_CAP = "\u2820"  # ⠠
_SP = "\u2800"   # ⠀ (braille space)

# Default display width (braille cells per line)
DEFAULT_CELLS_PER_LINE = 40


def _char_to_braille(c: str, *, after_cap: bool, in_number: bool) -> tuple[str, bool, bool]:
    """
    Convert one ASCII character to braille.
    Returns (braille_cell(s), next_after_cap, next_in_number).
    """
    if c == " ":
        return (_SP, False, False)
    if c in _LETTER_MAP:
        cell = _LETTER_MAP[c]
        if after_cap:
            cell = _CAP + cell
        return (cell, False, False)
    if c in _PUNCT:
        return (_PUNCT[c], False, False)
    if c.isdigit():
        out = ""
        if not in_number:
            out = _UEB_NUM
            in_number = True
        out += _DIGIT_MAP[c]
        return (out, False, True)
    if c.isupper():
        return (_CAP + _LETTER_MAP[c.lower()], False, False)
    # Unsupported: spell out (e.g. symbol as letters or skip); here we spell unknown as-is by mapping to letter if possible
    if c.lower() in _LETTER_MAP:
        return (_CAP + _LETTER_MAP[c.lower()], False, False)
    # True unknown: output as space or single cell; UEB says spell out — use space as placeholder for "unsupported"
    return (_SP, False, False)


def text_to_braille_cells(text: str) -> list[str]:
    """
    Convert plain text to a flat list of braille cells (strings of one or more
    Unicode braille chars per logical cell). Preserves spaces and structure
    for later line-breaking.
    """
    cells: list[str] = []
    after_cap = False
    in_number = False
    for c in text:
        part, after_cap, in_number = _char_to_braille(c, after_cap=after_cap, in_number=in_number)
        if part:
            cells.append(part)
    return cells


def wrap_braille_lines(cells: list[str], cells_per_line: int = DEFAULT_CELLS_PER_LINE) -> list[str]:
    """
    Wrap a list of braille cells into lines of at most cells_per_line.
    Break only at space cells to avoid mid-word breaks.
    """
    lines: list[str] = []
    current: list[str] = []
    length = 0
    for cell in cells:
        cell_len = 1
        if length + cell_len > cells_per_line and current:
            # Find last space to break at
            last_space = -1
            pos = 0
            for i, c in enumerate(current):
                pos += 1
                if c == _SP:
                    last_space = i
            if last_space >= 0:
                before = current[: last_space + 1]
                after = current[last_space + 1 :]
                lines.append("".join(before))
                current = after
                length = sum(1 for _ in after)
            else:
                lines.append("".join(current))
                current = []
                length = 0
            if cell != _SP:
                current.append(cell)
                length += 1
            continue
        current.append(cell)
        length += cell_len
    if current:
        lines.append("".join(current))
    return lines


def paragraphs_to_braille_display(
    text: str,
    cells_per_line: int = DEFAULT_CELLS_PER_LINE,
) -> str:
    """
    Convert full text to braille display: preserve paragraph and line breaks,
    wrap each paragraph to cells_per_line.
    """
    display_lines: list[str] = []
    # Split by newlines to preserve structure
    paragraphs = text.split("\n")
    for para in paragraphs:
        cells = text_to_braille_cells(para)
        lines = wrap_braille_lines(cells, cells_per_line)
        display_lines.extend(lines)
        # Blank line between paragraphs (one empty braille line)
        display_lines.append("")
    # Trim trailing blank from last paragraph
    while display_lines and display_lines[-1] == "":
        display_lines.pop()
    return "\n".join(display_lines)


def format_display_output(original: str, cells_per_line: int = DEFAULT_CELLS_PER_LINE) -> str:
    """
    Produce the exact [ORIGINAL TEXT] / [DIGITAL BRAILLE DISPLAY] output.
    """
    braille = paragraphs_to_braille_display(original, cells_per_line)
    return f"[ORIGINAL TEXT]\n{original}\n\n[DIGITAL BRAILLE DISPLAY]\n{braille}"
