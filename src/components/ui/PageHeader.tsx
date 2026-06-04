import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  titleMono?: boolean;
};

export function PageHeader({ title, subtitle, meta, actions, titleMono }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__main">
        {meta ? <div className="page-header__meta">{meta}</div> : null}
        <h1 className={`page-header__title${titleMono ? ' page-header__title--mono' : ''}`}>
          {title}
        </h1>
        {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
