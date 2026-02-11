'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useConfidenceSettings } from '@/hooks/useConfidenceSettings';
import { AISettingsTab } from './AISettingsTab';
import { CONFIDENCE_FIELDS } from '@/lib/types';
import type { ConfidenceFieldName, ConfidenceFieldSettings } from '@/lib/types';

const FIELD_LABELS: Record<ConfidenceFieldName, string> = {
  title: 'Titulo',
  location: 'Ubicacion (Pueblo)',
  description: 'Descripcion',
  summary: 'Resumen',
  category: 'Categoria',
  siteVisitDate: 'Fecha de Visita',
  siteVisitTime: 'Hora de Visita',
  visitLocation: 'Lugar de Visita',
  visitRequirements: 'Requisitos de Visita',
  contactName: 'Nombre de Contacto',
  contactPhone: 'Telefono de Contacto',
  biddingCloseDate: 'Fecha de Cierre',
  biddingCloseTime: 'Hora de Cierre',
  estimatedValue: 'Valor Estimado',
};

const CATEGORY_COLORS: Record<string, string> = {
  critical: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  optional: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  ignored: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const DEFAULT_SETTINGS: ConfidenceFieldSettings = {
  critical: ['location', 'description', 'biddingCloseDate', 'contactPhone'],
  optional: [
    'title',
    'summary',
    'category',
    'siteVisitDate',
    'siteVisitTime',
    'visitLocation',
    'contactName',
    'biddingCloseTime',
    'estimatedValue',
  ],
  ignored: [],
};

type FieldCategory = 'critical' | 'optional' | 'ignored';
type TabId = 'confidence' | 'ai';

function getFieldCategory(
  field: ConfidenceFieldName,
  settings: ConfidenceFieldSettings
): FieldCategory {
  if (settings.critical.includes(field)) return 'critical';
  if (settings.optional.includes(field)) return 'optional';
  return 'ignored';
}

interface ConfidenceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConfidenceSettingsDialog({
  open,
  onOpenChange,
}: ConfidenceSettingsDialogProps) {
  const { settings, loading, saving, save } = useConfidenceSettings();
  const [draft, setDraft] = useState<ConfidenceFieldSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<TabId>('confidence');

  // Sync draft when settings load or dialog opens
  useEffect(() => {
    if (settings && open) {
      setDraft(settings);
    }
  }, [settings, open]);

  // Reset tab when dialog opens
  useEffect(() => {
    if (open) setActiveTab('confidence');
  }, [open]);

  const handleCategoryChange = (field: ConfidenceFieldName, newCategory: FieldCategory) => {
    setDraft((prev) => {
      const next: ConfidenceFieldSettings = {
        critical: prev.critical.filter((f) => f !== field),
        optional: prev.optional.filter((f) => f !== field),
        ignored: prev.ignored.filter((f) => f !== field),
      };
      next[newCategory].push(field);
      return next;
    });
  };

  const handleReset = () => {
    setDraft(DEFAULT_SETTINGS);
  };

  const handleSave = async () => {
    const ok = await save(draft);
    if (ok) {
      toast.success('Configuracion de confianza guardada');
      onOpenChange(false);
    } else {
      toast.error('Error al guardar configuracion');
    }
  };

  const hasChanges =
    settings &&
    JSON.stringify({ critical: [...draft.critical].sort(), optional: [...draft.optional].sort(), ignored: [...draft.ignored].sort() }) !==
      JSON.stringify({ critical: [...settings.critical].sort(), optional: [...settings.optional].sort(), ignored: [...settings.ignored].sort() });

  const TABS: { id: TabId; label: string }[] = [
    { id: 'confidence', label: 'Confianza' },
    { id: 'ai', label: 'Instrucciones AI' },
  ];

  return (
    <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>Configuracion</DialogTitle>
          <DialogDescription>
            {activeTab === 'confidence'
              ? 'Clasifica cada campo como Critico (60% peso), Opcional (40% peso) o Ignorado.'
              : 'Personaliza como el AI extrae datos de los PDFs.'}
            {' '}Cambios aplican solo a futuras extracciones.
          </DialogDescription>
        </DialogHeader>

        {/* Tab buttons */}
        <div className="flex gap-1 border-b pb-0 -mb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-t-md border border-b-0 transition-colors ${
                activeTab === tab.id
                  ? 'bg-background text-foreground border-border -mb-px'
                  : 'bg-muted/50 text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'confidence' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-2 font-medium">Campo</th>
                      <th className="text-left py-2 font-medium">Clasificacion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CONFIDENCE_FIELDS.map((field) => {
                      const category = getFieldCategory(field, draft);
                      return (
                        <tr key={field} className="border-b last:border-0">
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                                  category === 'critical'
                                    ? 'bg-emerald-500'
                                    : category === 'optional'
                                      ? 'bg-blue-500'
                                      : 'bg-gray-400'
                                }`}
                              />
                              <span className={category === 'ignored' ? 'text-muted-foreground' : ''}>
                                {FIELD_LABELS[field]}
                              </span>
                            </div>
                          </td>
                          <td className="py-2">
                            <select
                              className={`rounded-md border px-2 py-1 text-xs font-medium ${CATEGORY_COLORS[category]}`}
                              value={category}
                              onChange={(e) =>
                                handleCategoryChange(field, e.target.value as FieldCategory)
                              }
                              disabled={saving}
                            >
                              <option value="critical">Critico</option>
                              <option value="optional">Opcional</option>
                              <option value="ignored">Ignorado</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleReset} disabled={saving || loading}>
                Restablecer
              </Button>
              <Button onClick={handleSave} disabled={saving || loading || !hasChanges}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </>
        )}

        {activeTab === 'ai' && (
          <div className="overflow-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-2">
            <AISettingsTab />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
