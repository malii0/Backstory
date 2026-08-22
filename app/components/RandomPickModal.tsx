"use client";

import React from "react";
import { X, Sparkles, Dices } from "lucide-react";
import { MediaItem } from "@/lib/types";

interface RandomPickModalProps {
  item: MediaItem | null;
  onClose: () => void;
  onSelect: (item: MediaItem) => void;
  onReroll: () => void;
}

export default function RandomPickModal({
  item,
  onClose,
  onSelect,
  onReroll,
}: RandomPickModalProps) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border p-6 rounded-3xl max-w-sm w-full space-y-4 text-center shadow-2xl relative animate-in fade-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="inline-flex p-3 rounded-full bg-accent/10 text-accent border border-accent/20">
          <Sparkles className="w-6 h-6" />
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
            Rastgele Seçim
          </p>
          <h3 className="text-lg font-extrabold text-foreground mt-1">
            {item.title || item.name}
          </h3>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          {item.overview || "Açıklama bulunmuyor."}
        </p>

        <div className="pt-2 flex gap-2">
          <button
            onClick={() => onSelect(item)}
            className="flex-1 bg-accent text-accent-foreground text-xs font-bold py-2.5 rounded-xl transition-all"
          >
            Detayları Gör
          </button>
          <button
            onClick={onReroll}
            className="bg-muted hover:bg-muted/80 text-foreground p-2.5 rounded-xl border border-border transition-colors"
            title="Tekrar Zar At"
          >
            <Dices className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
