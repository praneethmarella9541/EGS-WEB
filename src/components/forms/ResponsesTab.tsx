'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, Download, Inbox } from 'lucide-react';
import { formsApi } from '@/lib/forms-api';
import {
  buildQuestionTitleMap,
  formatAnswer,
  responsesToCsv,
  summarizeResponses,
  type FormResponse,
} from '@/lib/form-responses';
import type { EditorBlock } from '@/lib/google-forms-editor-model';
import { exportResponsesCsv } from '@/lib/forms-actions';
import { getIncludeVisitContext } from '@/lib/settings';
import { listVisitsForForm, matchVisitsToResponses, type MatchableVisit } from '@/lib/visit-match';
import { CenteredSpinner, EmptyState, Spinner, useToast } from '@/components/ui';

/**
 * One category of a summary, drawn as a single-hue horizontal bar.
 *
 * Counts of answers per option are magnitude on one series, so bars beat the
 * pie the mobile app draws: they stay readable past ~6 options, need no
 * categorical palette (and so no colorblind-safety trade-off), and put the
 * label, count and share on one line instead of in a legend.
 */
function SummaryBar({ label, count, pctOfTotal, max }: {
  label: string;
  count: number;
  pctOfTotal: number;
  max: number;
}) {
  const width = max > 0 ? Math.max((count / max) * 100, 1.5) : 0;
  return (
    <div className="group">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] text-ink" title={label}>
          {label}
        </span>
        <span className="shrink-0 text-xs font-semibold text-ink-soft tabular-nums">
          {count} · {pctOfTotal}%
        </span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-line-soft">
        <div
          className="h-2 rounded-r-[4px] bg-copper transition-[width] duration-300 group-hover:bg-copper-dark"
          style={{ width: `${width}%`, borderTopLeftRadius: 2, borderBottomLeftRadius: 2 }}
        />
      </div>
    </div>
  );
}

