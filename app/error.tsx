'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Next.js App Error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md rounded-3xl bg-zinc-900 p-8 border border-zinc-800 shadow-2xl space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 font-bold text-xl mx-auto mb-2">
          !
        </div>
        
        <h2 className="text-lg font-bold text-zinc-100">
          Bir şeyler ters gitti
        </h2>
        
        <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
          {error.message || 'Veriler yüklenirken beklenmeyen bir hata oluştu.'}
        </p>

        <button
          type="button"
          onClick={() => reset()}
          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs transition cursor-pointer mt-2"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}