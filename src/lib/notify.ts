import { callEdge } from './edge';

/**
 * Best-effort push to a field user when they're assigned area(s). Never throws —
 * a push failure must not break the assignment flow.
 */
export async function notifyAssignmentCreated(
  userId: string,
  count: number,
  dateKey: string
): Promise<void> {
  try {
    await callEdge('notify-assignment', {
      userId,
      title: 'New assignment',
      body:
        count > 1
          ? `You've been assigned ${count} areas for ${dateKey}.`
          : `You've been assigned an area for ${dateKey}.`,
      data: { type: 'assignment' },
    });
  } catch (e) {
    console.warn('[notify] assignment push failed:', e instanceof Error ? e.message : e);
  }
}
