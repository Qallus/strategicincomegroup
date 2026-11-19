import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { TwoFactorForm } from "@/components/auth/two-factor-form";

export const metadata = { title: "Two-Factor Authentication" };

export default function TwoFactorPage() {
  return (
    <AuthShell eyebrow="Two-factor authentication" title="Verify it’s you" description="Enter the 6-digit code from your authenticator app to finish signing in.">
      <Suspense>
        <TwoFactorForm />
      </Suspense>
    </AuthShell>
  );
}
