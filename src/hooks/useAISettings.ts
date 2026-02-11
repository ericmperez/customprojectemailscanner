'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CorrectionExample } from '@/lib/types';

interface AISettingsState {
  instructions: string;
  examples: CorrectionExample[];
}

export function useAISettings() {
  const [data, setData] = useState<AISettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/ai');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveInstructions = useCallback(async (instructions: string): Promise<boolean> => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions }),
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error saving AI instructions:', error);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const saveExamples = useCallback(async (examples: CorrectionExample[]): Promise<boolean> => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examples }),
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error saving AI examples:', error);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    instructions: data?.instructions ?? '',
    examples: data?.examples ?? [],
    loading,
    saving,
    saveInstructions,
    saveExamples,
    reload: load,
  };
}
