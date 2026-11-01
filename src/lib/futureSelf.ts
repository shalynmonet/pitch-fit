// Picks which 3 ages from an AI Aging Simulation series to show by default:
// closest to the estimated current age, closest to +10 years, closest to +25 years.

export function pickDefaultAges(ages: number[], estimatedAge: number, ageMax: number): number[] {
  const closestTo = (target: number) =>
    ages.reduce((best, a) => (Math.abs(a - target) < Math.abs(best - target) ? a : best));

  const targets = [estimatedAge, Math.min(estimatedAge + 10, ageMax), Math.min(estimatedAge + 25, ageMax)];
  const picks: number[] = [];

  for (const target of targets) {
    const candidate = closestTo(target);
    if (!picks.includes(candidate)) {
      picks.push(candidate);
      continue;
    }
    const unused = ages
      .filter((a) => !picks.includes(a))
      .sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
    if (unused.length > 0) picks.push(unused[0]);
  }

  return picks;
}
