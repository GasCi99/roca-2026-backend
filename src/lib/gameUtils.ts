
/**
 * Returns a seed that changes every Wednesday at 12:00 PM.
 * This is used to ensure all players see the same game each week.
 */
export function getWeeklySeed(): number {
  const now = new Date();
  
  // Calculate current Wednesday 12:00 PM
  const currentWeekWed = new Date(now);
  const day = now.getDay(); // 0 (Sun) to 6 (Sat)
  const diff = (day < 3 || (day === 3 && now.getHours() < 12)) ? (day + 4) : (day - 3);
  
  currentWeekWed.setDate(now.getDate() - diff);
  currentWeekWed.setHours(12, 0, 0, 0);

  // If today is Wednesday before 12:00, we actually want the previous Wednesday
  if (day === 3 && now.getHours() < 12) {
    // Already handled by diff calculation above? 
    // Let's re-verify: if day=3 (Wed) and hours < 12, diff = 3 + 4 = 7. 
    // Wed - 7 = Previous Wed. Correct.
    // If day=3 and hours >= 12, diff = 3 - 3 = 0. 
    // Wed - 0 = Current Wed. Correct.
  }

  // Return the timestamp of the start of the "game week"
  return currentWeekWed.getTime();
}

/**
 * Returns a stable random number between 0 and 1 for the current week.
 * You can pass an additional offset for multiple random values.
 */
export function getWeeklyRandom(seed: number, offset: number = 0): number {
  const x = Math.sin(seed + offset) * 10000;
  return x - Math.floor(x);
}

/**
 * Selects a stable item from an array based on the weekly seed.
 */
export function getWeeklyItem<T>(items: T[], seed: number, offset: number = 0): T {
  if (items.length === 0) return null as T;
  const index = Math.floor(getWeeklyRandom(seed, offset) * items.length);
  return items[index];
}
