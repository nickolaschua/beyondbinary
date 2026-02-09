"""Maps Hume AI's 48 prosody dimensions to simplified, user-friendly labels.

Hume returns emotions like "Concentration", "Contemplation", "Determination",
"Interest", etc. For our deaf user's captions, we simplify these into
intuitive tone labels that add social context.

The labels shown in brackets next to captions, like:
  "[Dr. Lee, speaking carefully]: Your blood sugar is a bit high."
"""

# Map Hume's 48 prosody labels to simplified descriptors
PROSODY_TO_LABEL = {
    # Positive / Warm
    "Joy": "happily",
    "Amusement": "with amusement",
    "Excitement": "excitedly",
    "Interest": "with interest",
    "Satisfaction": "with satisfaction",
    "Pride": "proudly",
    "Admiration": "admiringly",
    "Adoration": "warmly",
    "Love": "warmly",
    "Gratitude": "gratefully",
    "Relief": "with relief",
    "Triumph": "triumphantly",
    "Ecstasy": "excitedly",
    # Calm / Neutral
    "Calmness": "calmly",
    "Contemplation": "thoughtfully",
    "Concentration": "carefully",
    "Determination": "firmly",
    "Realization": "with realization",
    "Nostalgia": "wistfully",
    "Aesthetic Appreciation": "appreciatively",
    # Concern / Negative
    "Sadness": "sadly",
    "Disappointment": "with disappointment",
    "Distress": "with distress",
    "Anxiety": "anxiously",
    "Fear": "nervously",
    "Confusion": "uncertainly",
    "Doubt": "hesitantly",
    "Embarrassment": "hesitantly",
    "Shame": "quietly",
    "Guilt": "apologetically",
    "Awkwardness": "uncomfortably",
    # Strong Negative
    "Anger": "forcefully",
    "Contempt": "dismissively",
    "Disgust": "with displeasure",
    "Annoyance": "with irritation",
    # Empathic
    "Sympathy": "sympathetically",
    "Empathic Pain": "with concern",
    "Compassion": "compassionately",
    # Surprise
    "Surprise (positive)": "with pleasant surprise",
    "Surprise (negative)": "with alarm",
    "Awe": "in awe",
    # Other
    "Boredom": "flatly",
    "Tiredness": "wearily",
    "Pain": "with pain",
    "Craving": "eagerly",
    "Desire": "earnestly",
    "Entrancement": "intently",
    "Horror": "with horror",
}

# Simplified categories for the frontend tone badge
LABEL_TO_CATEGORY = {
    "happily": "positive",
    "with amusement": "positive",
    "excitedly": "positive",
    "with interest": "positive",
    "warmly": "positive",
    "gratefully": "positive",
    "calmly": "neutral",
    "thoughtfully": "neutral",
    "carefully": "neutral",
    "firmly": "neutral",
    "sadly": "negative",
    "with disappointment": "negative",
    "anxiously": "negative",
    "nervously": "negative",
    "forcefully": "negative",
    "with concern": "concern",
    "sympathetically": "concern",
    "compassionately": "concern",
}


def map_prosody_to_label(hume_emotion: str) -> str:
    """Convert a Hume prosody emotion name to a human-friendly label."""
    return PROSODY_TO_LABEL.get(hume_emotion, "speaking")


def get_tone_category(label: str) -> str:
    """Get simplified category (positive/neutral/negative/concern) for a tone label."""
    return LABEL_TO_CATEGORY.get(label, "neutral")
