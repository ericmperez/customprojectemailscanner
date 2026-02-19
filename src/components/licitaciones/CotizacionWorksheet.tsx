'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { ConfirmationDialog } from '@/components/modals/ConfirmationDialog';
import { toast } from 'sonner';
import type { CotizacionItem, Licitacion } from '@/lib/types';

interface CotizacionWorksheetProps {
  licitacionId: string;
}

// ── Calculation helpers ──────────────────────────────────────────────

function calcSubtotal(item: CotizacionItem): number {
  return item.qty * item.unit_price;
}

function calcMarkupAmount(item: CotizacionItem): number {
  return calcSubtotal(item) * (item.markup_pct / 100);
}

function calcTaxAmount(item: CotizacionItem): number {
  const sub = calcSubtotal(item);
  return (sub + calcMarkupAmount(item)) * (item.tax_pct / 100);
}

function calcLineTotal(item: CotizacionItem): number {
  const sub = calcSubtotal(item);
  const markup = calcMarkupAmount(item);
  const tax = (sub + markup) * (item.tax_pct / 100);
  return sub + item.shipping + markup + tax;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Editable cell types ──────────────────────────────────────────────

type EditableField = 'item_name' | 'qty' | 'unit' | 'unit_price' | 'shipping' | 'markup_pct' | 'tax_pct';

const NUMERIC_FIELDS: EditableField[] = ['qty', 'unit_price', 'shipping', 'markup_pct', 'tax_pct'];

// ── Component ────────────────────────────────────────────────────────

export function CotizacionWorksheet({ licitacionId }: CotizacionWorksheetProps) {
  const router = useRouter();
  const [items, setItems] = useState<CotizacionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lic, setLic] = useState<Licitacion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Inline editing state
  const [editCell, setEditCell] = useState<{ itemId: string; field: EditableField } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // PDF description panel
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  // AI original values for correction detection
  const [aiOriginals, setAiOriginals] = useState<Map<string, { item_name: string; qty: number; unit: string }>>(new Map());

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; itemId: string; itemName: string }>({
    open: false,
    itemId: '',
    itemName: '',
  });

  // AI replace/append confirmation
  const [aiConfirm, setAiConfirm] = useState<{
    open: boolean;
    pendingItems: { item_name: string; qty: number; unit: string }[];
  }>({ open: false, pendingItems: [] });

  // ── Data fetching ──────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/licitaciones/${licitacionId}/cotizacion`);
      const result = await res.json();
      if (result.success) setItems(result.data);
    } catch (error) {
      console.error('Error fetching cotizacion items:', error);
    } finally {
      setLoading(false);
    }
  }, [licitacionId]);

  const fetchLicitacion = useCallback(async () => {
    try {
      const res = await fetch(`/api/licitaciones/${licitacionId}`);
      const result = await res.json();
      if (result.success && result.data) setLic(result.data);
    } catch {
      // ignore
    }
  }, [licitacionId]);

  useEffect(() => {
    fetchItems();
    fetchLicitacion();
  }, [fetchItems, fetchLicitacion]);

  // Focus input when edit cell changes
  useEffect(() => {
    if (editCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editCell]);

  // ── CRUD handlers ──────────────────────────────────────────────────

  const startEdit = (itemId: string, field: EditableField) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    setEditCell({ itemId, field });
    setEditValue(String(item[field]));
  };

  const cancelEdit = () => {
    setEditCell(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editCell) return;
    const { itemId, field } = editCell;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    let parsedValue: string | number = editValue;
    if (NUMERIC_FIELDS.includes(field)) {
      parsedValue = parseFloat(editValue) || 0;
    }

    // Skip if unchanged
    if (String(item[field]) === String(parsedValue)) {
      cancelEdit();
      return;
    }

    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, [field]: parsedValue } : i))
    );
    cancelEdit();

    try {
      const res = await fetch(`/api/licitaciones/${licitacionId}/cotizacion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, [field]: parsedValue }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        setItems((prev) => prev.map((i) => (i.id === itemId ? result.data : i)));

        // Fire correction if this field was AI-extracted and user changed it
        const AI_CORRECTABLE: EditableField[] = ['item_name', 'qty', 'unit'];
        const orig = aiOriginals.get(itemId);
        if (orig && AI_CORRECTABLE.includes(field)) {
          const origValue = String(orig[field as keyof typeof orig]);
          if (origValue !== String(parsedValue)) {
            fetch('/api/settings/ai/correction', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                field: 'item_extraction',
                original: origValue,
                corrected: String(parsedValue),
                context: lic?.description?.slice(0, 500) || undefined,
              }),
            }).catch(() => {});
          }
        }
      }
    } catch {
      // Revert on failure
      setItems((prev) => prev.map((i) => (i.id === itemId ? item : i)));
      toast.error('Error al guardar');
    }
  };

  const handleAddRow = async () => {
    try {
      const res = await fetch(`/api/licitaciones/${licitacionId}/cotizacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_name: 'Nuevo item' }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        setItems((prev) => [...prev, result.data]);
        // Auto-edit the new item's name
        setTimeout(() => startEdit(result.data.id, 'item_name'), 50);
      }
    } catch {
      toast.error('Error al agregar fila');
    }
  };

  const handleDeleteClick = (itemId: string, itemName: string) => {
    setDeleteConfirm({ open: true, itemId, itemName });
  };

  const executeDelete = async () => {
    const { itemId } = deleteConfirm;
    setDeleteConfirm({ open: false, itemId: '', itemName: '' });

    // Optimistic removal
    const prev = items;
    setItems((curr) => curr.filter((i) => i.id !== itemId));

    try {
      await fetch(`/api/licitaciones/${licitacionId}/cotizacion`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });
    } catch {
      setItems(prev);
      toast.error('Error al eliminar');
    }
  };

  // ── AI Populate ────────────────────────────────────────────────────

  const handleAiPopulate = async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`/api/licitaciones/${licitacionId}/extract-items`, {
        method: 'POST',
      });
      const result = await res.json();
      if (!result.success || !result.data?.items?.length) {
        toast.error('No se pudieron extraer items');
        return;
      }

      const extracted = result.data.items.map((r: { item: string; qty: number; unit: string }) => ({
        item_name: r.item,
        qty: r.qty,
        unit: r.unit,
      }));

      // If rows already exist, ask user
      if (items.length > 0) {
        setAiConfirm({ open: true, pendingItems: extracted });
        return;
      }

      // Otherwise just bulk insert
      await bulkInsert(extracted, false);
    } catch {
      toast.error('Error al extraer items con AI');
    } finally {
      setAiLoading(false);
    }
  };

  const bulkInsert = async (
    newItems: { item_name: string; qty: number; unit: string }[],
    replace: boolean
  ) => {
    try {
      const res = await fetch(`/api/licitaciones/${licitacionId}/cotizacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: newItems, replace }),
      });
      const result = await res.json();
      if (result.success) {
        if (replace) {
          setItems(result.data);
        } else {
          setItems((prev) => [...prev, ...result.data]);
        }

        // Track AI originals for correction detection
        const newOriginals = new Map(replace ? [] : aiOriginals);
        for (const item of result.data as CotizacionItem[]) {
          newOriginals.set(item.id, { item_name: item.item_name, qty: item.qty, unit: item.unit });
        }
        setAiOriginals(newOriginals);

        toast.success(`${result.data.length} items agregados`);
      }
    } catch {
      toast.error('Error al insertar items');
    }
  };

  const handleAiConfirmReplace = async () => {
    const pending = aiConfirm.pendingItems;
    setAiConfirm({ open: false, pendingItems: [] });
    await bulkInsert(pending, true);
  };

  const handleAiConfirmAppend = async () => {
    const pending = aiConfirm.pendingItems;
    setAiConfirm({ open: false, pendingItems: [] });
    await bulkInsert(pending, false);
  };

  // ── Grand totals ───────────────────────────────────────────────────

  const grandSubtotal = items.reduce((sum, i) => sum + calcSubtotal(i), 0);
  const grandShipping = items.reduce((sum, i) => sum + i.shipping, 0);
  const grandMarkup = items.reduce((sum, i) => sum + calcMarkupAmount(i), 0);
  const grandTax = items.reduce((sum, i) => sum + calcTaxAmount(i), 0);
  const grandTotal = items.reduce((sum, i) => sum + calcLineTotal(i), 0);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
              ← Volver
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">
                📊 Cotizacion
              </h1>
              {lic && (
                <p className="text-sm text-muted-foreground truncate">
                  {lic.title || lic.subject} · {lic.location}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleAddRow}>
              + Agregar Fila
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAiPopulate}
              disabled={aiLoading}
            >
              {aiLoading ? '⏳ Extrayendo...' : '🤖 Poblar desde AI'}
            </Button>
          </div>
        </div>
      </div>

      {/* PDF Description Panel */}
      {lic?.description && lic.description !== 'No disponible' && (
        <div className="max-w-7xl mx-auto px-4 pt-3">
          <button
            onClick={() => setDescriptionOpen(!descriptionOpen)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {descriptionOpen ? '📄 Ocultar texto' : '📄 Ver texto del PDF'}
          </button>
          {descriptionOpen && (
            <div className="mt-2 rounded-md border bg-muted/50 p-4 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
              {lic.description}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg mb-2">No hay items en la cotizacion</p>
            <p className="text-sm mb-4">
              Agrega filas manualmente o usa AI para extraer items del PDF.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={handleAddRow}>
                + Agregar Fila
              </Button>
              <Button variant="outline" onClick={handleAiPopulate} disabled={aiLoading}>
                {aiLoading ? '⏳ Extrayendo...' : '🤖 Poblar desde AI'}
              </Button>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead className="min-w-[200px]">Item</TableHead>
                <TableHead className="w-20">Cant.</TableHead>
                <TableHead className="w-20">Unidad</TableHead>
                <TableHead className="w-28">Precio Unit.</TableHead>
                <TableHead className="w-24">Envio</TableHead>
                <TableHead className="w-24">Markup %</TableHead>
                <TableHead className="w-20">IVU %</TableHead>
                <TableHead className="w-28 text-right">Subtotal</TableHead>
                <TableHead className="w-28 text-right">Total</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <EditableCell
                    itemId={item.id}
                    field="item_name"
                    value={item.item_name}
                    editCell={editCell}
                    editValue={editValue}
                    inputRef={inputRef}
                    onStartEdit={startEdit}
                    onEditValueChange={setEditValue}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    itemId={item.id}
                    field="qty"
                    value={item.qty}
                    editCell={editCell}
                    editValue={editValue}
                    inputRef={inputRef}
                    onStartEdit={startEdit}
                    onEditValueChange={setEditValue}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    type="number"
                  />
                  <EditableCell
                    itemId={item.id}
                    field="unit"
                    value={item.unit}
                    editCell={editCell}
                    editValue={editValue}
                    inputRef={inputRef}
                    onStartEdit={startEdit}
                    onEditValueChange={setEditValue}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                  />
                  <EditableCell
                    itemId={item.id}
                    field="unit_price"
                    value={item.unit_price}
                    displayValue={`$${fmt(item.unit_price)}`}
                    editCell={editCell}
                    editValue={editValue}
                    inputRef={inputRef}
                    onStartEdit={startEdit}
                    onEditValueChange={setEditValue}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    type="number"
                  />
                  <EditableCell
                    itemId={item.id}
                    field="shipping"
                    value={item.shipping}
                    displayValue={`$${fmt(item.shipping)}`}
                    editCell={editCell}
                    editValue={editValue}
                    inputRef={inputRef}
                    onStartEdit={startEdit}
                    onEditValueChange={setEditValue}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    type="number"
                  />
                  <EditableCell
                    itemId={item.id}
                    field="markup_pct"
                    value={item.markup_pct}
                    displayValue={`${item.markup_pct}%`}
                    editCell={editCell}
                    editValue={editValue}
                    inputRef={inputRef}
                    onStartEdit={startEdit}
                    onEditValueChange={setEditValue}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    type="number"
                  />
                  <EditableCell
                    itemId={item.id}
                    field="tax_pct"
                    value={item.tax_pct}
                    displayValue={`${item.tax_pct}%`}
                    editCell={editCell}
                    editValue={editValue}
                    inputRef={inputRef}
                    onStartEdit={startEdit}
                    onEditValueChange={setEditValue}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    type="number"
                  />
                  <TableCell className="text-right font-mono">
                    ${fmt(calcSubtotal(item))}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    ${fmt(calcLineTotal(item))}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleDeleteClick(item.id, item.item_name)}
                      className="text-muted-foreground hover:text-red-500 text-xs"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="text-right font-medium">
                  Totales
                </TableCell>
                <TableCell className="font-mono">${fmt(grandShipping)}</TableCell>
                <TableCell className="font-mono">${fmt(grandMarkup)}</TableCell>
                <TableCell className="font-mono">${fmt(grandTax)}</TableCell>
                <TableCell className="text-right font-mono">${fmt(grandSubtotal)}</TableCell>
                <TableCell className="text-right font-mono font-bold">
                  ${fmt(grandTotal)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmationDialog
        open={deleteConfirm.open}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleteConfirm({ open: false, itemId: '', itemName: '' });
        }}
        title="Eliminar item"
        description={`¿Eliminar "${deleteConfirm.itemName}" de la cotizacion?`}
        confirmLabel="Eliminar"
        variant="destructive"
        loading={false}
        onConfirm={executeDelete}
      />

      {/* AI replace/append dialog */}
      {aiConfirm.open && (
        <ConfirmationDialog
          open={aiConfirm.open}
          onOpenChange={(isOpen) => {
            if (!isOpen) setAiConfirm({ open: false, pendingItems: [] });
          }}
          title="Items existentes"
          description={`Ya hay ${items.length} items en la cotizacion. ¿Desea reemplazarlos con los ${aiConfirm.pendingItems.length} items extraidos, o agregarlos al final?`}
          confirmLabel="Reemplazar"
          variant="destructive"
          loading={false}
          onConfirm={handleAiConfirmReplace}
        />
      )}
      {/* Append button rendered separately since ConfirmationDialog only has one confirm */}
      {aiConfirm.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <Button
              variant="outline"
              size="sm"
              className="fixed bottom-4 right-4 z-[70] shadow-lg"
              onClick={handleAiConfirmAppend}
            >
              + Agregar al final
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Editable Cell ────────────────────────────────────────────────────

function EditableCell({
  itemId,
  field,
  value,
  displayValue,
  editCell,
  editValue,
  inputRef,
  onStartEdit,
  onEditValueChange,
  onSave,
  onCancel,
  type = 'text',
}: {
  itemId: string;
  field: EditableField;
  value: string | number;
  displayValue?: string;
  editCell: { itemId: string; field: EditableField } | null;
  editValue: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onStartEdit: (itemId: string, field: EditableField) => void;
  onEditValueChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  type?: 'text' | 'number';
}) {
  const isEditing = editCell?.itemId === itemId && editCell?.field === field;

  if (isEditing) {
    return (
      <TableCell className="p-1">
        <input
          ref={inputRef}
          type={type}
          step={type === 'number' ? 'any' : undefined}
          className="w-full rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              onSave();
            }
            if (e.key === 'Escape') onCancel();
          }}
          onBlur={onSave}
        />
      </TableCell>
    );
  }

  return (
    <TableCell
      className="cursor-pointer hover:bg-muted/70 transition-colors"
      onClick={() => onStartEdit(itemId, field)}
    >
      {displayValue ?? String(value)}
    </TableCell>
  );
}
