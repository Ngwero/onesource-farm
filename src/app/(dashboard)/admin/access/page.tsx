'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Lock, Pencil, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyRow, ErrorState, LoadingRows } from '@/components/farm/DataStates';
import { RequirePermission } from '@/components/farm/RequirePermission';
import { farmKeys } from '@/hooks/farm';
import { useFarmAccess } from '@/hooks/useFarmAccess';
import { useActionMutation } from '@/hooks/useFormMutation';
import { errorMessage, farmFetch } from '@/lib/farm/client';
import { optionLabel } from '@/lib/farm/schemas';
import { cn } from '@/lib/utils';

type RoleRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permission_keys: string[];
  user_count: number;
};
type PermissionRow = { key: string; module: string; description: string | null; sort_order: number };
type RolesResponse = { roles: RoleRow[]; permissions: PermissionRow[] };
type AccessUser = {
  id: string;
  email: string;
  full_name: string;
  title: string | null;
  is_active: boolean;
  ememo_role: { name: string; slug: string } | null;
  department: string | null;
  role_ids: string[];
};

const PROTECTED_ROLE = 'system_admin';

function useRoles() {
  return useQuery({
    queryKey: farmKeys.roles,
    queryFn: () => farmFetch<RolesResponse>('/api/farm/roles'),
  });
}

function sameSet(a: Set<string>, b: string[]) {
  return a.size === b.length && b.every((x) => a.has(x));
}

