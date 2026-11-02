const TOUR_KEY_PREFIX = 'onesource_tour_completed_';

export function isTourCompleted(userId: string): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(`${TOUR_KEY_PREFIX}${userId}`) === '1';
}

export function markTourCompleted(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${TOUR_KEY_PREFIX}${userId}`, '1');
}

export function clearTourCompleted(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${TOUR_KEY_PREFIX}${userId}`);
}

export const TOUR_START_EVENT = 'onesource-start-tour';

export function requestTourStart(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
}
