import type { Metadata } from "next";
import { authProviders } from "@/lib/config";
import { requireUser } from "@/lib/auth/session";
import { DataUnavailableError } from "@/lib/data/reference";
import { getUserStore } from "@/lib/data/user-store";
import { ProfileForm } from "@/components/profile/profile-form";
import { PhoneVerification } from "@/components/profile/phone-verification";
import { Notice, Panel } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const user = await requireUser("/profile");
  const sp = await searchParams;
  let profile = null;
  let loadError: string | null = null;
  try {
    profile = await (await getUserStore()).getProfile(user.id);
  } catch (e) {
    loadError = e instanceof DataUnavailableError ? e.userMessage : "Your profile couldn't be loaded.";
  }
  const onboarding = !profile && !loadError;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">{onboarding ? "Set up your profile" : "My profile"}</h1>
        <p className="max-w-prose text-ink-soft">
          {onboarding
            ? "A few details let us prefill searches for you. Only the fields marked required are needed — everything else can be skipped."
            : "Changes here are used the next time you search “According to your profile”."}
        </p>
        {user.email && <p className="text-sm text-muted">Signed in as {user.email}</p>}
      </header>

      {sp.welcome && onboarding && (
        <Notice tone="success" title="Account created">
          Next, add your profile essentials.
        </Notice>
      )}

      {loadError ? (
        <Notice tone="error" role="alert" title={loadError}>
          Refresh the page to try again. Nothing has been changed.
        </Notice>
      ) : (
        <>
          <Panel className="space-y-2">
            <h2 className="text-base font-semibold">Phone verification</h2>
            <PhoneVerification
              authMode={user.authMode}
              phoneEnabled={authProviders.phone}
              verifiedPhone={user.phoneVerified ? user.phone : null}
            />
          </Panel>
          <ProfileForm profile={profile} authPhone={user.phone} onboarding={onboarding} />
        </>
      )}
    </div>
  );
}
