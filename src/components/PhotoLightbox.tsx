'use client';

/* eslint-disable @next/next/no-img-element -- signed GCS URLs are short-lived and
   host-varied; next/image would need remotePatterns and would proxy bytes for no gain. */

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { downloadPhoto } from '@/lib/visits';
import { Spinner, errMsg, useToast } from '@/components/ui';

export function PhotoLightbox({
  urls,
  onClose,
}: {
  urls: string[] | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [index, setIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [urls]);

  useEffect(() => {
    if (!urls) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, urls.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [urls, onClose]);

  if (!urls || urls.length === 0) return null;

  async function save() {
    if (!urls) return;
    setDownloading(true);
    try {
      await downloadPhoto(urls[index], `visit-photo-${Date.now()}.jpg`);
    } catch (e) {
      toast('error', 'Could not save photo', errMsg(e, 'Please try again.'));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/90"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex items-center justify-between p-4">
        <span className="text-sm font-medium text-white/70">
          {index + 1} / {urls.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void save()}
            disabled={downloading}
            className="rounded-lg p-2 text-white transition hover:bg-white/10"
            aria-label="Download photo"
          >
            {downloading ? <Spinner className="size-5 text-white" /> : <Download className="size-5" />}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white transition hover:bg-white/10"
            aria-label="Close"
          >
            <X className="size-6" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 px-4 pb-8">
        {urls.length > 1 ? (
          <button
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            disabled={index === 0}
            className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:opacity-25"
            aria-label="Previous photo"
          >
            <ChevronLeft className="size-6" />
          </button>
        ) : null}
        <img
          src={urls[index]}
          alt={`Visit photo ${index + 1}`}
          className="max-h-full min-h-0 max-w-full rounded-lg object-contain"
        />
        {urls.length > 1 ? (
          <button
            onClick={() => setIndex((i) => Math.min(i + 1, urls.length - 1))}
            disabled={index === urls.length - 1}
            className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:opacity-25"
            aria-label="Next photo"
          >
            <ChevronRight className="size-6" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
