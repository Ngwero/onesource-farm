'use client';

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { OneSourceLogo } from '@/components/brand/OneSourceLogo';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { BadgeCheck, GitBranch, HardHat, Map, Wheat } from 'lucide-react';

const LOGIN_MOTES = [
  { size: 5, orbit: 28, pull: 0.16 },
  { size: 7, orbit: 42, pull: 0.13 },
  { size: 4, orbit: 56, pull: 0.18 },
  { size: 6, orbit: 36, pull: 0.15 },
  { size: 5, orbit: 72, pull: 0.12 },
  { size: 8, orbit: 48, pull: 0.14 },
  { size: 4, orbit: 88, pull: 0.11 },
  { size: 6, orbit: 32, pull: 0.17 },
  { size: 5, orbit: 64, pull: 0.13 },
  { size: 7, orbit: 96, pull: 0.1 },
  { size: 4, orbit: 40, pull: 0.16 },
  { size: 6, orbit: 80, pull: 0.12 },
  { size: 5, orbit: 52, pull: 0.15 },
  { size: 8, orbit: 110, pull: 0.09 },
  { size: 4, orbit: 24, pull: 0.19 },
  { size: 6, orbit: 68, pull: 0.14 },
] as const;

const LOGIN_LEAVES = [
  { size: 26, orbit: 78, pull: 0.08 },
  { size: 20, orbit: 108, pull: 0.07 },
  { size: 32, orbit: 92, pull: 0.075 },
  { size: 18, orbit: 124, pull: 0.065 },
] as const;

const FARM_CAPABILITIES = [
  {
    icon: Map,
    title: 'Land and crops',
    body: 'Blocks, plantings, field activities, and pest reports.',
  },
  {
    icon: Wheat,
    title: 'Harvest and grading',
    body: 'Record batches and grade produce for export.',
  },
  {
    icon: BadgeCheck,
    title: 'Quality and packhouse',
    body: 'QC inspections, packing, warehouse stock, and movements.',
  },
  {
    icon: HardHat,
    title: 'Workforce',
    body: 'Workers, attendance, tasks, and payroll costing.',
  },
  {
    icon: GitBranch,
    title: 'Traceability',
    body: 'Follow a batch from the block to the buyer.',
  },
] as const;

