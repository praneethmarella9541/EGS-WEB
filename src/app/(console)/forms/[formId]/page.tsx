'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlignLeft,
  ArrowLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Heading,
  Inbox,
  List,
  Minus,
  Plus,
  Settings,
  SlidersHorizontal,
  TextCursorInput,
} from 'lucide-react';
import { BlockCard } from '@/components/forms/BlockCard';
import { ResponsesTab } from '@/components/forms/ResponsesTab';
import { CenteredSpinner, Modal, Spinner, Toggle, errMsg, useToast } from '@/components/ui';
import { copyToClipboard } from '@/lib/forms-actions';
import { formsApi } from '@/lib/forms-api';
import {
  defaultChoiceBlock,
  defaultQuestionBlock,
  duplicateBlock,
  emptyEditorState,
  googleFormToEditorState,
  newSectionBlock,
  newTextBlock,
  type EditorBlock,
  type EditorState,
} from '@/lib/google-forms-editor-model';

type EditorTab = 'questions' | 'responses' | 'settings' | 'preview';

const EMAIL_OPTIONS: { value: EditorState['emailCollection']; label: string }[] = [
  { value: 'DO_NOT_COLLECT', label: 'Do not collect email' },
  { value: 'RESPONDER_INPUT', label: 'Ask for email on form' },
  { value: 'VERIFIED', label: 'Verified email (Workspace)' },
  { value: 'EMAIL_COLLECTION_TYPE_UNSPECIFIED', label: 'Google default' },
];

const ADD_OPTIONS: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  build: () => EditorBlock;
}[] = [
  { label: 'Short answer', icon: TextCursorInput, build: () => defaultQuestionBlock('short_text') },
  { label: 'Paragraph', icon: AlignLeft, build: () => defaultQuestionBlock('paragraph') },
  { label: 'Multiple choice', icon: List, build: () => defaultChoiceBlock('multiple_choice') },
  { label: 'Checkboxes', icon: CheckSquare, build: () => defaultChoiceBlock('checkboxes') },
  { label: 'Dropdown', icon: ChevronDown, build: () => defaultChoiceBlock('dropdown') },
  { label: 'Linear scale', icon: SlidersHorizontal, build: () => defaultQuestionBlock('linear_scale') },
  { label: 'Date', icon: Calendar, build: () => defaultQuestionBlock('date') },
  { label: 'Time', icon: Clock, build: () => defaultQuestionBlock('time') },
  { label: 'Section break', icon: Minus, build: () => newSectionBlock() },
  { label: 'Title & description', icon: Heading, build: () => newTextBlock() },
];

const TABS: { id: EditorTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'questions', label: 'Questions', icon: List },
  { id: 'responses', label: 'Responses', icon: Inbox },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'preview', label: 'Preview', icon: Eye },
];

