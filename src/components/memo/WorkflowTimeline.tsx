'use client';

import { CheckCircle, Circle, Clock, XCircle, RotateCcw } from 'lucide-react';

interface Step {
  name: string;
  status: 'completed' | 'current' | 'pending' | 'rejected' | 'returned';
  approver?: string;
  date?: string;
  note?: string;
}

interface WorkflowTimelineProps {
  steps: Step[];
  slaDueAt?: string;
}

export function WorkflowTimeline({ steps, slaDueAt }: WorkflowTimelineProps) {
  const icons = {
    completed: <CheckCircle className="text-emerald-600" size={20} />,
    current: <Clock className="text-amber-500 animate-pulse" size={20} />,
    pending: <Circle className="text-amber-400" size={20} />,
    rejected: <XCircle className="text-red-600" size={20} />,
    returned: <RotateCcw className="text-amber-500" size={20} />,
  };

  const slaRemaining = slaDueAt
    ? Math.max(0, new Date(slaDueAt).getTime() - Date.now())
    : null;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 memo-workflow-timeline">
      <h3 className="font-semibold text-slate-800 mb-4">Workflow Progress</h3>

      {slaRemaining !== null && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          slaRemaining < 3600000 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
        }`}>
          SLA: {slaRemaining > 0
            ? `${Math.floor(slaRemaining / 3600000)}h ${Math.floor((slaRemaining % 3600000) / 60000)}m remaining`
            : 'SLA BREACHED'}
        </div>
      )}

      <div className="space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="mt-0.5">{icons[step.status]}</div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                step.status === 'completed'
                  ? 'text-emerald-700'
                  : step.status === 'current' || step.status === 'pending'
                    ? 'text-amber-700'
                    : step.status === 'rejected'
                      ? 'text-red-700'
                      : 'text-slate-700'
              }`}>
                {step.name}
              </p>
              {step.approver && (
                <p className="text-xs text-slate-500">{step.approver}</p>
              )}
              {step.note ? (
                <p className="text-xs font-medium text-amber-700 mt-0.5">{step.note}</p>
              ) : null}
              {step.date && (
                <p className="text-xs text-slate-400">{step.date}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
