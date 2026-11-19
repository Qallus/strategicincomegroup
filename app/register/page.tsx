import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = { title: "Create an Account" };

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Client registration"
      title="Create your account"
      description="Set up secure access to Strategic Income Group. Our team will connect your account to your planning relationship."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
