'use client';

import React, { useEffect, useState } from 'react';
import { Cpu, CheckCircle2, Loader2, Sparkles, ShieldCheck, Database } from 'lucide-react';

export interface AiProcessingProgressProps {
  totalRows: number;
  filename: string;
}

interface StepItem {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

export const AiProcessingProgress: React.FC<AiProcessingProgressProps> = ({
  totalRows,
  filename,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(15);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const totalBatches = Math.max(1, Math.ceil(totalRows / 50));

  const steps: StepItem[] = [
    {
      id: 'chunking',
      label: 'Chunking & Payload Preparation',
      sublabel: `Splitting ${totalRows.toLocaleString()} rows into ${totalBatches} concurrent AI batches`,
      icon: <Database className="w-4 h-4" />,
    },
    {
      id: 'extraction',
      label: 'AI Intelligent Field Mapping',
      sublabel: 'Invoking LLM to extract names, phones, emails, status & catch-all notes',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: 'validation',
      label: 'Domain Normalization & Business Rules',
      sublabel: 'Enforcing status enums, date conversion & mandatory skip conditions',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: 'finalizing',
      label: 'Finalizing Structured JSON Dashboard',
      sublabel: 'Aggregating imported/skipped counts and calculating batch telemetry',
      icon: <Cpu className="w-4 h-4" />,
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev < 35) {
          setCurrentStepIndex(0);
          return prev + 5;
        } else if (prev < 75) {
          setCurrentStepIndex(1);
          return prev + 3;
        } else if (prev < 92) {
          setCurrentStepIndex(2);
          return prev + 2;
        } else if (prev < 98) {
          setCurrentStepIndex(3);
          return prev + 1;
        }
        return prev;
      });
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-2xl bg-surface-container border border-outline-variant rounded-2xl p-6 shadow-xl space-y-6 animate-fadeIn">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary relative">
            <Sparkles className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
            </span>
          </div>
          <div>
            <h4 className="font-bold text-on-surface text-base">
              AI Extraction Engine Active
            </h4>
            <p className="text-xs text-secondary font-mono">
              File: <span className="font-semibold text-on-surface">{filename}</span> ({totalRows.toLocaleString()} rows)
            </p>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-surface border border-outline-variant text-xs font-mono text-secondary">
          Elapsed: <span className="font-bold text-on-surface">{elapsedSeconds}s</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-primary">{steps[currentStepIndex]?.label}</span>
          <span className="text-on-surface font-mono">{progressPercent}%</span>
        </div>
        <div className="w-full bg-surface rounded-full h-3 overflow-hidden border border-outline-variant/50 shadow-inner">
          <div
            className="bg-primary h-3 rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-1"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          </div>
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-3 pt-2">
        {steps.map((step, idx) => {
          const isDone = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;

          return (
            <div
              key={step.id}
              className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${isCurrent
                  ? 'bg-primary/5 border-primary shadow-sm'
                  : isDone
                    ? 'bg-surface/50 border-emerald-500/30 opacity-80'
                    : 'bg-surface/20 border-outline-variant/30 opacity-40'
                }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isDone
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : isCurrent
                      ? 'bg-primary/10 text-primary'
                      : 'bg-surface border border-outline-variant text-secondary'
                  }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  step.icon
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h5
                    className={`text-sm font-semibold ${isCurrent ? 'text-primary font-bold' : isDone ? 'text-on-surface' : 'text-secondary'
                      }`}
                  >
                    {step.label}
                  </h5>
                  {isCurrent && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                      Active
                    </span>
                  )}
                  {isDone && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                      Done
                    </span>
                  )}
                </div>
                <p className="text-xs text-secondary mt-0.5 truncate">
                  {step.sublabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>


    </div>
  );
};
