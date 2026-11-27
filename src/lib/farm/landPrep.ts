/** Activity type codes used for land preparation (before planting). */
export const LAND_PREP_TYPE_CODES = [
  'LAND_PREP',
  'CLEARING',
  'TILLAGE',
  'BED_PREP',
  'RIDGING',
  'SOIL_WORK',
] as const;

export type LandPrepTypeCode = (typeof LAND_PREP_TYPE_CODES)[number];

export function isLandPrepTypeCode(code: string | null | undefined): boolean {
  return Boolean(code && (LAND_PREP_TYPE_CODES as readonly string[]).includes(code));
}
