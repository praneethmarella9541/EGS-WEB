'use client';

import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from 'lucide-react';
import { Toggle } from '@/components/ui';
import type { EditorBlock, EditorBlockKind } from '@/lib/google-forms-editor-model';

/** The question variant of EditorBlock (the only member with `required`). */
type QuestionBlock = Extract<EditorBlock, { required: boolean }>;

export function blockLabel(kind: EditorBlockKind): string {
  switch (kind) {
    case 'short_text':
      return 'Short answer';
    case 'paragraph':
      return 'Paragraph';
    case 'multiple_choice':
      return 'Multiple choice';
    case 'checkboxes':
      return 'Checkboxes';
    case 'dropdown':
      return 'Dropdown';
    case 'linear_scale':
      return 'Linear scale';
    case 'date':
      return 'Date';
    case 'time':
      return 'Time';
    case 'section':
      return 'Section';
    case 'text_block':
      return 'Title & description';
    case 'unsupported':
      return 'Unsupported';
    default:
      return 'Question';
  }
}

export function BlockCard({
  block,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  onDuplicate,
}: {
  block: EditorBlock;
  index: number;
  total: number;
  onChange: (patch: Partial<EditorBlock>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
}) {
  const isStructural =
    block.kind === 'section' || block.kind === 'text_block' || block.kind === 'unsupported';

  return (
    <div
      className={`card border-l-4 p-5 ${
        block.kind === 'section' || block.kind === 'text_block'
          ? 'border-l-ink'
          : 'border-l-copper'
      }`}
    >
      <div className="mb-4 flex items-center gap-1">
        <span className="rounded-md bg-bg px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
          {blockLabel(block.kind)}
        </span>
        <span className="flex-1" />
        <button
          onClick={() => onMove(-1)}
          disabled={index === 0}
          className="rounded-lg p-1.5 text-ink-soft transition hover:bg-line-soft disabled:opacity-30"
          aria-label="Move up"
        >
          <ArrowUp className="size-4" />
        </button>
        <button
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          className="rounded-lg p-1.5 text-ink-soft transition hover:bg-line-soft disabled:opacity-30"
          aria-label="Move down"
        >
          <ArrowDown className="size-4" />
        </button>
        {block.kind !== 'unsupported' ? (
          <button
            onClick={onDuplicate}
            className="rounded-lg p-1.5 text-ink-soft transition hover:bg-line-soft"
            aria-label="Duplicate"
          >
            <Copy className="size-4" />
          </button>
        ) : null}
        <button
          onClick={onRemove}
          className="rounded-lg p-1.5 text-danger transition hover:bg-danger/10"
          aria-label="Delete"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {block.kind === 'unsupported' ? (
        <p className="mb-4 rounded-lg bg-warn/10 px-3 py-2 text-[13px] text-ink-soft">{block.hint}</p>
      ) : null}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <span className="label">Title</span>
          <input
            className="field"
            value={block.title}
            onChange={(e) => onChange({ title: e.target.value } as Partial<EditorBlock>)}
            placeholder={block.kind === 'section' ? 'Section title' : 'Question title'}
          />
        </div>

        <div className="space-y-1.5">
          <span className="label">Help text</span>
          <textarea
            className="field min-h-[4.5rem] resize-y"
            value={block.description}
            onChange={(e) => onChange({ description: e.target.value } as Partial<EditorBlock>)}
            placeholder="Optional description"
          />
        </div>

        {!isStructural ? (
          <div className="border-t border-line pt-3">
            <Toggle
              label="Required"
              checked={'required' in block ? Boolean(block.required) : false}
              onChange={(v) => onChange({ required: v } as Partial<EditorBlock>)}
            />
          </div>
        ) : null}

        {block.kind === 'multiple_choice' ||
        block.kind === 'checkboxes' ||
        block.kind === 'dropdown' ? (
          <ChoiceOptionsEditor block={block} onChange={onChange} />
        ) : null}

        {block.kind === 'linear_scale' ? (
          <LinearScaleEditor block={block} onChange={onChange} />
        ) : null}

        {block.kind === 'date' ? (
          <div className="space-y-2.5 border-t border-line pt-3">
            <Toggle
              label="Include year"
              checked={block.dateIncludeYear !== false}
              onChange={(v) => onChange({ dateIncludeYear: v } as Partial<EditorBlock>)}
            />
            <Toggle
              label="Include time"
              checked={Boolean(block.dateIncludeTime)}
              onChange={(v) => onChange({ dateIncludeTime: v } as Partial<EditorBlock>)}
            />
          </div>
        ) : null}

        {block.kind === 'time' ? (
          <div className="border-t border-line pt-3">
            <Toggle
              label="Duration (elapsed time)"
              checked={Boolean(block.timeDuration)}
              onChange={(v) => onChange({ timeDuration: v } as Partial<EditorBlock>)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChoiceOptionsEditor({
  block,
  onChange,
}: {
  block: QuestionBlock;
  onChange: (patch: Partial<EditorBlock>) => void;
}) {
  const opts = block.choiceOptions || [];
  return (
    <div className="space-y-2 border-t border-line pt-3">
      <span className="label">Options</span>
      {opts.map((opt, j) => (
        <div key={j} className="flex items-center gap-2">
          <input
            className="field"
            value={opt}
            onChange={(e) => {
              const next = [...opts];
              next[j] = e.target.value;
              onChange({ choiceOptions: next } as Partial<EditorBlock>);
            }}
            placeholder={`Option ${j + 1}`}
          />
          <button
            onClick={() =>
              onChange({ choiceOptions: opts.filter((_, k) => k !== j) } as Partial<EditorBlock>)
            }
            className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-danger/10 hover:text-danger"
            aria-label={`Remove option ${j + 1}`}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          onChange({
            choiceOptions: [...opts, `Option ${opts.length + 1}`],
          } as Partial<EditorBlock>)
        }
        className="flex items-center gap-1.5 text-[13px] font-semibold text-copper hover:underline"
      >
        <Plus className="size-4" />
        Add option
      </button>
      <div className="pt-1">
        <Toggle
          label="Shuffle option order"
          checked={Boolean(block.shuffle)}
          onChange={(v) => onChange({ shuffle: v } as Partial<EditorBlock>)}
        />
      </div>
    </div>
  );
}

function LinearScaleEditor({
  block,
  onChange,
}: {
  block: QuestionBlock;
  onChange: (patch: Partial<EditorBlock>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
      <div className="space-y-1.5">
        <span className="label">Low</span>
        <input
          className="field"
          type="number"
          value={String(block.scaleLow ?? 1)}
          onChange={(e) =>
            onChange({ scaleLow: parseInt(e.target.value, 10) || 0 } as Partial<EditorBlock>)
          }
        />
      </div>
      <div className="space-y-1.5">
        <span className="label">High</span>
        <input
          className="field"
          type="number"
          value={String(block.scaleHigh ?? 5)}
          onChange={(e) =>
            onChange({ scaleHigh: parseInt(e.target.value, 10) || 0 } as Partial<EditorBlock>)
          }
        />
      </div>
      <div className="space-y-1.5">
        <span className="label">Low label</span>
        <input
          className="field"
          value={block.scaleLowLabel || ''}
          onChange={(e) => onChange({ scaleLowLabel: e.target.value } as Partial<EditorBlock>)}
          placeholder="e.g. Poor"
        />
      </div>
      <div className="space-y-1.5">
        <span className="label">High label</span>
        <input
          className="field"
          value={block.scaleHighLabel || ''}
          onChange={(e) => onChange({ scaleHighLabel: e.target.value } as Partial<EditorBlock>)}
          placeholder="e.g. Excellent"
        />
      </div>
    </div>
  );
}