function UserRolesDialog({
  user,
  roles,
  onOpenChange,
}: {
  user: AccessUser;
  roles: RoleRow[];
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState(() => new Set(user.role_ids));
  const save = useActionMutation(
    () => farmFetch(`/api/farm/user-roles/${user.id}`, { method: 'PUT', body: { role_ids: [...selected] } }),
    {
      success: `Roles updated for ${user.full_name}`,
      invalidate: [farmKeys.userRoles, farmKeys.roles, ['farm', 'me']],
      onDone: () => onOpenChange(false),
    }
  );

  return (
    <Dialog open onOpenChange={(v) => !save.isPending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Farm roles for {user.full_name}</DialogTitle>
          <DialogDescription>
            Farm roles control what this person can see and do in the farm modules. Their eMemo role
            {user.ememo_role ? ` (${user.ememo_role.name})` : ''} is managed separately under Users.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
          {roles.map((r) => (
            <label
              key={r.id}
              className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
            >
              <Checkbox
                className="mt-0.5"
                checked={selected.has(r.id)}
                disabled={save.isPending}
                onCheckedChange={(v) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (v === true) next.add(r.id);
                    else next.delete(r.id);
                    return next;
                  })
                }
              />
              <span>
                <span className="text-sm font-medium">{r.name}</span>
                {r.description ? <span className="block text-xs text-muted-foreground">{r.description}</span> : null}
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate(undefined)} disabled={save.isPending || sameSet(selected, user.role_ids)}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save roles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UsersTab({ roles }: { roles: RoleRow[] }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AccessUser | null>(null);
  const users = useQuery({
    queryKey: farmKeys.userRoles,
    queryFn: () => farmFetch<{ users: AccessUser[] }>('/api/farm/user-roles').then((r) => r.users),
  });
  const roleName = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users.data ?? []).filter(
      (u) => !q || `${u.full_name} ${u.email} ${u.department ?? ''}`.toLowerCase().includes(q)
    );
  }, [users.data, search]);

  if (users.error) return <ErrorState message={errorMessage(users.error)} onRetry={() => users.refetch()} />;

  return (
    <div className="space-y-3">
      <div className="relative w-full sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search name, email or department" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="data-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>eMemo role</TableHead>
              <TableHead>Farm roles</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.isLoading ? (
              <LoadingRows columns={5} />
            ) : filtered.length === 0 ? (
              <EmptyRow columns={5} title="No users found" />
            ) : (
              filtered.map((u) => (
                <TableRow key={u.id} className={cn(!u.is_active && 'opacity-60')}>
                  <TableCell>
                    <span className="font-medium">{u.full_name}</span>
                    {!u.is_active ? <Badge variant="outline" className="ml-2">Inactive</Badge> : null}
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell>{u.department ?? '—'}</TableCell>
                  <TableCell>{u.ememo_role?.name ?? '—'}</TableCell>
                  <TableCell>
                    {u.role_ids.length ? (
                      <div className="flex max-w-md flex-wrap gap-1">
                        {u.role_ids.map((id) => (
                          <Badge key={id} variant="secondary">
                            {roleName.get(id) ?? 'Unknown role'}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No farm access</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                      <Pencil className="size-4" /> Roles
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {editing ? <UserRolesDialog user={editing} roles={roles} onOpenChange={(open) => !open && setEditing(null)} /> : null}
    </div>
  );
}

function RolePermissionsEditor({
  role,
  permissions,
  canEdit,
}: {
  role: RoleRow;
  permissions: PermissionRow[];
  canEdit: boolean;
}) {
  const locked = role.slug === PROTECTED_ROLE;
  const [selected, setSelected] = useState(() => new Set(role.permission_keys));
  const dirty = !sameSet(selected, role.permission_keys);

  const save = useActionMutation(
    () => farmFetch(`/api/farm/roles/${role.id}/permissions`, { method: 'PUT', body: { permission_keys: [...selected] } }),
    { success: `${role.name} permissions updated`, invalidate: [farmKeys.roles, ['farm', 'me']] }
  );

  const modules = useMemo(() => {
    const groups = new Map<string, PermissionRow[]>();
    for (const p of permissions) groups.set(p.module, [...(groups.get(p.module) ?? []), p]);
    return [...groups.entries()];
  }, [permissions]);

  const editable = canEdit && !locked && !save.isPending;
  const set = (keys: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 border-b">
        <div>
          <CardTitle className="text-base">{role.name}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {role.description ?? ''} {role.user_count} user{role.user_count === 1 ? '' : 's'} · {selected.size} of{' '}
            {permissions.length} permissions
          </p>
        </div>
        {canEdit && !locked ? (
          <div className="flex shrink-0 gap-2">
            {dirty ? (
              <Button variant="outline" size="sm" onClick={() => setSelected(new Set(role.permission_keys))} disabled={save.isPending}>
                Reset
              </Button>
            ) : null}
            <Button size="sm" onClick={() => save.mutate(undefined)} disabled={!dirty || save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {locked ? (
          <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Lock className="size-4" /> The System Administrator role always has every permission.
          </p>
        ) : !canEdit ? (
          <p className="text-sm text-muted-foreground">You can view role permissions but not change them.</p>
        ) : null}
        {modules.map(([module, perms]) => {
          const keys = perms.map((p) => p.key);
          const allOn = keys.every((k) => selected.has(k));
          return (
            <div key={module}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{optionLabel(module)}</h3>
                {editable ? (
                  <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => set(keys, !allOn)}>
                    {allOn ? 'Clear all' : 'Select all'}
                  </button>
                ) : null}
              </div>
              <div className="grid gap-1 sm:grid-cols-2">
                {perms.map((p) => (
                  <label
                    key={p.key}
                    className={cn('flex items-start gap-2.5 rounded-md px-2 py-1.5', editable && 'cursor-pointer hover:bg-muted/60')}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={selected.has(p.key)}
                      disabled={!editable}
                      onCheckedChange={(v) => set([p.key], v === true)}
                    />
                    <span>
                      <span className="text-sm">{p.description ?? p.key}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">{p.key}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RolesTab({ data, canEdit }: { data: RolesResponse; canEdit: boolean }) {
  const [roleId, setRoleId] = useState(data.roles[0]?.id ?? null);
  const role = data.roles.find((r) => r.id === roleId) ?? data.roles[0];
  if (!role) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <nav className="space-y-1">
        {data.roles.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRoleId(r.id)}
            className={cn(
              'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
              r.id === role.id ? 'bg-brand-50 font-semibold text-brand-800' : 'hover:bg-muted'
            )}
          >
            <span>{r.name}</span>
            <span className="text-xs text-muted-foreground">{r.user_count}</span>
          </button>
        ))}
      </nav>
      <RolePermissionsEditor
        key={`${role.id}:${role.permission_keys.join(',')}`}
        role={role}
        permissions={data.permissions}
        canEdit={canEdit}
      />
    </div>
  );
}

function AccessPage() {
  const { can } = useFarmAccess();
  const roles = useRoles();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Access & roles"
        subtitle="Give staff farm roles and control what each role can do. eMemo approval roles are unaffected."
      />
      {roles.error ? (
        <ErrorState message={errorMessage(roles.error)} onRetry={() => roles.refetch()} />
      ) : !roles.data ? (
        <div className="dashboard-loading">Loading roles…</div>
      ) : (
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="roles">Roles & permissions</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-4">
            <UsersTab roles={roles.data.roles} />
          </TabsContent>
          <TabsContent value="roles" className="mt-4">
            <RolesTab data={roles.data} canEdit={can('admin.roles')} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <RequirePermission permission="admin.users">
      <AccessPage />
    </RequirePermission>
  );
}
