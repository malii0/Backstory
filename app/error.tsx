"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Next.js App Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 border border-border shadow-2xl space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 font-bold text-xl mx-auto mb-2">
          !
        </div>

        <h2 className="text-lg font-bold text-foreground">
          Bir şeyler ters gitti
        </h2>

        <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
          Beklenmeyen bir hata oluştu. Lütfen bağlantınızı kontrol edip tekrar
          deneyin.
        </p>

        <button
          type="button"
          onClick={() => reset()}
          className="w-full py-2.5 bg-accent hover:opacity-80 text-accent-foreground font-bold rounded-xl text-xs transition cursor-pointer mt-2"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
