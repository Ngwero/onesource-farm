'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  buildOnboardingItems,
  hasVisitedOnboardingQueue,
  isOnboardingComplete,
  markOnboardingQueueVisited,
} from '@/lib/onboarding/checklist';

const DISMISS_KEY = 'ememo_onboarding_dismissed';

export function OnboardingChecklist() {
  const { user } = useAuth();
  const [queueVisited, setQueueVisited] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setQueueVisited(hasVisitedOnboardingQueue(user.id));
    try {
      setDismissed(localStorage.getItem(`${DISMISS_KEY}:${user.id}`) === '1');
    } catch {
      setDismissed(false);
    }
  }, [user?.id]);

  const items = useMemo(
    () => (user ? buildOnboardingItems(user, queueVisited) : []),
    [user, queueVisited]
  );

  if (!user || dismissed || isOnboardingComplete(items)) return null;

  function dismiss() {
    if (!user?.id) return;
    try {
      localStorage.setItem(`${DISMISS_KEY}:${user.id}`, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  function onQueueClick() {
    if (!user?.id) return;
    markOnboardingQueueVisited(user.id);
    setQueueVisited(true);
  }

  return (
    <section className="card p-4 mb-6 border-brand-100 bg-brand-50/40">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold text-slate-900">Get started</h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Complete these steps so you can create and approve memos without delays.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/80"
          aria-label="Dismiss checklist"
        >
          <X size={18} />
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`flex items-start gap-3 rounded-lg px-3 py-2 ${
              item.done ? 'bg-white/60' : 'bg-white border border-slate-100'
            }`}
          >
            {item.done ? (
              <CheckCircle2 size={18} className="text-brand-600 shrink-0 mt-0.5" />
            ) : (
              <Circle size={18} className="text-slate-300 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              {item.href && !item.done ? (
                <Link
                  href={item.href}
                  onClick={item.id === 'queue' ? onQueueClick : undefined}
                  className="text-sm font-medium text-brand-700 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <p className={`text-sm font-medium ${item.done ? 'text-slate-600' : 'text-slate-800'}`}>
                  {item.label}
                </p>
              )}
              {item.hint && !item.done ? (
                <p className="text-xs text-slate-500 mt-0.5">{item.hint}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
