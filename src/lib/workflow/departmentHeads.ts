/** Designated department head per dept code (payment, procurement, general, leave step 1). */
export const DESIGNATED_DEPT_HEAD_EMAILS: Partial<Record<string, string>> = {
  IT: 'jason.ishiimwe@onesourcefresh.com',
  HR: 'portia.nayebare@onesourcefresh.com',
  FIN: 'amara.oto@onesourcefresh.com',
  MKT: 'margaret.nassiwa@onesourcefresh.com',
  OPS: 'emmanuel.ngwero@onesourcefresh.com',
  BD: 'norman.nowamani@onesourcefresh.com',
  CEO: 'gerald.naluja@onesourcefresh.com',
};

export function designatedDeptHeadEmail(deptCode: string | null | undefined): string | undefined {
  if (!deptCode) return undefined;
  return DESIGNATED_DEPT_HEAD_EMAILS[deptCode.toUpperCase()];
}