function LoginAtmosphere() {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const scene = root?.closest('.login-scene');
    if (!root || !(scene instanceof HTMLElement)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const motes = [...root.querySelectorAll<HTMLElement>('.login-mote')];
    const leaves = [...root.querySelectorAll<HTMLElement>('.login-drift-leaf')];
    const glow = root.querySelector<HTMLElement>('.login-cursor-glow');
    const orbField = scene.querySelector<HTMLElement>('.login-orb-field');
    const hazeField = root.querySelector<HTMLElement>('.login-haze-field');

    const width = () => scene.clientWidth;
    const height = () => scene.clientHeight;

    type Particle = {
      el: HTMLElement;
      x: number;
      y: number;
      orbit: number;
      phase: number;
      spin: number;
      pull: number;
      kind: 'mote' | 'leaf';
      rot: number;
    };

    const particles: Particle[] = [
      ...motes.map((el, i) => {
        const spec = LOGIN_MOTES[i] ?? LOGIN_MOTES[0];
        return {
          el,
          x: Math.random() * width(),
          y: Math.random() * height(),
          orbit: spec.orbit,
          phase: Math.random() * Math.PI * 2,
          spin: 0.018 + (i % 6) * 0.006,
          pull: spec.pull,
          kind: 'mote' as const,
          rot: 0,
        };
      }),
      ...leaves.map((el, i) => {
        const spec = LOGIN_LEAVES[i] ?? LOGIN_LEAVES[0];
        return {
          el,
          x: Math.random() * width(),
          y: Math.random() * height(),
          orbit: spec.orbit,
          phase: Math.random() * Math.PI * 2,
          spin: 0.01 + i * 0.003,
          pull: spec.pull,
          kind: 'leaf' as const,
          rot: Math.random() * 360,
        };
      }),
    ];

    for (const particle of particles) {
      particle.el.style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0)`;
    }

    let pointerX = width() / 2;
    let pointerY = height() / 2;
    let glowX = pointerX;
    let glowY = pointerY;
    let fieldX = 0;
    let fieldY = 0;
    let tracking = false;
    let raf = 0;

    const onMove = (event: PointerEvent) => {
      const rect = scene.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
      tracking = true;
      scene.classList.add('login-scene--tracking');
    };

    const onLeave = () => {
      tracking = false;
      scene.classList.remove('login-scene--tracking');
    };

    const tick = () => {
      const w = width();
      const h = height();
      glowX += (pointerX - glowX) * 0.2;
      glowY += (pointerY - glowY) * 0.2;
      if (glow) glow.style.transform = `translate3d(${glowX}px, ${glowY}px, 0)`;

      const nx = w ? (pointerX / w) * 2 - 1 : 0;
      const ny = h ? (pointerY / h) * 2 - 1 : 0;
      const targetFieldX = tracking ? nx * 42 : 0;
      const targetFieldY = tracking ? ny * 28 : 0;
      fieldX += (targetFieldX - fieldX) * 0.07;
      fieldY += (targetFieldY - fieldY) * 0.07;
      if (orbField) orbField.style.transform = `translate3d(${fieldX}px, ${fieldY}px, 0)`;
      if (hazeField) hazeField.style.transform = `translate3d(${fieldX * 1.35}px, ${fieldY * 1.35}px, 0)`;

      for (const particle of particles) {
        particle.phase += particle.spin;
        if (tracking) {
          const targetX = pointerX + Math.cos(particle.phase) * particle.orbit;
          const targetY = pointerY + Math.sin(particle.phase) * particle.orbit;
          particle.x += (targetX - particle.x) * particle.pull;
          particle.y += (targetY - particle.y) * particle.pull;
        } else {
          particle.y -= 0.42 + particle.spin * 6;
          particle.x += Math.sin(particle.phase) * 0.4;
          if (particle.y < -48) {
            particle.y = h + 36;
            particle.x = Math.random() * w;
          }
          if (particle.x < -40) particle.x = w + 20;
          if (particle.x > w + 40) particle.x = -20;
        }
        particle.rot += particle.kind === 'leaf' ? 0.55 : 0;
        const rotate = particle.kind === 'leaf' ? ` rotate(${particle.rot}deg)` : '';
        particle.el.style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0)${rotate}`;
      }

      raf = requestAnimationFrame(tick);
    };

    scene.addEventListener('pointermove', onMove);
    scene.addEventListener('pointerleave', onLeave);
    scene.addEventListener('pointerdown', onMove);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      scene.removeEventListener('pointermove', onMove);
      scene.removeEventListener('pointerleave', onLeave);
      scene.removeEventListener('pointerdown', onMove);
      scene.classList.remove('login-scene--tracking');
    };
  }, []);

  return (
    <div className="login-atmosphere" ref={rootRef} aria-hidden>
      <div className="login-haze-field">
        <div className="login-haze" />
        <div className="login-haze login-haze--late" />
      </div>
      <div className="login-cursor-glow" />
      {LOGIN_MOTES.map((mote, i) => (
        <span
          key={`mote-${i}`}
          className="login-mote"
          style={{ width: mote.size, height: mote.size }}
        />
      ))}
      {LOGIN_LEAVES.map((leaf, i) => (
        <span
          key={`leaf-${i}`}
          className="login-drift-leaf"
          style={{ width: leaf.size, height: Math.round(leaf.size * 1.35) }}
        />
      ))}
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const { user, loading: authLoading, login, dashboardRoute } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (authLoading) return;
    if (user?.must_set_password) {
      router.replace('/set-password');
      return;
    }
    if (user) {
      router.replace(dashboardRoute);
    }
  }, [user, authLoading, dashboardRoute, router]);

  useEffect(() => {
    if (searchParams.get('reset') === '1') {
      setSuccess('If an account exists for that email, we sent a password reset link. Check inbox and spam.');
    }
    if (searchParams.get('reason') === 'timeout') {
      setError('Your session expired after 20 minutes of inactivity. Please sign in again.');
    }
    const urlError = searchParams.get('error');
    if (urlError) {
      setError(decodeURIComponent(urlError));
    }
  }, [searchParams]);

  useEffect(() => {
    const welcomeNotice = sessionStorage.getItem('onesource_welcome_notice');
    if (welcomeNotice) {
      sessionStorage.removeItem('onesource_welcome_notice');
    }
    if (sessionStorage.getItem('onesource_password_ready') === '1') {
      sessionStorage.removeItem('onesource_password_ready');
      const base = 'Password saved successfully. Sign in with your new password.';
      setSuccess(welcomeNotice ? `${base} ${welcomeNotice}` : base);
    } else if (welcomeNotice) {
      setSuccess(welcomeNotice);
    }
  }, []);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail || email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(
        data.message ||
          'If an account exists, a reset link was sent. Open it and choose a new password on the next page.'
      );
      setForgotOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const mustSetPassword = await login(email, password);
      router.push(mustSetPassword ? '/set-password' : dashboardRoute);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-scene">
      <div className="login-orb-field" aria-hidden>
        <div className="login-orb login-orb--forest" />
        <div className="login-orb login-orb--leaf" />
        <div className="login-orb login-orb--deep" />
      </div>
      <LoginAtmosphere />

      <div className="login-shell">
        <section className="login-pitch" aria-labelledby="login-headline">
          <div className="login-pitch-logo">
            <OneSourceLogo width={180} variant="full" priority />
          </div>
          <p className="login-kicker">Farm operations portal</p>
          <h1 id="login-headline" className="login-headline">
            From field to export, in one place
          </h1>
          <p className="login-lede">
            OneSource Farm is the system the team uses to run the farm: land and crops,
            harvests, quality, packing, warehouse stock, workforce, and a full trail from
            the block to the buyer.
          </p>
          <ul className="login-capabilities">
            {FARM_CAPABILITIES.map((item) => (
              <li key={item.title} className="login-capability">
                <span className="login-capability-mark" aria-hidden>
                  <item.icon size={16} />
                </span>
                <span>
                  <strong>{item.title}.</strong> {item.body}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="login-glass">
        <h2 className="login-title">Sign in</h2>
        <p className="login-subtitle">Open the farm portal with your work email.</p>
        <p className="text-xs text-center text-white/50 -mt-2 mb-4">
          First time? Use the temporary password from your administrator, then set your own.
        </p>

        {success && (
          <div className="mb-4 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
            {success}
          </div>
        )}
        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email" className="login-label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="login-input"
              placeholder="name@company.com"
              required
              autoComplete="email"
            />
          </div>

          <PasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            required
            autoComplete="current-password"
            variant="login"
            labelExtra={
              <div className="login-password-head">
                <label htmlFor="password" className="login-label">
                  Password
                </label>
                <button
                  type="button"
                  className="login-link"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotOpen(true);
                    setError('');
                  }}
                >
                  Forgot password?
                </button>
              </div>
            }
          />

          <button type="submit" disabled={loading} className="login-btn-pill">
            {loading ? 'Signing in...' : 'Sign in to the farm'}
          </button>
        </form>

        {forgotOpen && (
          <form
            onSubmit={handleForgotPassword}
            className="mt-4 p-4 rounded-lg border border-white/20 bg-white/5 space-y-3"
          >
            <p className="text-sm text-white/80">Reset link will be sent to your work email.</p>
            <input
              type="email"
              className="login-input"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="name@email.com"
              required
            />
            <div className="flex gap-2">
              <button type="submit" disabled={forgotLoading} className="login-btn-pill flex-1 text-sm py-2">
                {forgotLoading ? 'Sending...' : 'Send reset link'}
              </button>
              <button
                type="button"
                className="login-link text-sm"
                onClick={() => setForgotOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <p className="login-footer">
          Staff access for OneSource Farm.{' '}
          <button
            type="button"
            className="login-link-inline"
            onClick={() =>
              setError('Request access from your OneSource Farm system administrator.')
            }
          >
            Need help?
          </button>
        </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center page-shell">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-200 border-t-brand-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
