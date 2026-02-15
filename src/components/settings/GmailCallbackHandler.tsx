'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

export function GmailCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('gmail_connected') === 'true') {
      toast.success('Gmail conectado exitosamente');
      router.replace('/settings', { scroll: false });
    } else if (searchParams.get('gmail_error')) {
      toast.error('Error al conectar Gmail: ' + searchParams.get('gmail_error'));
      router.replace('/settings', { scroll: false });
    }
  }, [searchParams, router]);

  return null;
}
