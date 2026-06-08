/** System admin (Emmanuel) — also acts as 1st IT checker while keeping the admin role. */
export const ADMIN_EMAIL = 'emmanuel.ngwero@rukapay.co.ug';

/** Designated IT memo checkers (order matters). 1st checker may be admin (single role in DB). */
export const IT_FIRST_CHECKER_EMAIL = ADMIN_EMAIL;
export const IT_SECOND_CHECKER_EMAIL = 'jim.ntare@rukapay.co.ug';

export function isDesignatedItFirstChecker(
  user: { email?: string } | null | undefined
): boolean {
  return Boolean(user?.email?.toLowerCase() === IT_FIRST_CHECKER_EMAIL.toLowerCase());
}
