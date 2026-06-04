/** Designated department head per dept code (payment, procurement, general, leave step 1). */
export const DESIGNATED_DEPT_HEAD_EMAILS: Partial<Record<string, string>> = {
  IT: 'jason.ishiimwe@rukapay.co.ug',
  HR: 'portia.nayebare@rukapay.co.ug',
  FIN: 'amara.oto@rukapay.co.ug',
  MKT: 'margaret.nassiwa@rukapay.co.ug',
  OPS: 'mutorine.silas@rukapay.co.ug',
  BD: 'norman.nowamani@rukapay.co.ug',
  CEO: 'gerald.naluja@rukapay.co.ug',
};

export function designatedDeptHeadEmail(deptCode: string | null | undefined): string | undefined {
  if (!deptCode) return undefined;
  return DESIGNATED_DEPT_HEAD_EMAILS[deptCode.toUpperCase()];
}
