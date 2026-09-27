"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, type SignInState } from "@/lib/auth/actions";
import { buttonVariants } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/cn";

const initialState: SignInState = {};

const inputStyles =
  "mt-1.5 h-11 w-full rounded-md border border-border-strong px-3 text-body " +
  "focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(
    signInAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="text-label font-semibold text-ink">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputStyles}
        />
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="password" className="text-label font-semibold text-ink">
            Password
          </label>
          <Link href="/forgot-password" className="text-body-sm font-medium text-pine underline underline-offset-2">
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
          className={inputStyles.replace("mt-1.5 ", "")}
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className={cn(buttonVariants({ size: "lg" }), "w-full")}
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
      <Link
        href="/"
        className="flex min-h-11 w-full items-center justify-center rounded-md border border-border-strong bg-white px-4 text-body-sm font-medium text-pine transition-colors hover:bg-sage"
      >
        Back to the main website
      </Link>
    </form>
  );
}