export function ResponsesTab({
  formId,
  editorBlocks,
  formTitle,
  isQuiz,
}: {
  formId: string;
  editorBlocks: EditorBlock[];
  formTitle: string;
  isQuiz: boolean;
}) {
  const toast = useToast();
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'summary' | 'individual'>('summary');
  const [showVerified, setShowVerified] = useState(false);
  const [verifiedVisits, setVerifiedVisits] = useState<MatchableVisit[]>([]);

  const load = useCallback(
    async (append = false, pageToken?: string) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await formsApi.responses(formId, { pageToken, pageSize: 50 });
        const batch = data.responses ?? [];
        setResponses((prev) => (append ? [...prev, ...batch] : batch));
        setNextPageToken(data.nextPageToken);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load responses');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [formId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    getIncludeVisitContext()
      .then(setShowVerified)
      .catch(() => setShowVerified(false));
  }, []);

  useEffect(() => {
    if (!showVerified) {
      setVerifiedVisits([]);
      return;
    }
    listVisitsForForm(formId)
      .then(setVerifiedVisits)
      .catch(() => setVerifiedVisits([]));
  }, [formId, showVerified]);

  const verifiedByResponseId = useMemo(
    () =>
      showVerified
        ? matchVisitsToResponses(responses, verifiedVisits)
        : new Map<string, MatchableVisit>(),
    [showVerified, responses, verifiedVisits]
  );

  const summaries = useMemo(
    () => summarizeResponses(responses, editorBlocks),
    [responses, editorBlocks]
  );
  const questionTitles = useMemo(() => buildQuestionTitleMap(editorBlocks), [editorBlocks]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function handleExportCsv() {
    const safeName = (formTitle.trim() || 'form').replace(/[^\w-]+/g, '_').slice(0, 40);
    exportResponsesCsv(
      `${safeName}-responses.csv`,
      responsesToCsv(responses, editorBlocks, showVerified ? verifiedByResponseId : undefined)
    );
    toast('success', 'CSV downloaded');
  }

  if (loading && responses.length === 0) return <CenteredSpinner label="Loading responses…" />;

  if (error) {
    return (
      <div className="card space-y-3 p-5">
        <p className="text-sm text-danger">{error}</p>
        <button className="btn-ghost" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-line bg-surface p-1">
          {(['summary', 'individual'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold capitalize transition ${
                view === v ? 'bg-copper text-white' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {responses.length > 0 ? (
          <button className="btn-ghost" onClick={handleExportCsv}>
            <Download className="size-4" />
            Export CSV
          </button>
        ) : null}
      </div>

      {responses.length === 0 ? (
        <div className="card">
          <EmptyState icon={Inbox} title="No responses yet" />
        </div>
      ) : (
        <>
          <p className="text-[13px] text-muted">
            {responses.length} {responses.length === 1 ? 'response' : 'responses'}
            {nextPageToken ? ' · load more for a complete export' : ''}
          </p>

          {view === 'summary' ? (
            summaries.length === 0 ? (
              <p className="text-sm text-muted">No question data to summarize.</p>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {summaries.map((s) => {
                  const max =
                    s.type === 'text' ? 0 : Math.max(1, ...s.buckets.map((b) => b.count));
                  return (
                    <div key={s.questionId} className="card p-5">
                      <h3 className="font-semibold text-ink">{s.title}</h3>
                      {s.type === 'scale' && s.average != null ? (
                        <p className="mt-1 text-[13px] text-ink-soft">Average: {s.average}</p>
                      ) : null}

                      {s.type === 'text' ? (
                        <div className="mt-3 space-y-1.5">
                          {s.samples.length === 0 ? (
                            <p className="text-sm text-muted">No text answers</p>
                          ) : (
                            s.samples.slice(0, 50).map((sample, i) => (
                              <p
                                key={i}
                                className="rounded-lg bg-bg px-3 py-2 text-[13px] leading-snug text-ink"
                              >
                                {sample}
                              </p>
                            ))
                          )}
                          {s.samples.length > 50 ? (
                            <p className="text-xs text-muted">+{s.samples.length - 50} more</p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {s.buckets.map((b) => (
                            <SummaryBar
                              key={b.label}
                              label={b.label}
                              count={b.count}
                              pctOfTotal={s.total > 0 ? Math.round((b.count / s.total) * 100) : 0}
                              max={max}
                            />
                          ))}
                        </div>
                      )}

                      <p className="mt-4 text-xs text-muted">{s.total} responses</p>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="space-y-2">
              {responses.map((resp, idx) => {
                const isExpanded = expanded.has(resp.responseId);
                const answerEntries = Object.entries(resp.answers ?? {});
                const when = resp.lastSubmittedTime || resp.createTime;
                const verified = verifiedByResponseId.get(resp.responseId);
                return (
                  <div key={resp.responseId} className="card overflow-hidden">
                    <button
                      onClick={() => toggleExpand(resp.responseId)}
                      className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-line-soft"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-copper-light text-xs font-bold text-copper">
                        {idx + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">
                          {when
                            ? format(new Date(when), 'MMM d, yyyy h:mm a')
                            : `Response ${idx + 1}`}
                        </span>
                        {resp.respondentEmail ? (
                          <span className="block truncate text-xs text-ink-soft">
                            {resp.respondentEmail}
                          </span>
                        ) : null}
                        {showVerified && verified ? (
                          <span className="block truncate text-xs font-medium text-ok">
                            ✓ {verified.userLabel} · {verified.placeLabel}
                          </span>
                        ) : null}
                        {isQuiz && resp.totalScore != null ? (
                          <span className="block text-xs font-semibold text-copper">
                            Score: {resp.totalScore}
                          </span>
                        ) : null}
                      </span>
                      <ChevronDown
                        className={`size-4 shrink-0 text-muted transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isExpanded ? (
                      <div className="space-y-3 border-t border-line p-4">
                        {answerEntries.length === 0 ? (
                          <p className="text-sm text-muted">No answers recorded</p>
                        ) : (
                          answerEntries.map(([qId, ans]) => (
                            <div key={qId}>
                              <p className="text-xs font-semibold text-muted">
                                {questionTitles.get(qId) || qId}
                              </p>
                              <p className="mt-0.5 text-sm text-ink">{formatAnswer(ans)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {nextPageToken ? (
            <button
              className="btn-ghost w-full"
              onClick={() => void load(true, nextPageToken)}
              disabled={loadingMore}
            >
              {loadingMore ? <Spinner className="size-4" /> : 'Load more responses'}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
