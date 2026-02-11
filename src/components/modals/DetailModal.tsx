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

interface DetailModalProps {
  open: boolean;
  licitacionId: number | null;
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

  const fetchDetail = useCallback(async (id: number) => {
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
              <DetailItem label="Valor Estimado" value={lic.estimatedValue} />
              <div className="text-sm">
                <span className="text-muted-foreground font-medium">Puntuacion: </span>
                <span className="font-bold">{computeWorthItScore(lic)}/10</span>
              </div>
            </Section>

            {/* Location & Contact */}
            <Section title="Ubicacion y Contacto">
              <DetailItem label="Ubicacion" value={lic.location} />
              <DetailItem label="Categoria" value={lic.category} />
              <DetailItem label="Contacto" value={lic.contactName} />
              {lic.contactPhone && (
                <div className="text-sm">
                  <span className="text-muted-foreground font-medium">Telefono: </span>
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
                  </div>
                </div>
              )}
            </Section>

            {/* Visits & Close */}
            <Section title="Visitas y Cierre">
              <DetailItem label="Fecha Visita" value={formatSiteVisitDate(lic.siteVisitDate)} />
              <DetailItem label="Hora Visita" value={formatTimeLabel(lic.siteVisitTime) || 'Sin hora'} />
              <DetailItem label="Lugar de Visita" value={lic.visitLocation} />
              <DetailItem label="Requisitos de Visita" value={lic.visitRequirements} />
              <DetailItem label="Cierre Licitacion" value={lic.biddingCloseDate} />
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
                <p className="text-sm whitespace-pre-wrap">{lic.description}</p>
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
