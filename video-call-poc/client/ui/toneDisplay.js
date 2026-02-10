// Maps backend tone labels to display label + emoji for Live Captions UI

const TONE_TO_DISPLAY = {
  calmly: { label: 'Calm', emoji: '🙂' },
  thoughtfully: { label: 'Thoughtful', emoji: '🙂' },
  carefully: { label: 'Careful', emoji: '🙂' },
  firmly: { label: 'Firm', emoji: '🙂' },
  'with concern': { label: 'Concerned', emoji: '😟' },
  sympathetically: { label: 'Sympathetic', emoji: '😟' },
  compassionately: { label: 'Compassionate', emoji: '😟' },
  anxiously: { label: 'Anxious', emoji: '😰' },
  nervously: { label: 'Nervous', emoji: '😰' },
  forcefully: { label: 'Frustrated', emoji: '😠' },
  'with irritation': { label: 'Irritated', emoji: '😠' },
  angrily: { label: 'Angry', emoji: '😠' },
  happily: { label: 'Happy', emoji: '😊' },
  'with amusement': { label: 'Amused', emoji: '😊' },
  excitedly: { label: 'Excited', emoji: '😊' },
  'with interest': { label: 'Interested', emoji: '🙂' },
  positively: { label: 'Positive', emoji: '😊' },
  warmly: { label: 'Warm', emoji: '😊' },
  gratefully: { label: 'Grateful', emoji: '😊' },
  speaking: { label: 'Speaking', emoji: '🙂' },
  sadly: { label: 'Sad', emoji: '😢' },
  'with disappointment': { label: 'Disappointed', emoji: '😢' },
  neutrally: { label: 'Neutral', emoji: '😐' },
  neutral: { label: 'Neutral', emoji: '😐' },
  uncomfortably: { label: 'Awkward', emoji: '😅' },
};

export function getToneDisplay(toneLabel) {
  if (!toneLabel || typeof toneLabel !== 'string') {
    return { label: '—', emoji: '…' };
  }
  const key = toneLabel.toLowerCase().trim();
  return TONE_TO_DISPLAY[key] ?? { label: toneLabel, emoji: '🙂' };
}