export default function FormEditorPage() {
  const params = useParams<{ formId: string }>();
  const formId = typeof params.formId === 'string' ? params.formId : '';
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareWarning, setShareWarning] = useState<string | null>(null);
  const [titleWarning, setTitleWarning] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(() => emptyEditorState());
  const [responderUri, setResponderUri] = useState<string | null>(null);
  const [tab, setTab] = useState<EditorTab>('questions');
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    if (!formId) return;
    setLoading(true);
    setError(null);
    setShareWarning(null);
    setTitleWarning(null);
    try {
      const {
        form: data,
        shareWarning: warning,
        titleWarning: titleWarn,
      } = await formsApi.getWithShareStatus(formId);
      setEditor(googleFormToEditorState(data));
      setResponderUri(typeof data.responderUri === 'string' ? data.responderUri : null);
      setShareWarning(warning);
      setTitleWarning(titleWarn);
    } catch (e) {
      setError(errMsg(e, 'Failed to load form'));
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await formsApi.save(formId, editor);
      if (!res?.ok) throw new Error(res?.message || res?.error || 'Save failed');
      if (res.editorState) setEditor(res.editorState as EditorState);
      else if (res.form) setEditor(googleFormToEditorState(res.form));
      if (res.form && typeof res.form.responderUri === 'string') {
        setResponderUri(res.form.responderUri);
      }
      toast('success', 'Saved', res.noChanges ? 'No changes to save.' : 'Form saved to Google.');
    } catch (e) {
      const msg = errMsg(e, 'Save failed');
      setError(msg);
      toast('error', 'Save failed', msg);
    } finally {
      setSaving(false);
    }
  }

  function updateBlock(i: number, patch: Partial<EditorBlock>) {
    setEditor((prev) => {
      const blocks = [...prev.blocks];
      const cur = blocks[i];
      if (!cur) return prev;
      blocks[i] = { ...cur, ...patch } as EditorBlock;
      return { ...prev, blocks };
    });
  }

  function addBlock(build: () => EditorBlock) {
    setEditor((prev) => ({ ...prev, blocks: [...prev.blocks, build()] }));
    setAddOpen(false);
  }

  if (loading) return <CenteredSpinner />;

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="flex items-center gap-3 px-5 py-4 sm:px-8">
          <button
            onClick={() => router.push('/forms')}
            className="rounded-lg p-1.5 text-ink transition hover:bg-line-soft"
            aria-label="Back to forms"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-ink">
            {editor.title?.trim() || 'Untitled form'}
          </h1>
          {responderUri ? (
            <a
              href={responderUri}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost hidden sm:inline-flex"
            >
              <ExternalLink className="size-4" />
              Open
            </a>
          ) : null}
          <button className="btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? <Spinner className="size-4 text-white" /> : 'Save'}
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto px-5 pb-2 sm:px-8">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${
                tab === id ? 'bg-copper-light text-copper' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 p-5 sm:p-8">
        {error ? (
          <p className="rounded-xl border border-danger/30 bg-danger/5 p-3.5 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        {shareWarning ? (
          <p className="rounded-xl border border-warn/30 bg-warn/5 p-3.5 text-[13px] text-ink-soft">
            Field users may hit a Google sign-in wall opening this form: {shareWarning}
          </p>
        ) : null}
        {titleWarning ? (
          <p className="rounded-xl border border-warn/30 bg-warn/5 p-3.5 text-[13px] text-ink-soft">
            Could not fix this form&apos;s Drive file name (it&apos;ll keep showing as &quot;Untitled
            form&quot; in Google Forms/Drive): {titleWarning}
          </p>
        ) : null}

        {tab === 'questions' ? (
          <>
            <div className="card overflow-hidden">
              <div className="h-2 bg-copper" />
              <div className="space-y-2 p-5">
                <input
                  className="w-full border-none bg-transparent text-2xl font-bold text-ink outline-none placeholder:text-muted"
                  value={editor.title}
                  onChange={(e) => setEditor((s) => ({ ...s, title: e.target.value }))}
                  placeholder="Untitled form"
                />
                <textarea
                  className="w-full resize-y border-none bg-transparent text-sm text-ink-soft outline-none placeholder:text-muted"
                  value={editor.description}
                  onChange={(e) => setEditor((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Form description"
                  rows={2}
                />
              </div>
            </div>

            {editor.blocks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted">
                Add your first question below.
              </p>
            ) : null}

            {editor.blocks.map((block, i) => (
              <BlockCard
                key={block.key}
                block={block}
                index={i}
                total={editor.blocks.length}
                onChange={(patch) => updateBlock(i, patch)}
                onRemove={() =>
                  setEditor((prev) => ({
                    ...prev,
                    blocks: prev.blocks.filter((_, j) => j !== i),
                  }))
                }
                onMove={(dir) =>
                  setEditor((prev) => {
                    const j = i + dir;
                    if (j < 0 || j >= prev.blocks.length) return prev;
                    const blocks = [...prev.blocks];
                    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
                    return { ...prev, blocks };
                  })
                }
                onDuplicate={() =>
                  setEditor((prev) => {
                    const block = prev.blocks[i];
                    if (!block) return prev;
                    const blocks = [...prev.blocks];
                    blocks.splice(i + 1, 0, duplicateBlock(block));
                    return { ...prev, blocks };
                  })
                }
              />
            ))}

            <button
              onClick={() => setAddOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-copper py-4 text-sm font-semibold text-copper transition hover:bg-copper-light"
            >
              <Plus className="size-4" />
              Add question
            </button>
          </>
        ) : tab === 'responses' ? (
          <ResponsesTab
            formId={formId}
            editorBlocks={editor.blocks}
            formTitle={editor.title}
            isQuiz={editor.isQuiz}
          />
        ) : tab === 'preview' ? (
          responderUri ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  className="btn-ghost"
                  onClick={() =>
                    void copyToClipboard(responderUri).then(() => toast('success', 'Link copied'))
                  }
                >
                  <Copy className="size-4" />
                  Copy link
                </button>
                <a href={responderUri} target="_blank" rel="noreferrer" className="btn-ghost">
                  <ExternalLink className="size-4" />
                  Open in Google Forms
                </a>
              </div>
              <iframe
                src={responderUri}
                title="Form preview"
                className="h-[70vh] w-full rounded-xl border border-line bg-surface"
              />
            </div>
          ) : (
            <p className="text-sm text-muted">
              Save the form to generate a responder link for preview.
            </p>
          )
        ) : (
          <div className="card space-y-5 p-5">
            <Toggle
              label="Accepting responses"
              hint="Turn off to close the form to new submissions"
              checked={editor.acceptingResponses}
              onChange={(v) => setEditor((s) => ({ ...s, acceptingResponses: v }))}
            />

            <div className="border-t border-line pt-5">
              <Toggle
                label="Make this a quiz"
                hint="Assign point values and review answers"
                checked={editor.isQuiz}
                onChange={(v) => setEditor((s) => ({ ...s, isQuiz: v }))}
              />
              <p className="mt-2 text-xs text-muted">
                Quiz grading and answer keys are managed in Google Forms. Saving here syncs quiz mode.
              </p>
            </div>

            <div className="space-y-1.5 border-t border-line pt-5">
              <label className="label" htmlFor="email-collection">
                Collect email addresses
              </label>
              <select
                id="email-collection"
                className="field"
                value={editor.emailCollection}
                onChange={(e) =>
                  setEditor((s) => ({
                    ...s,
                    emailCollection: e.target.value as EditorState['emailCollection'],
                  }))
                }
              >
                {EMAIL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {responderUri ? (
              <div className="space-y-2 border-t border-line pt-5">
                <span className="label">Responder link</span>
                <p className="break-all rounded-lg bg-bg px-3 py-2 text-[13px] text-ink-soft">
                  {responderUri}
                </p>
                <div className="flex gap-2">
                  <button
                    className="btn-ghost"
                    onClick={() =>
                      void copyToClipboard(responderUri).then(() => toast('success', 'Link copied'))
                    }
                  >
                    <Copy className="size-4" />
                    Copy link
                  </button>
                  <a href={responderUri} target="_blank" rel="noreferrer" className="btn-ghost">
                    <ExternalLink className="size-4" />
                    Open
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add to form">
        <div className="grid grid-cols-2 gap-2">
          {ADD_OPTIONS.map(({ label, icon: Icon, build }) => (
            <button
              key={label}
              onClick={() => addBlock(build)}
              className="flex items-center gap-2.5 rounded-xl border border-line px-3.5 py-3 text-left text-[13px] font-medium text-ink transition hover:border-copper hover:bg-copper-light"
            >
              <Icon className="size-4 shrink-0 text-copper" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
