'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn, formatSiteVisitDate, formatTimeLabel, resolvePdfUrl, badgeText, parseConfidence, computeWorthItScore } from '@/lib/utils';
import { ConfirmationDialog } from './ConfirmationDialog';
import { PriceSearchSection } from '@/components/licitaciones/PriceSearchSection';
import type { Licitacion } from '@/lib/types';
import { hasVisitInfo, buildWhatsAppVisitCardUrl } from '@/lib/utils/whatsapp';
import { toast } from 'sonner';

const EDITABLE_FIELDS = [
  'title',
  'location',
  'description',
  'contactName',
  'contactPhone',
  'siteVisitDate',
  'biddingCloseDate',
  'estimatedValue',
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

interface DetailModalProps {
  open: boolean;
  licitacionId: string | null;
  licitacion?: Licitacion | null;
  onClose: () => void;
  onRefresh: () => void;
}

export function DetailModal({ open, licitacionId, licitacion, onClose, onRefresh }: DetailModalProps) {
  const [lic, setLic] = useState<Licitacion | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; loading: boolean }>({
    open: false,
    loading: false,
  });
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingField, setSavingField] = useState(false);

  const fetchDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/licitaciones/${id}`);
      const result = await response.json();
      if (result.success && result.data) {
        setLic(result.data);
      }
    } catch (error) {
      console.error('Error loading detail:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setLic(null);
      setEditingField(null);
      return;
    }
    // Use provided licitacion object if available (instant), otherwise fetch
    if (licitacion) {
      setLic(licitacion);
    } else if (licitacionId) {
      fetchDetail(licitacionId);
    }
  }, [open, licitacionId, licitacion, fetchDetail]);

  const handleDeleteClick = () => {
    setDeleteConfirm({ open: true, loading: false });
  };

  const executeDelete = async () => {
    if (!licitacionId) return;
    setDeleteConfirm((prev) => ({ ...prev, loading: true }));
    try {
      const response = await fetch(`/api/licitaciones/${licitacionId}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        setDeleteConfirm({ open: false, loading: false });
        onClose();
        onRefresh();
        return;
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
    setDeleteConfirm({ open: false, loading: false });
  };

  const startEdit = (field: EditableField) => {
    if (!lic) return;
    setEditingField(field);
    setEditValue((lic[field] as string) || '');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!lic || !editingField || !licitacionId) return;
    const originalValue = (lic[editingField] as string) || '';
    if (editValue === originalValue) {
      cancelEdit();
      return;
    }

    setSavingField(true);
    try {
      const response = await fetch(`/api/licitaciones/${licitacionId}/update-fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [editingField]: editValue }),
      });
      const result = await response.json();
      if (result.success) {
        // Update local state
        setLic((prev) => prev ? { ...prev, [editingField]: editValue } : prev);
        toast.success('Campo actualizado');

        // Save correction as example (fire-and-forget)
        if (originalValue && originalValue !== 'No disponible') {
          fetch('/api/settings/ai/correction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              field: editingField,
              original: originalValue,
              corrected: editValue,
              context: lic.title || lic.subject || '',
            }),
          }).catch(() => {});
        }

        onRefresh();
      } else {
        toast.error('Error al actualizar campo');
      }
    } catch {
      toast.error('Error al actualizar campo');
    } finally {
      setSavingField(false);
      setEditingField(null);
      setEditValue('');
    }
  };

  const pdfUrl = lic ? (lic.pdfUrl || resolvePdfUrl(lic.pdfLink)) : '#';
  const hasPdf = pdfUrl && pdfUrl !== '#';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[100dvh] sm:max-h-[85vh] overflow-y-auto h-[100dvh] sm:h-auto rounded-none sm:rounded-lg p-4 sm:p-6">
        <DialogHeader>
          {lic && (
            <div
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-1 w-fit',
                lic.approvalStatus === 'approved' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
                lic.approvalStatus === 'rejected' && 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
                (!lic.approvalStatus || lic.approvalStatus === 'pending') && 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              )}
            >
              {badgeText(lic.approvalStatus)}
            </div>
          )}
          <DialogTitle>{lic?.title || lic?.subject || 'Detalle de Licitacion'}</DialogTitle>
          {lic && (
            <p className="text-sm text-muted-foreground">
              {[lic.location, lic.category].filter(Boolean).join(' · ')}
            </p>
          )}
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {lic && !loading && (
          <div className="space-y-4">
            {/* General Info */}
            <Section title="Informacion General">
              <EditableDetailItem
                label="Titulo"
                field="title"
                value={lic.title}
                editingField={editingField}
                editValue={editValue}
                saving={savingField}
                onStartEdit={startEdit}
                onEditValueChange={setEditValue}
                onSave={saveEdit}
                onCancel={cancelEdit}
              />
              <DetailItem label="Asunto Email" value={lic.subject} />
              <DetailItem
                label="Fecha del Email"
                value={lic.emailDate ? new Date(lic.emailDate).toLocaleString('es-PR') : ''}
              />
              <DetailItem label="Estado" value={badgeText(lic.approvalStatus)} />
              <DetailItem
                label="Prioridad"
                value={
                  (lic.priority || '').toLowerCase() === 'high' ? 'Alta' :
                  (lic.priority || '').toLowerCase() === 'medium' ? 'Media' :
                  (lic.priority || '').toLowerCase() === 'low' ? 'Baja' : lic.priority
                }
              />
              {parseConfidence(lic.extractionMethod) !== null && (
                <div className="text-sm">
                  <span className="text-muted-foreground font-medium">Confianza Extraccion: </span>
                  <span className={cn(
                    'font-medium',
                    (parseConfidence(lic.extractionMethod) ?? 0) >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                    (parseConfidence(lic.extractionMethod) ?? 0) >= 60 ? 'text-amber-600 dark:text-amber-400' :
                    'text-red-600 dark:text-red-400'
                  )}>
                    {parseConfidence(lic.extractionMethod)}% ({lic.extractionMethod})
                  </span>
                </div>
              )}
              <EditableDetailItem
                label="Valor Estimado"
                field="estimatedValue"
                value={lic.estimatedValue}
                editingField={editingField}
                editValue={editValue}
                saving={savingField}
                onStartEdit={startEdit}
                onEditValueChange={setEditValue}
                onSave={saveEdit}
                onCancel={cancelEdit}
              />
              <div className="text-sm">
                <span className="text-muted-foreground font-medium">Puntuacion: </span>
                <span className="font-bold">{computeWorthItScore(lic)}/10</span>
              </div>
            </Section>

            {/* Location & Contact */}
            <Section title="Ubicacion y Contacto">
              <EditableDetailItem
                label="Ubicacion"
                field="location"
                value={lic.location}
                editingField={editingField}
                editValue={editValue}
                saving={savingField}
                onStartEdit={startEdit}
                onEditValueChange={setEditValue}
                onSave={saveEdit}
                onCancel={cancelEdit}
              />
              <DetailItem label="Categoria" value={lic.category} />
              <EditableDetailItem
                label="Contacto"
                field="contactName"
                value={lic.contactName}
                editingField={editingField}
                editValue={editValue}
                saving={savingField}
                onStartEdit={startEdit}
                onEditValueChange={setEditValue}
                onSave={saveEdit}
                onCancel={cancelEdit}
              />
              {lic.contactPhone && (
                <div className="text-sm">
                  <span className="text-muted-foreground font-medium">Telefono: </span>
                  {editingField === 'contactPhone' ? (
                    <InlineEditor
                      value={editValue}
                      saving={savingField}
                      onChange={setEditValue}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                    />
                  ) : (
                    <div className="flex gap-2 mt-1 sm:inline-flex sm:mt-0">
                      <a href={`tel:${lic.contactPhone.replace(/\D/g, '')}`} className="text-primary hover:underline inline-flex items-center gap-1 py-1 px-2 rounded-md border sm:border-0 sm:p-0">
                        📞 {lic.contactPhone}
                      </a>
                      <a
                        href={`https://wa.me/1${lic.contactPhone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 py-1 px-2 rounded-md border sm:border-0 sm:p-0"
                      >
                        💬 WhatsApp
                      </a>
                      <button
                        onClick={() => startEdit('contactPhone')}
                        className="text-muted-foreground hover:text-foreground text-xs px-1"
                        title="Editar"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* Visits & Close */}
            <Section title="Visitas y Cierre">
              <EditableDetailItem
                label="Fecha Visita"
                field="siteVisitDate"
                value={lic.siteVisitDate}
                displayValue={formatSiteVisitDate(lic.siteVisitDate)}
                editingField={editingField}
                editValue={editValue}
                saving={savingField}
                onStartEdit={startEdit}
                onEditValueChange={setEditValue}
                onSave={saveEdit}
                onCancel={cancelEdit}
              />
              <DetailItem label="Hora Visita" value={formatTimeLabel(lic.siteVisitTime) || 'Sin hora'} />
              <DetailItem label="Lugar de Visita" value={lic.visitLocation} />
              <DetailItem label="Requisitos de Visita" value={lic.visitRequirements} />
              <EditableDetailItem
                label="Cierre Licitacion"
                field="biddingCloseDate"
                value={lic.biddingCloseDate}
                editingField={editingField}
                editValue={editValue}
                saving={savingField}
                onStartEdit={startEdit}
                onEditValueChange={setEditValue}
                onSave={saveEdit}
                onCancel={cancelEdit}
              />
              <DetailItem label="Hora Cierre" value={formatTimeLabel(lic.biddingCloseTime) || 'Sin hora'} />
              {hasVisitInfo(lic) && (
                <a
                  href={buildWhatsAppVisitCardUrl(lic)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                >
                  📤 Compartir Tarjeta de Visita por WhatsApp
                </a>
              )}
            </Section>

            {/* Description */}
            {lic.description && (
              <Section title="Descripcion">
                {editingField === 'description' ? (
                  <div>
                    <textarea
                      className="w-full rounded-md border bg-background px-2 py-1 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      disabled={savingField}
                      autoFocus
                    />
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={saveEdit}
                        disabled={savingField}
                        className="text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        {savingField ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={savingField}
                        className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="group relative">
                    <p className="text-sm whitespace-pre-wrap">{lic.description}</p>
                    <button
                      onClick={() => startEdit('description')}
                      className="absolute top-0 right-0 text-muted-foreground hover:text-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Editar"
                    >
                      ✏️
                    </button>
                  </div>
                )}
              </Section>
            )}

            {/* Price Search */}
            {lic.description && lic.description !== 'No disponible' && (
              <PriceSearchSection licitacionId={lic.id} variant="modal" />
            )}

            {/* Summary */}
            {lic.summary && (
              <Section title="Resumen">
                <p className="text-sm whitespace-pre-wrap">{lic.summary}</p>
              </Section>
            )}

            {/* Notes */}
            <Section title="Notas y Decision">
              <DetailItem label="Notas" value={lic.approvalNotes} />
              <DetailItem label="Estado de Decision" value={lic.decisionStatus} />
              <DetailItem label="Interesado" value={lic.interested ? 'Si' : 'No'} />
            </Section>
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between mt-2">
          <div className="flex gap-2">
            {hasPdf && (
              <Button asChild className="flex-1 sm:flex-none">
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  📄 Abrir PDF
                </a>
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleDeleteClick} className="flex-1 sm:flex-none">
              🗑️ Eliminar
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
              Cerrar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <ConfirmationDialog
        open={deleteConfirm.open}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleteConfirm({ open: false, loading: false });
        }}
        title="Eliminar licitación"
        description="¿Está seguro de que desea eliminar esta licitación? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteConfirm.loading}
        onConfirm={executeDelete}
      />
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <h4 className="font-medium text-sm mb-2">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === 'No disponible' || value === 'Sin hora' || value === 'No clasificado') {
    return null;
  }
  return (
    <div className="text-sm">
      <span className="text-muted-foreground font-medium">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

function InlineEditor({
  value,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  saving: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="text"
        className="rounded-md border bg-background px-2 py-0.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave();
          if (e.key === 'Escape') onCancel();
        }}
        disabled={saving}
        autoFocus
      />
      <button
        onClick={onSave}
        disabled={saving}
        className="text-xs text-primary hover:underline disabled:opacity-50"
      >
        {saving ? '...' : '✓'}
      </button>
      <button
        onClick={onCancel}
        disabled={saving}
        className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
      >
        ✕
      </button>
    </span>
  );
}

