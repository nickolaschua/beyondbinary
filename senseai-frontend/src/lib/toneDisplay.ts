/**
 * Maps backend tone/emotion labels to display label + emoji (same as video-call-poc test site).
 * Covers Hume prosody labels and common variations.
 */
const TONE_TO_DISPLAY: Record<string, { label: string; emoji: string }> = {
  calmly: { label: "Calm", emoji: "🙂" },
  thoughtfully: { label: "Thoughtful", emoji: "🙂" },
  carefully: { label: "Careful", emoji: "🙂" },
  firmly: { label: "Firm", emoji: "🙂" },
  "with concern": { label: "Concerned", emoji: "😟" },
  sympathetically: { label: "Sympathetic", emoji: "😟" },
  compassionately: { label: "Compassionate", emoji: "😟" },
  anxiously: { label: "Anxious", emoji: "😰" },
  nervously: { label: "Nervous", emoji: "😰" },
  forcefully: { label: "Frustrated", emoji: "😠" },
  "with irritation": { label: "Irritated", emoji: "😠" },
  angrily: { label: "Angry", emoji: "😠" },
  happily: { label: "Happy", emoji: "😊" },
  "with amusement": { label: "Amused", emoji: "😊" },
  excitedly: { label: "Excited", emoji: "😊" },
  "with interest": { label: "Interested", emoji: "🙂" },
  positively: { label: "Positive", emoji: "😊" },
  warmly: { label: "Warm", emoji: "😊" },
  gratefully: { label: "Grateful", emoji: "😊" },
  speaking: { label: "Speaking", emoji: "🙂" },
  sadly: { label: "Sad", emoji: "😢" },
  "with disappointment": { label: "Disappointed", emoji: "😢" },
  neutrally: { label: "Neutral", emoji: "😐" },
  neutral: { label: "Neutral", emoji: "😐" },
  uncomfortably: { label: "Awkward", emoji: "😅" },
  // Hume prosody / emotion names
  determination: { label: "Determination", emoji: "💪" },
  interest: { label: "Interested", emoji: "🙂" },
  confusion: { label: "Confused", emoji: "😕" },
  disappointment: { label: "Disappointed", emoji: "😢" },
  sadness: { label: "Sad", emoji: "😢" },
  tiredness: { label: "Tired", emoji: "😴" },
  boredom: { label: "Bored", emoji: "😐" },
  calmness: { label: "Calm", emoji: "🙂" },
  relief: { label: "Relief", emoji: "😌" },
  doubt: { label: "Doubt", emoji: "🤔" },
  distress: { label: "Distress", emoji: "😰" },
  anxiety: { label: "Anxious", emoji: "😰" },
  awkwardness: { label: "Awkward", emoji: "😅" },
  anger: { label: "Angry", emoji: "😠" },
  amusement: { label: "Amused", emoji: "😊" },
  // tone_mapper-style labels (from backend)
  flatly: { label: "Flat", emoji: "😐" },
  wearily: { label: "Tired", emoji: "😴" },
  hesitantly: { label: "Hesitant", emoji: "🤔" },
  uncertainly: { label: "Uncertain", emoji: "😕" },
  wistfully: { label: "Wistful", emoji: "🙂" },
  appreciatively: { label: "Appreciative", emoji: "😊" },
  dismissively: { label: "Dismissive", emoji: "😐" },
  "with displeasure": { label: "Displeased", emoji: "😠" },
  "with relief": { label: "Relief", emoji: "😌" },
  "with satisfaction": { label: "Satisfied", emoji: "😊" },
  triumphantly: { label: "Triumphant", emoji: "😊" },
  admiringly: { label: "Admiring", emoji: "😊" },
  proudly: { label: "Proud", emoji: "😊" },
  "with distress": { label: "Distress", emoji: "😰" },
  quietly: { label: "Quiet", emoji: "🙂" },
  apologetically: { label: "Apologetic", emoji: "🙂" },
  firmly: { label: "Firm", emoji: "🙂" },
}

export function getToneDisplay(toneLabel: string | null | undefined): { label: string; emoji: string } {
  if (toneLabel == null || typeof toneLabel !== "string") return { label: "—", emoji: "…" };
  const key = toneLabel.toLowerCase().trim();
  return TONE_TO_DISPLAY[key] ?? { label: toneLabel, emoji: "🙂" };
}
