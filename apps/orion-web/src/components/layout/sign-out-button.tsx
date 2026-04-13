"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline dark:hover:text-slate-200"
    >
      Uitloggen
    </button>
  );
}
