"use client";

import React from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";

export interface ToastItemData {
  id: string;
  message: string;
}

interface ToastListProps {
  toasts: ToastItemData[];
  onUndo: () => void;
  canUndo: boolean;
}

export default function ToastList({ toasts, onUndo, canUndo }: ToastListProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-[90vw] pointer-events-none">
      {toasts.map((t, index) => (
        <div
          key={t.id}
          className="bg-card border border-border text-foreground text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center gap-2 truncate">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="truncate">{t.message}</span>
          </div>
          {canUndo && index === toasts.length - 1 && (
            <button
              onClick={onUndo}
              className="bg-accent/20 hover:bg-accent/30 text-accent px-2.5 py-1 rounded-lg text-[11px] font-bold border border-accent/30 transition-all flex items-center gap-1 flex-shrink-0 ml-auto"
            >
              <RotateCcw className="w-3 h-3" /> Geri Al
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
