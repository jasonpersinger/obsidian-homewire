// Moon phase from the mean synodic month; accurate to within a few percent.

const SYNODIC_DAYS = 29.530588853;
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const NAMES = [
  "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
  "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent",
];

export function moonPhase(at: Date): { name: string; illumination: number; waxing: boolean } {
  const days = (at.getTime() - REFERENCE_NEW_MOON) / 86_400_000;
  const age = ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
  const fraction = age / SYNODIC_DAYS;
  return {
    name: NAMES[Math.round(fraction * 8) % 8]!,
    illumination: (1 - Math.cos(2 * Math.PI * fraction)) / 2,
    waxing: fraction < 0.5,
  };
}