function EditableDetailItem({
  label,
  field,
  value,
  displayValue,
  editingField,
  editValue,
  saving,
  onStartEdit,
  onEditValueChange,
  onSave,
  onCancel,
}: {
  label: string;
  field: EditableField;
  value: string | null | undefined;
  displayValue?: string | null;
  editingField: EditableField | null;
  editValue: string;
  saving: boolean;
  onStartEdit: (field: EditableField) => void;
  onEditValueChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isEmpty = !value || value === 'No disponible' || value === 'No clasificado';

  if (editingField === field) {
    return (
      <div className="text-sm">
        <span className="text-muted-foreground font-medium">{label}: </span>
        <InlineEditor
          value={editValue}
          saving={saving}
          onChange={onEditValueChange}
          onSave={onSave}
          onCancel={onCancel}
        />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="text-sm group">
        <span className="text-muted-foreground font-medium">{label}: </span>
        <button
          onClick={() => onStartEdit(field)}
          className="text-xs text-muted-foreground hover:text-primary"
          title="Agregar valor"
        >
          + Agregar
        </button>
      </div>
    );
  }

  return (
    <div className="text-sm group">
      <span className="text-muted-foreground font-medium">{label}: </span>
      <span>{displayValue ?? value}</span>
      <button
        onClick={() => onStartEdit(field)}
        className="ml-1 text-muted-foreground hover:text-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity"
        title="Editar"
      >
        ✏️
      </button>
    </div>
  );
}
