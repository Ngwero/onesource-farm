'use client';

import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { FormSheet } from '@/components/farm/FormSheet';
import { CheckboxListField, SelectField, SwitchField, TextField } from '@/components/farm/fields';
import { farmKeys } from '@/hooks/farm';
import { useFormMutation } from '@/hooks/useFormMutation';
import { farmFetch } from '@/lib/farm/client';
import { inviteUserSchema, type InviteUserInput } from '@/lib/farm/schemas';

type Lookup = { roles: { id: string; name: string }[]; departments: { id: string; name: string }[] };
type FarmRole = { id: string; name: string; description: string | null };
type InviteResult = {
  user: { email: string; full_name: string };
  emailSent: boolean;
  emailReason?: string;
  temporaryPassword: string;
};

const EMPTY: InviteUserInput = {
  email: '',
  full_name: '',
  title: '',
  department_id: null,
  role_id: '' as unknown as InviteUserInput['role_id'],
  farm_role_ids: [],
  send_login: true,
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  farmRoles: FarmRole[];
};

export function InviteUserSheet({ open, onOpenChange, farmRoles }: Props) {
  const lookup = useQuery({
    queryKey: ['lookup', 'invite-user'],
    queryFn: () => fetch('/api/lookup', { credentials: 'include' }).then((r) => r.json() as Promise<Lookup>),
    enabled: open,
  });

  const form = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: EMPTY,
  });

  const save = useFormMutation(
    form,
    (values) => farmFetch<InviteResult>('/api/farm/users', { method: 'POST', body: values }),
    {
      success: 'User created',
      invalidate: [farmKeys.userRoles, farmKeys.roles, farmKeys.users],
      onDone: (result) => {
        if (result.emailSent) {
          toast.success(`Login details emailed to ${result.user.email}`);
        } else {
          toast.warning(
            `Account created, but the email was not sent${result.emailReason ? ` (${result.emailReason})` : ''}. Temporary password: ${result.temporaryPassword}`
          );
        }
        form.reset(EMPTY);
        onOpenChange(false);
      },
    }
  );

  return (
    <FormSheet
      open={open}
      onOpenChange={(v) => {
        if (!v) form.reset(EMPTY);
        onOpenChange(v);
      }}
      title="Add user"
      description="Create a staff account and email them the portal link, their email address, and a temporary password. They will set their own password on first sign-in."
      form={form}
      onSubmit={(values) => save.mutate(values)}
      submitLabel="Create and send login"
      pending={save.isPending}
    >
      <TextField<InviteUserInput> name="email" label="Email" required placeholder="name@company.com" />
      <TextField<InviteUserInput> name="full_name" label="Full name" required />
      <TextField<InviteUserInput> name="title" label="Job title" />
      <SelectField<InviteUserInput>
        name="department_id"
        label="Department"
        emptyLabel="Unassigned"
        options={(lookup.data?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
      />
      <SelectField<InviteUserInput>
        name="role_id"
        label="System role"
        required
        placeholder="Select a role"
        options={(lookup.data?.roles ?? []).map((r) => ({ value: r.id, label: r.name }))}
      />
      <CheckboxListField<InviteUserInput>
        name="farm_role_ids"
        label="Farm roles"
        description="What they can do in farm, harvest, packhouse and warehouse."
        options={farmRoles.map((r) => ({ value: r.id, label: r.name, hint: r.description ?? undefined }))}
      />
      <SwitchField<InviteUserInput>
        name="send_login"
        label="Email login details"
        description="Sends the portal address, their email, and the temporary password."
      />
    </FormSheet>
  );
}
