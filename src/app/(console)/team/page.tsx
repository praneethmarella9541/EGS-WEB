'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, RefreshCw, Trash2, UserPlus, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import {
  Avatar,
  CenteredSpinner,
  ConfirmDialog,
  EmptyState,
  Modal,
  Spinner,
  errMsg,
  useToast,
} from '@/components/ui';
import { adminUsers, type TeamMember } from '@/lib/admin-users';

export default function TeamPage() {
  const toast = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mobile, setMobile] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const { members } = await adminUsers.list();
        setMembers(members);
      } catch (e) {
        toast('error', 'Could not load users', errMsg(e, 'Please try again.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setEmail('');
    setName('');
    setPassword('');
    setMobile('');
    setShowPassword(false);
    setFormOpen(true);
  }

  function openReset(m: TeamMember) {
    setEditing(m);
    setPassword('');
    setShowPassword(false);
    setFormOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();

    // Editing an existing user is password-only — that's all the mobile app's
    // edit form exposes, and the console keeps the same contract.
    if (editing) {
      if (!password) return toast('error', 'Enter a new password.');
      setSaving(true);
      try {
        await adminUsers.update({ id: editing.id, password });
        setFormOpen(false);
        toast('success', 'Password updated', editing.email);
        await load();
      } catch (e) {
        toast('error', 'Could not update password', errMsg(e, 'Please try again.'));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!email.trim()) return toast('error', 'Email is required.');
    if (!password) return toast('error', 'Password is required for new users.');
    setSaving(true);
    try {
      await adminUsers.create({
        email: email.trim().toLowerCase(),
        password,
        display_name: name.trim() || null,
        mobile_phone: mobile.trim() || null,
      });
      setFormOpen(false);
      toast('success', 'User created', email.trim().toLowerCase());
      await load();
    } catch (e) {
      toast('error', 'Could not create user', errMsg(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await adminUsers.remove(deleteTarget.id);
      toast('success', 'User deleted', deleteTarget.email);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast('error', 'Delete failed', errMsg(e, 'Please try again.'));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="Field accounts that can sign in to the mobile app."
        actions={
          <>
            <button className="btn-ghost" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button className="btn-primary" onClick={openAdd}>
              <UserPlus className="size-4" />
              New user
            </button>
          </>
        }
      />

      <div className="p-5 sm:p-8">
        {loading ? (
          <CenteredSpinner />
        ) : members.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Users}
              title="No field users yet"
              body="Create the first account — they can sign in to the mobile app straight away."
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {members.map((m) => (
              <div key={m.id} className="card flex items-center gap-3 p-4">
                <Avatar name={m.display_name || m.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">
                    {m.display_name || m.email.split('@')[0]}
                  </p>
                  <p className="truncate text-[13px] text-ink-soft">{m.email}</p>
                  {m.mobile_phone ? (
                    <p className="truncate text-xs text-muted">{m.mobile_phone}</p>
                  ) : null}
                  {m.restricted_features.length > 0 ? (
                    <p className="mt-1 truncate text-xs font-medium text-warn">
                      Restricted: {m.restricted_features.join(', ')}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => openReset(m)}
                    className="rounded-lg p-2 text-copper transition hover:bg-copper-light"
                    title="Reset password"
                    aria-label={`Reset password for ${m.email}`}
                  >
                    <KeyRound className="size-4.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(m)}
                    className="rounded-lg p-2 text-danger transition hover:bg-danger/10"
                    title="Delete user"
                    aria-label={`Delete ${m.email}`}
                  >
                    <Trash2 className="size-4.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? 'Reset password' : 'New user'}
      >
        <form onSubmit={save} className="space-y-4">
          {editing ? (
            <div className="rounded-xl bg-copper-light px-4 py-3">
              <p className="font-bold text-ink">
                {editing.display_name || editing.email.split('@')[0]}
              </p>
              <p className="text-[13px] text-ink-soft">{editing.email}</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="label" htmlFor="new-email">
                  Email
                </label>
                <input
                  id="new-email"
                  type="email"
                  className="field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@company.com"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <label className="label" htmlFor="new-name">
                  Display name
                </label>
                <input
                  id="new-name"
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="label" htmlFor="new-password">
              {editing ? 'New password' : 'Password'}
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                className="field pr-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-ink"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {!editing ? (
            <div className="space-y-1.5">
              <label className="label" htmlFor="new-mobile">
                Mobile (optional)
              </label>
              <input
                id="new-mobile"
                className="field"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+91…"
              />
            </div>
          ) : null}

          <button type="submit" className="btn-primary w-full py-3" disabled={saving}>
            {saving ? (
              <Spinner className="size-4 text-white" />
            ) : editing ? (
              'Update password'
            ) : (
              'Create user'
            )}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete user"
        message={deleteTarget?.display_name || deleteTarget?.email}
        warning="This permanently deletes this user and ALL of their data — profile, assignments, attendance and visit records, and every photo they uploaded. This cannot be undone."
        confirmLabel="Delete user"
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
