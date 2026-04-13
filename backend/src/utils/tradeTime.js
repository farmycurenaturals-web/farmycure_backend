const { DateTime } = require('luxon');

/** Canonical keys (en-dash, matches user form). Values: [startHour, endHour] local wall clock in user's TZ. */
const TIME_SLOTS = {
  'Morning (9 AM – 12 PM)': [9, 12],
  'Afternoon (12 PM – 4 PM)': [12, 16],
  'Evening (4 PM – 8 PM)': [16, 20],
  'Night (8 PM – 11 PM)': [20, 23],
};

/** Normalize legacy or copy-paste variants to a canonical key */
const normalizePreferredTime = (preferredTime) => {
  const raw = String(preferredTime || '').trim();
  if (!raw) return null;
  if (TIME_SLOTS[raw]) return raw;
  const hyphen = raw.replace(/–/g, '-').replace(/\s+/g, ' ');
  const candidates = Object.keys(TIME_SLOTS);
  const found = candidates.find((k) => k.replace(/–/g, '-').replace(/\s+/g, ' ') === hyphen);
  return found || null;
};

/**
 * @returns {{ start: string, end: string, outsideBusinessHours: boolean } | null}
 */
const buildConvertedTimeIST = (timezone, preferredTime) => {
  const canonical = normalizePreferredTime(preferredTime);
  const hours = canonical ? TIME_SLOTS[canonical] : null;
  if (!hours) return null;

  const [startHour, endHour] = hours;
  const zone = String(timezone || 'Asia/Kolkata').trim() || 'Asia/Kolkata';

  let userStart;
  let userEnd;
  try {
    const base = DateTime.now().setZone(zone);
    userStart = base.set({ hour: startHour, minute: 0, second: 0, millisecond: 0 });
    userEnd = base.set({ hour: endHour, minute: 0, second: 0, millisecond: 0 });
    if (!userStart.isValid || !userEnd.isValid) return null;
  } catch {
    return null;
  }

  const istStart = userStart.setZone('Asia/Kolkata');
  const istEnd = userEnd.setZone('Asia/Kolkata');

  const outsideBusinessHours = istStart.hour < 6;

  return {
    start: istStart.toFormat('hh:mm a'),
    end: istEnd.toFormat('hh:mm a'),
    outsideBusinessHours,
  };
};

module.exports = {
  TIME_SLOTS,
  normalizePreferredTime,
  buildConvertedTimeIST,
};
