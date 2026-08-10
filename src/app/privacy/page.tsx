import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | The Nucleus - Marketing',
  description: 'What the field mobile app collects, why, and how it is used.',
};

const LAST_UPDATED = '10 August 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

/**
 * Public privacy policy for the field mobile app ("The Nucleus - Marketing").
 * Deliberately outside the (console) route group so it's reachable with no
 * sign-in: App Store / Play Store listings need a stable, public URL to link
 * to. Every claim here is grounded in what the mobile app actually does
 * (see app.json's permission strings and the lib/ modules); nothing here
 * should describe a capability the app doesn't have.
 */
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-copper">The Nucleus - Marketing</p>
      <h1 className="mt-2 text-3xl font-bold text-ink">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated {LAST_UPDATED}</p>

      <p className="mt-6 text-[15px] leading-relaxed text-ink-soft">
        This policy covers the <strong>The Nucleus - Marketing</strong> mobile app, used by field
        staff to log site visits and by admins to manage assignments. It explains exactly what
        the app accesses on your device, what data it sends to our systems, and why.
      </p>

      <Section title="Account information">
        <p>
          You sign in with an email/password or Google account, managed by our backend provider,
          Supabase. We store your email address, display name, phone number (if you add one), and
          your role (field staff or admin). This identifies who logged a visit or who an area was
          assigned to.
        </p>
      </Section>

      <Section title="Location">
        <p>
          When you log a visit, the app reads your device&apos;s GPS location <strong>only while
          the app is open and in use</strong>, never in the background. This confirms you were
          physically at (or near) the place you say you visited. We store the coordinates and
          timestamp of each visit against your account.
        </p>
      </Section>

      <Section title="Camera and photos">
        <p>
          You can attach photos to a visit as evidence, either by taking a new photo or choosing
          one from your library. Photos are uploaded to a private cloud storage bucket that only
          you and your organization&apos;s admins can access. They are not public and are not
          used for facial recognition or any other automated analysis.
        </p>
        <p>
          The app also requests photo-library access to let you save images (e.g. a photo an
          admin shared back) to your device.
        </p>
      </Section>

      <Section title="Microphone and voice dictation">
        <p>
          Visit notes can optionally be dictated instead of typed. Speech-to-text happens using
          your device&apos;s own operating system, and audio is not recorded, uploaded, or stored
          by us. Only the resulting text you choose to keep is saved as part of your visit notes.
        </p>
      </Section>

      <Section title="Notifications">
        <p>
          With your permission, the app registers your device for push notifications (e.g. when
          you&apos;re assigned a new area), delivered through Expo&apos;s push notification
          service. You can disable notifications at any time in your device settings.
        </p>
      </Section>

      <Section title="Field forms (Google Forms)">
        <p>
          Some visits require filling out a Google Form chosen by your admin. The form opens
          inside the app; anything you submit goes directly to Google Forms/Sheets under your
          organization&apos;s Google account, governed by Google&apos;s own privacy policy for
          that content. Separately, we keep a record of which visit a form submission corresponds
          to, so admins can verify who submitted what and when.
        </p>
      </Section>

      <Section title="What we don't do">
        <ul className="list-disc space-y-1 pl-5">
          <li>We don&apos;t track your location in the background or outside the app.</li>
          <li>We don&apos;t use facial recognition or any biometric matching on your photos.</li>
          <li>We don&apos;t sell your data or share it with advertisers.</li>
          <li>We don&apos;t use third-party analytics or ad-tracking SDKs in the app.</li>
        </ul>
      </Section>

      <Section title="Data retention and deletion">
        <p>
          Your account and visit records are retained for as long as your organization uses the
          app, for attendance and audit purposes. To request deletion of your account or data,
          contact your organization&apos;s admin, or reach us directly (below).
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy or your data can be sent to{' '}
          <a href="mailto:info@thenucleus.in" className="font-semibold text-copper hover:underline">
            info@thenucleus.in
          </a>
          .
        </p>
      </Section>
    </main>
  );
}
