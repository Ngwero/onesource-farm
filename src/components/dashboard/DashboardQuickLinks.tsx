'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export interface QuickLink {
  href: string;
  label: string;
  description?: string;
  icon: ReactNode;
}

export function DashboardQuickLinks({ links, title = 'Administration' }: { links: QuickLink[]; title?: string }) {
  return (
    <section className="mb-8">
      <h2 className="dashboard-section-title">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="quick-link-card group">
            <span className="quick-link-icon">{link.icon}</span>
            <span className="quick-link-label">{link.label}</span>
            {link.description ? (
              <span className="quick-link-desc">{link.description}</span>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
