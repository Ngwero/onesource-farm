'use client';

import type { FieldValues, SubmitHandler, UseFormReturn } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type FormSheetProps<T extends FieldValues> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  form: UseFormReturn<T>;
  onSubmit: SubmitHandler<T>;
  submitLabel?: string;
  pending?: boolean;
  children: React.ReactNode;
};

/** Side drawer with a validated form — used for every create/edit flow. */
export function FormSheet<T extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  form,
  onSubmit,
  submitLabel = 'Save',
  pending,
  children,
}: FormSheetProps<T>) {
  return (
    <Sheet open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <SheetContent className="flex w-full max-w-full flex-col gap-0 border-l-border/80 sm:max-w-xl">
        <SheetHeader className="border-b border-border/70 bg-gradient-to-b from-brand-50/70 to-white">
          <SheetTitle className="font-display text-lg font-semibold tracking-tight sm:text-xl">{title}</SheetTitle>
          {description ? <SheetDescription className="leading-relaxed">{description}</SheetDescription> : null}
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
            <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
              {form.formState.errors.root?.message ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              ) : null}
              {children}
            </div>
            <SheetFooter className="flex-col-reverse gap-2 border-t border-border/70 bg-muted/30 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                {submitLabel}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
