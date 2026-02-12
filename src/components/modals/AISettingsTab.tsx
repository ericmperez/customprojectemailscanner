'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAISettings } from '@/hooks/useAISettings';
import type { VectorExample } from '@/hooks/useAISettings';

const MAX_INSTRUCTIONS = 2000;

const FIELD_LABELS: Record<string, string> = {
  title: 'Titulo',
  location: 'Ubicacion',
  description: 'Descripcion',
  contactName: 'Contacto',
  contactPhone: 'Telefono',
  siteVisitDate: 'Fecha Visita',
  biddingCloseDate: 'Fecha Cierre',
  estimatedValue: 'Valor Estimado',
};

export function AISettingsTab() {
  const {
    instructions,
    vectorExamples,
    loading,
    saving,
    saveInstructions,
    deleteVectorExample,
    clearAllExamples,
  } = useAISettings();
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setDraft(instructions);
  }, [instructions]);

  const handleSaveInstructions = async () => {
    const ok = await saveInstructions(draft);
    if (ok) {
      toast.success('Instrucciones AI guardadas');
    } else {
      toast.error('Error al guardar instrucciones');
    }
  };

  const handleDeleteExample = async (id: string) => {
    const ok = await deleteVectorExample(id);
    if (ok) {
      toast.success('Ejemplo eliminado');
    } else {
      toast.error('Error al eliminar ejemplo');
    }
  };

  const handleClearExamples = async () => {
    const ok = await clearAllExamples();
    if (ok) {
      toast.success('Todos los ejemplos eliminados');
    } else {
      toast.error('Error al limpiar ejemplos');
    }
  };

  const hasInstructionChanges = draft !== instructions;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Custom Instructions */}
      <div>
        <label className="text-sm font-medium">Instrucciones personalizadas</label>
        <p className="text-xs text-muted-foreground mb-2">
          Escribe reglas en lenguaje natural para guiar la extraccion de datos.
        </p>
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={'Ejemplos:\n- Cuando veas "PAS" significa Planta de Agua y Saneamiento\n- Los documentos de la AAA region 05 son de San Juan\n- Siempre incluir el numero de subasta en el titulo'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_INSTRUCTIONS}
          disabled={saving}
        />
        <div className="flex items-center justify-between mt-1">
          <span className={`text-xs ${draft.length > MAX_INSTRUCTIONS * 0.9 ? 'text-red-500' : 'text-muted-foreground'}`}>
            {draft.length}/{MAX_INSTRUCTIONS}
          </span>
          <Button
            size="sm"
            onClick={handleSaveInstructions}
            disabled={saving || !hasInstructionChanges}
          >
            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Guardar instrucciones
          </Button>
        </div>
      </div>

      {/* Correction Examples */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="text-sm font-medium">Correcciones guardadas</label>
            <p className="text-xs text-muted-foreground">
              Cuando editas un campo, la correccion se guarda como ejemplo para futuras extracciones. Se usan las correcciones mas relevantes al documento actual.
            </p>
          </div>
          {vectorExamples.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearExamples}
              disabled={saving}
            >
              Limpiar todo
            </Button>
          )}
        </div>

        {vectorExamples.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4 border rounded-md">
            No hay correcciones guardadas. Edita campos en el detalle de una licitacion para crear ejemplos.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {vectorExamples.map((ex: VectorExample) => (
              <div
                key={ex.id}
                className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-xs bg-muted px-1.5 py-0.5 rounded">
                    {FIELD_LABELS[ex.field] || ex.field}
                  </span>
                  <div className="mt-1 text-xs">
                    <span className="text-red-500 line-through">{ex.original}</span>
                    {' → '}
                    <span className="text-emerald-600 font-medium">{ex.corrected}</span>
                  </div>
                  {ex.context && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {ex.context}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteExample(ex.id)}
                  disabled={saving}
                  className="text-muted-foreground hover:text-red-500 text-xs shrink-0 mt-1"
                  title="Eliminar ejemplo"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground italic">
        Cambios aplican solo a futuras extracciones. Se incluyen las 5 correcciones mas relevantes al documento en el prompt.
      </p>
    </div>
  );
}
