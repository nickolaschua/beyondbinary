"""Tone sample storage and aggregation for utterance-tone mapping.

Stores time-stamped tone samples from ProsodyBuffer. When an utterance
finalizes, aggregates overlapping samples to select a dominant emotion.
"""

from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

@dataclass
class ToneSample:
    """A tone analysis result with time bounds."""

    start_time: float
    end_time: float
    emotion: str
    confidence: float


# Bounded buffer: keep samples from last N seconds
TONE_SAMPLE_RETENTION_SECONDS = 10.0


class ToneAggregator:
    """
    Stores ToneSamples and aggregates them for a given utterance time range.
    """

    def __init__(self):
        self._samples: list[ToneSample] = []

    def add_sample(self, sample: ToneSample) -> None:
        """Add a tone sample. Evicts samples outside retention window."""
        self._samples.append(sample)
        cutoff = sample.end_time - TONE_SAMPLE_RETENTION_SECONDS
        self._samples = [s for s in self._samples if s.end_time > cutoff]

    def aggregate_for_utterance(
        self,
        utterance_start: float,
        utterance_end: float,
        min_overlap_ratio: float = 0.3,
        min_confidence: float = 0.3,
    ) -> Optional[dict]:
        """
        Select dominant emotion from samples overlapping the utterance time range.

        Args:
            utterance_start: Utterance start time (wall-clock)
            utterance_end: Utterance end time (wall-clock)
            min_overlap_ratio: Require at least this fraction of utterance covered
            min_confidence: Below this, return neutral

        Returns:
            dict with label, confidence, source="audio" or None if no overlap
        """
        utterance_duration = utterance_end - utterance_start
        if utterance_duration <= 0:
            return None

        overlapping: list[tuple[ToneSample, float]] = []
        for s in self._samples:
            overlap_start = max(s.start_time, utterance_start)
            overlap_end = min(s.end_time, utterance_end)
            if overlap_end > overlap_start:
                overlap_duration = overlap_end - overlap_start
                overlapping.append((s, overlap_duration))

        if not overlapping:
            return {"label": "neutral", "confidence": 0.0, "source": "audio"}

        total_overlap = sum(d for _, d in overlapping)
        if total_overlap < utterance_duration * min_overlap_ratio:
            return {"label": "neutral", "confidence": 0.0, "source": "audio"}

        # Confidence-weighted sum per label
        weighted: dict[str, float] = defaultdict(float)
        for sample, duration in overlapping:
            weighted[sample.emotion] += sample.confidence * duration

        if not weighted:
            return {"label": "neutral", "confidence": 0.0, "source": "audio"}

        best_label = max(weighted, key=weighted.get)
        total_weight = sum(weighted.values())
        avg_confidence = total_weight / total_overlap if total_overlap > 0 else 0

        if avg_confidence < min_confidence:
            return {"label": "neutral", "confidence": 0.0, "source": "audio"}

        return {
            "label": best_label,
            "confidence": round(min(avg_confidence, 1.0), 3),
            "source": "audio",
        }
