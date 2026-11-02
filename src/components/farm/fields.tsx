'use client';

import type { FieldValues, Path } from 'react-hook-form';
import { useFormContext } from 'react-hook-form';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const NONE = '__none__';

type BaseProps<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  description?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
};

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <FormLabel>
      {label}
      {required ? <span className="text-destructive">*</span> : null}
    </FormLabel>
  );
}

export function TextField<T extends FieldValues>({
  name,
  label,
  description,
  required,
  className,
  disabled,
  placeholder,
  uppercase,
}: BaseProps<T> & { placeholder?: string; uppercase?: boolean }) {
  const { control } = useFormContext<T>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FieldLabel label={label} required={required} />
          <FormControl>
            <Input
              {...field}
              value={field.value ?? ''}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(uppercase && 'uppercase')}
              onChange={(e) => field.onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function NumberField<T extends FieldValues>({
  name,
  label,
  description,
  required,
  className,
  disabled,
  placeholder,
  step = 'any',
  suffix,
}: BaseProps<T> & { placeholder?: string; step?: string; suffix?: string }) {
  const { control } = useFormContext<T>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FieldLabel label={label} required={required} />
          <div className="relative">
            <FormControl>
              <Input
                type="number"
                inputMode="decimal"
                step={step}
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                disabled={disabled}
                placeholder={placeholder}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.valueAsNumber)}
                className={cn(suffix && 'pr-14')}
              />
            </FormControl>
            {suffix ? (
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                {suffix}
              </span>
            ) : null}
          </div>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function DateField<T extends FieldValues>({ name, label, description, required, className, disabled }: BaseProps<T>) {
  const { control } = useFormContext<T>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FieldLabel label={label} required={required} />
          <FormControl>
            <Input
              type="date"
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              disabled={disabled}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value || null)}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Value is a local `yyyy-MM-ddTHH:mm` string; convert with `localToIso` before sending. */
export function DateTimeField<T extends FieldValues>({ name, label, description, required, className, disabled }: BaseProps<T>) {
  const { control } = useFormContext<T>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FieldLabel label={label} required={required} />
          <FormControl>
            <Input
              type="datetime-local"
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              disabled={disabled}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value || null)}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function CheckboxListField<T extends FieldValues>({
  name,
  label,
  description,
  required,
  className,
  disabled,
  options,
  emptyText = 'Nothing to choose from',
}: BaseProps<T> & { options: (SelectOption & { hint?: string })[]; emptyText?: string }) {
  const { control } = useFormContext<T>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selected = new Set<string>(field.value ?? []);
        const toggle = (value: string, on: boolean) => {
          const next = new Set(selected);
          if (on) next.add(value);
          else next.delete(value);
          field.onChange(options.map((o) => o.value).filter((v) => next.has(v)));
        };
        return (
          <FormItem className={className}>
            <div className="flex items-center justify-between">
              <FieldLabel label={label} required={required} />
              {options.length ? (
                <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              ) : null}
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border">
              {options.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">{emptyText}</p>
              ) : (
                options.map((o) => (
                  <label
                    key={o.value}
                    className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={selected.has(o.value)}
                      onCheckedChange={(v) => toggle(o.value, v === true)}
                      disabled={disabled}
                    />
                    <span className="flex-1">{o.label}</span>
                    {o.hint ? <span className="text-xs text-muted-foreground">{o.hint}</span> : null}
                  </label>
                ))
              )}
            </div>
            {description ? <FormDescription>{description}</FormDescription> : null}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  name,
  label,
  description,
  required,
  className,
  disabled,
  placeholder,
  rows = 3,
}: BaseProps<T> & { placeholder?: string; rows?: number }) {
  const { control } = useFormContext<T>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FieldLabel label={label} required={required} />
          <FormControl>
            <Textarea {...field} value={field.value ?? ''} rows={rows} placeholder={placeholder} disabled={disabled} />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export type SelectOption = { value: string; label: string };

export function SelectField<T extends FieldValues>({
  name,
  label,
  description,
  required,
  className,
  disabled,
  options,
  placeholder = 'Select…',
  emptyLabel,
  onValueChange,
}: BaseProps<T> & {
  options: SelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  /** Called after the user picks a value (not on programmatic resets). */
  onValueChange?: (value: string | null) => void;
}) {
  const { control } = useFormContext<T>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FieldLabel label={label} required={required} />
          <Select
            value={field.value ?? (emptyLabel ? NONE : '')}
            onValueChange={(v) => {
              const value = v === NONE ? null : v;
              field.onChange(value);
              onValueChange?.(value);
            }}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className="w-full" onBlur={field.onBlur} ref={field.ref}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {emptyLabel ? <SelectItem value={NONE}>{emptyLabel}</SelectItem> : null}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SwitchField<T extends FieldValues>({ name, label, description, className, disabled }: BaseProps<T>) {
  const { control } = useFormContext<T>();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn('flex items-start justify-between gap-4 rounded-lg border p-3', className)}>
          <div className="space-y-0.5">
            <FormLabel>{label}</FormLabel>
            {description ? <FormDescription>{description}</FormDescription> : null}
          </div>
          <FormControl>
            <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
