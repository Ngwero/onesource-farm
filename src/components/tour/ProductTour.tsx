'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { buildTourSteps, resolveVisibleSteps, type TourStep } from '@/lib/tour/steps';
import {
  TOUR_START_EVENT,
  isTourCompleted,
  markTourCompleted,
  requestTourStart,
} from '@/lib/tour/storage';
import type { RoleSlug } from '@/types';

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const PAD = 8;
const VIEW_MARGIN = 16;

function measureTarget(targetId: string): SpotlightRect | null {
  const el = document.querySelector(`[data-tour-id="${targetId}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };
}

function tooltipStyle(
  step: TourStep,
  rect: SpotlightRect | null
): React.CSSProperties {
  if (!rect) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: '24rem',
      maxHeight: `calc(100vh - ${VIEW_MARGIN * 2}px)`,
    };
  }

  const gap = 16;
  const placement = step.placement || 'right';

  if (placement === 'bottom') {
    return {
      top: rect.top + rect.height + gap,
      left: Math.max(VIEW_MARGIN, Math.min(rect.left, window.innerWidth - 320)),
      maxWidth: '20rem',
      maxHeight: `calc(100vh - ${VIEW_MARGIN * 2}px)`,
    };
  }

  if (placement === 'left') {
    return {
      top: Math.max(VIEW_MARGIN, rect.top),
      right: Math.max(VIEW_MARGIN, window.innerWidth - rect.left + gap),
      maxWidth: '20rem',
      maxHeight: `calc(100vh - ${VIEW_MARGIN * 2}px)`,
    };
  }

  return {
    top: Math.max(VIEW_MARGIN, rect.top),
    left: Math.min(rect.left + rect.width + gap, window.innerWidth - 320),
    maxWidth: '20rem',
    maxHeight: `calc(100vh - ${VIEW_MARGIN * 2}px)`,
  };
}

/** Keep the tour card fully inside the viewport after initial placement. */
function clampCardIntoViewport(card: HTMLElement) {
  const rect = card.getBoundingClientRect();
  const maxHeight = Math.max(160, window.innerHeight - VIEW_MARGIN * 2);
  card.style.maxHeight = `${maxHeight}px`;
  card.style.overflowY = 'auto';

  let top = rect.top;
  let left = rect.left;

  if (rect.height > maxHeight) {
    top = VIEW_MARGIN;
  } else if (rect.bottom > window.innerHeight - VIEW_MARGIN) {
    top = Math.max(VIEW_MARGIN, window.innerHeight - VIEW_MARGIN - rect.height);
  } else if (rect.top < VIEW_MARGIN) {
    top = VIEW_MARGIN;
  }

  if (rect.right > window.innerWidth - VIEW_MARGIN) {
    left = Math.max(VIEW_MARGIN, window.innerWidth - VIEW_MARGIN - rect.width);
  } else if (rect.left < VIEW_MARGIN) {
    left = VIEW_MARGIN;
  }

  card.style.top = `${top}px`;
  card.style.left = `${left}px`;
  card.style.right = 'auto';
  card.style.bottom = 'auto';
  if (card.style.transform?.includes('translate')) {
    card.style.transform = 'none';
  }

  card.querySelector<HTMLElement>('.product-tour__actions')?.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
  });
}

export function ProductTour() {
  const { user } = useAuth();
  const roleSlug = (user?.role?.slug || 'staff') as RoleSlug;
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const allSteps = useMemo(
    () => (user ? buildTourSteps(user, roleSlug) : []),
    [user, roleSlug]
  );
  const [steps, setSteps] = useState<TourStep[]>([]);

  useEffect(() => {
    if (!open) {
      setSteps([]);
      return;
    }
    const sync = () => setSteps(resolveVisibleSteps(allSteps));
    sync();
    const timer = window.setTimeout(sync, 200);
    return () => window.clearTimeout(timer);
  }, [allSteps, open]);
  const safeIndex = Math.min(index, Math.max(0, steps.length - 1));
  const step = steps[safeIndex];
  const isLast = safeIndex >= steps.length - 1;

  const close = useCallback(
    (completed: boolean) => {
      if (user && completed) markTourCompleted(user.id);
      setOpen(false);
      setIndex(0);
      setSpotlight(null);
    },
    [user]
  );

  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(next, steps.length - 1)));
    },
    [steps.length]
  );

  useEffect(() => {
    if (!user?.id || user.must_set_password) return;
    const timer = window.setTimeout(() => {
      if (!isTourCompleted(user.id)) setOpen(true);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [user?.id, user?.must_set_password]);

  useEffect(() => {
    function onStart() {
      if (!user?.id) return;
      setIndex(0);
      setOpen(true);
    }
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [user?.id]);

  useLayoutEffect(() => {
    document.querySelectorAll('[data-tour-highlight]').forEach((node) => {
      node.removeAttribute('data-tour-highlight');
    });

    if (!open || !step?.target) {
      setSpotlight(null);
      return;
    }

    const update = () => {
      const el = document.querySelector(`[data-tour-id="${step.target}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      window.setTimeout(() => {
        setSpotlight(measureTarget(step.target!));
        document.querySelectorAll('[data-tour-highlight]').forEach((node) => {
          node.removeAttribute('data-tour-highlight');
        });
        el?.setAttribute('data-tour-highlight', 'true');
      }, 150);
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      document.querySelectorAll('[data-tour-highlight]').forEach((node) => {
        node.removeAttribute('data-tour-highlight');
      });
    };
  }, [open, step]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    const card = cardRef.current;
    if (!card) return;
    clampCardIntoViewport(card);
    const onResize = () => clampCardIntoViewport(card);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, step, spotlight, safeIndex]);

  if (!open || !user || !step) return null;

  return (
    <div className="product-tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {spotlight ? (
        <div
          className="product-tour__spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
          onClick={() => close(true)}
          aria-hidden
        />
      ) : (
        <div className="product-tour__backdrop" onClick={() => close(true)} aria-hidden />
      )}

      <div
        ref={cardRef}
        className={`product-tour__card${spotlight ? '' : ' product-tour__card--centered'}`}
        style={tooltipStyle(step, spotlight)}
      >
        <div className="product-tour__card-header">
          <div className="flex items-center gap-2 text-brand-600">
            <Sparkles size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">
              Step {safeIndex + 1} of {steps.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => close(true)}
            className="product-tour__close"
            aria-label="Close tour"
          >
            <X size={16} />
          </button>
        </div>

        <h2 id="tour-title" className="product-tour__title">
          {step.title}
        </h2>
        <p
          className="product-tour__body"
          dangerouslySetInnerHTML={{ __html: step.body }}
        />

        <div className="product-tour__actions">
          <button type="button" onClick={() => close(true)} className="product-tour__skip">
            Skip tour
          </button>
          <div className="flex gap-2">
            {safeIndex > 0 ? (
              <button type="button" onClick={() => goTo(safeIndex - 1)} className="product-tour__back">
                <ChevronLeft size={16} />
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (isLast ? close(true) : goTo(safeIndex + 1))}
              className="product-tour__next"
            >
              {isLast ? 'Get started' : 'Next'}
              {!isLast ? <ChevronRight size={16} /> : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TourHelpButton() {
  return (
    <button
      type="button"
      onClick={() => requestTourStart()}
      className="product-tour__help-btn"
      title="Take a guided tour"
    >
      <Sparkles size={15} />
      <span className="hidden sm:inline">Take tour</span>
    </button>
  );
}
