"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PARTY_CHECKIN_FLAG_KEY, PARTY_CHECKIN_QUERY_KEY, PARTY_CHECKIN_QUERY_VALUE } from '@/lib/partyCheckIn';

export default function AtPartyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Remember intent so login can mark the user as at_party
    localStorage.setItem(PARTY_CHECKIN_FLAG_KEY, 'true');
    router.replace(`/login?${PARTY_CHECKIN_QUERY_KEY}=${PARTY_CHECKIN_QUERY_VALUE}`);
  }, [router]);

  return (
    <div className="flex min-h-[calc(100vh-150px)] items-center justify-center px-4">
      <div className="space-y-2 text-center">
        <p className="text-lg font-headline">Redirecting to login…</p>
        <p className="text-muted-foreground">We&apos;ll mark you as &quot;At Party&quot; once you sign in.</p>
      </div>
    </div>
  );
}
