#!/usr/bin/env python3
"""
Braille display CLI. Reads stdin or first arg, outputs [ORIGINAL TEXT] and [DIGITAL BRAILLE DISPLAY].
Usage: python braille_display.py "Hello World"
       echo "Hello World" | python braille_display.py
"""
import sys
from app.services.braille_ueb import format_display_output

def main():
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
    else:
        text = sys.stdin.read()
    if not text.strip():
        return
    print(format_display_output(text.strip()))

if __name__ == "__main__":
    main()
