import { fmtPct, fmtQty } from '@/lib/farm/format';
import { purposeColour, type GradingStats } from '@/lib/farm/grading';

/** Stacked bar plus legend of grade quantities as a share of the harvested quantity. */
export function GradeDistribution({ stats, unit }: { stats: GradingStats; unit: string }) {
  if (!stats.distribution.length) return <p className="text-sm text-muted-foreground">No grades entered yet.</p>;
  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {stats.distribution.map((d) => (
          <div key={d.id} className={purposeColour(d.purpose)} style={{ width: `${Math.min(100, d.pct)}%` }} title={`${d.name} ${fmtPct(d.pct)}`} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {stats.distribution.map((d) => (
          <li key={d.id} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${purposeColour(d.purpose)}`} />
            <span className="font-medium">{d.name}</span>
            <span className="text-muted-foreground">
              {fmtQty(d.quantity, unit)} · {fmtPct(d.pct)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
