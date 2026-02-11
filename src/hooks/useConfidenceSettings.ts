'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ConfidenceFieldSettings } from '@/lib/types';

export function useConfidenceSettings() {
  const [settings, setSettings] = useState<ConfidenceFieldSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/confidence');
      const result = await response.json();
      if (result.success) {
        setSettings(result.data);
      }
    } catch (error) {
      console.error('Error loading confidence settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (newSettings: ConfidenceFieldSettings): Promise<boolean> => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/confidence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      const result = await response.json();
      if (result.success) {
        setSettings(result.data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error saving confidence settings:', error);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, loading, saving, save, reload: load };
}
