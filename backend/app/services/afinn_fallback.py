"""Zero-dependency text sentiment fallback using AFINN-165 lexicon.

Used when Hume AI is slow or down. Maps transcript text to simple tone labels
based on word sentiment scores.
"""

# Simplified AFINN word scores (just the most impactful words)
AFINN = {
    "good": 3,
    "great": 3,
    "excellent": 3,
    "happy": 3,
    "love": 3,
    "wonderful": 3,
    "fantastic": 3,
    "amazing": 3,
    "perfect": 3,
    "bad": -3,
    "terrible": -3,
    "awful": -3,
    "horrible": -3,
    "hate": -3,
    "worried": -2,
    "concerned": -2,
    "serious": -2,
    "unfortunately": -2,
    "pain": -2,
    "hurt": -2,
    "problem": -2,
    "risk": -2,
    "danger": -3,
    "sorry": -1,
    "difficult": -1,
    "hard": -1,
    "ok": 1,
    "fine": 1,
    "well": 1,
    "better": 2,
    "improve": 2,
    "thank": 2,
    "please": 1,
    "help": 1,
    "not": 0,
}


def analyze_text_sentiment(text: str) -> dict:
    """
    Analyze text sentiment using AFINN word scores.
    Fallback when Hume AI is unavailable.

    Returns:
        dict with primary_tone, tone_category, confidence
    """
    words = text.lower().split()
    score = 0
    negation = False
    for word in words:
        # Remove punctuation
        clean_word = word.strip('.,!?;:\'"')

        if clean_word in ("not", "no", "never", "don't", "doesn't", "isn't", "won't"):
            negation = True
            continue
        if clean_word in AFINN:
            s = AFINN[clean_word]
            if negation:
                s = -s
                negation = False
            score += s
        else:
            negation = False

    if score >= 2:
        return {"primary_tone": "positively", "tone_category": "positive", "confidence": 0.6}
    elif score <= -2:
        return {"primary_tone": "with concern", "tone_category": "negative", "confidence": 0.6}
    else:
        return {"primary_tone": "speaking", "tone_category": "neutral", "confidence": 0.5}
