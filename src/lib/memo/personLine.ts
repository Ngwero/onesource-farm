/** Single source of truth for memo From / Thru / To display strings. */

export type MemoPersonRecord = {
  id: string;
  full_name: string;
  email: string;
  title?: string | null;
  department?: string | null;
  role_name?: string | null;
  role_slug?: string | null;
};

export type MemoPersonLineStyle = 'from' | 'routing';

/** From line for the signed-in user (memo sender). */
export function memoFromLineForUser(user: {
  id: string;
  full_name: string;
  email: string;
  title?: string | null;
  department?: { name: string } | null;
}): string {
  return formatMemoFromLine({
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    title: user.title,
    department: user.department?.name ?? null,
  });
}

/**
 * Approver line for workflow timeline / lists: full name and department code (e.g. "Jane Doe | FIN").
 * Shows "You | FIN" when the viewer is the assignee.
 */
export function formatNameWithDepartmentCode(
  fullName: string | null | undefined,
  departmentCode: string | null | undefined,
  options?: { userId?: string; viewingUserId?: string }
): string | undefined {
  const code = departmentCode?.trim();
  const suffix = code ? ` | ${code}` : '';

  if (options?.viewingUserId && options?.userId && options.userId === options.viewingUserId) {
    return `You${suffix}`;
  }

  const name = fullName?.trim();
  if (!name) return code || undefined;
  return `${name}${suffix}`;
}

/** "Jane Doe | Finance" — used for From */
export function formatMemoFromLine(person: MemoPersonRecord): string {
  const name = person.full_name.trim();
  const dept = person.department?.trim();
  if (dept) return `${name} | ${dept}`;
  return name;
}

/** "Department Head — Jane Doe" — used for Thru / To */
export function formatMemoRoutingLine(person: MemoPersonRecord): string {
  const name = person.full_name.trim();
  const role = person.role_name?.trim() || person.title?.trim();
  if (role) return `${role} — ${name}`;
  const dept = person.department?.trim();
  if (dept) return `${dept} — ${name}`;
  return name;
}

export function formatMemoPersonLine(
  person: MemoPersonRecord,
  style: MemoPersonLineStyle
): string {
  return style === 'from' ? formatMemoFromLine(person) : formatMemoRoutingLine(person);
}

export type MemoPersonOption = MemoPersonRecord & {
  displayLine: string;
  searchText: string;
};

export function toMemoPersonOption(
  row: {
    id: string;
    full_name: string;
    email: string;
    title?: string | null;
    departments?: { name: string } | { name: string }[] | null;
    roles?: { name: string; slug: string } | { name: string; slug: string }[] | null;
  },
  style: MemoPersonLineStyle
): MemoPersonOption {
  const dept = Array.isArray(row.departments) ? row.departments[0]?.name : row.departments?.name;
  const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;

  const person: MemoPersonRecord = {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    title: row.title,
    department: dept ?? null,
    role_name: role?.name ?? null,
    role_slug: role?.slug ?? null,
  };

  const displayLine = formatMemoPersonLine(person, style);
  const searchText = [person.full_name, person.email, person.department, person.role_name, person.title]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return { ...person, displayLine, searchText };
}

/** Match saved memo text back to a directory entry when editing. */
export function findPersonByDisplayLine(
  people: MemoPersonOption[],
  line: string
): MemoPersonOption | undefined {
  const normalized = line.trim().toLowerCase();
  if (!normalized) return undefined;
  return people.find(
    (p) =>
      p.displayLine.toLowerCase() === normalized ||
      p.full_name.toLowerCase() === normalized
  );
}

export function getPeopleForStyle(
  directory: { from: MemoPersonOption[]; routing: MemoPersonOption[] },
  style: MemoPersonLineStyle
): MemoPersonOption[] {
  return style === 'from' ? directory.from : directory.routing;
}
