'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GmailStatus {
  connected: boolean;
  emailAddress: string | null;
  tokenExpiry?: string | null;
}

export function GmailConnectionCard() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/gmail/status');
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/settings/gmail/connect');
      const data = await res.json();
      if (data.success && data.data?.authUrl) {
        window.location.href = data.data.authUrl;
      } else {
        toast.error(data.error || 'Error al conectar Gmail');
      }
    } catch {
      toast.error('Error al conectar Gmail');
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/settings/gmail/disconnect', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setStatus({ connected: false, emailAddress: null });
        toast.success('Gmail desconectado');
      } else {
        toast.error(data.error || 'Error al desconectar Gmail');
      }
    } catch {
      toast.error('Error al desconectar Gmail');
    }
    setDisconnecting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Cuenta de Gmail</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Conecta la cuenta de Gmail donde recibes licitaciones para procesarlas automaticamente.
        </p>
      </div>

      {status?.connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <span className="text-emerald-600 text-lg">✓</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{status.emailAddress}</p>
              <p className="text-xs text-muted-foreground">Conectado</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleConnect}>
              Reconectar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-red-600 hover:text-red-700"
            >
              {disconnecting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Desconectar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3">
            <span className="text-muted-foreground text-lg">📧</span>
            <div>
              <p className="text-sm text-muted-foreground">No hay cuenta conectada</p>
            </div>
          </div>
          <Button onClick={handleConnect} size="sm">
            Conectar Gmail
          </Button>
        </div>
      )}
    </div>
  );
}
