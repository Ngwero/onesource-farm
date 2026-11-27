/** System admin — used for admin identity checks, not as a hardcoded IT approver. */
export const ADMIN_EMAIL = 'emmanuel.ngwero@onesourcefresh.com';

/**
 * Designated IT memo checkers — cleared for reassignment.
 * Assign via Admin → Users with roles it_checker_first / it_checker_second.
 */
export const IT_FIRST_CHECKER_EMAIL: string = '';
export const IT_SECOND_CHECKER_EMAIL: string = '';

export function isDesignatedItFirstChecker(
  user: { email?: string } | null | undefined
): boolean {
  if (!IT_FIRST_CHECKER_EMAIL || !user?.email) return false;
  return user.email.toLowerCase() === IT_FIRST_CHECKER_EMAIL.toLowerCase();
}
