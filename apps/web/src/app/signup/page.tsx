import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans text-zinc-900">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="mt-2 text-sm text-zinc-500">Get started with SaaSKit today</p>
        </div>

        <SignupForm />

        <div className="my-6 flex items-center">
          <div className="flex-1 border-t border-zinc-200"></div>
          <span className="px-4 text-xs text-zinc-500">or</span>
          <div className="flex-1 border-t border-zinc-200"></div>
        </div>

        <div className="space-y-3">
          <form method="GET" action={`${NEXT_PUBLIC_API_URL}/auth/sso/google`}>
            <button 
              type="submit"
              className="flex w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              Sign up with Google
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
