/** Optional designated department heads by code — empty until assigned. */
export const DESIGNATED_DEPT_HEAD_EMAILS: Partial<Record<string, string>> = {};

export function designatedHeadEmailForDept(deptCode: string): string | undefined {
  return DESIGNATED_DEPT_HEAD_EMAILS[deptCode.toUpperCase()];
}
