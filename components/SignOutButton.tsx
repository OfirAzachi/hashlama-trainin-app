'use client';

import { LogOut } from 'lucide-react';

import { signOut } from '@/app/login/actions';

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="btn-secondary h-10 w-10 p-0" aria-label="התנתקות">
        <LogOut aria-hidden className="h-4 w-4" />
      </button>
    </form>
  );
}
