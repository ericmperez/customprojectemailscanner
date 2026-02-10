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
import { cn, formatSiteVisitDate, formatTimeLabel, resolvePdfUrl, badgeText } from '@/lib/utils';
import type { Licitacion } from '@/lib/types';

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

  const handleDelete = async () => {
    if (!licitacionId || !confirm('¿Está seguro de que desea eliminar esta licitación?')) return;
    try {
      const response = await fetch(`/api/licitaciones/${licitacionId}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        onClose();
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const pdfUrl = lic ? (lic.pdfUrl || resolvePdfUrl(lic.pdfLink)) : '#';
  const hasPdf = pdfUrl && pdfUrl !== '#';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
            </Section>

            {/* Location & Contact */}
            <Section title="Ubicacion y Contacto">
              <DetailItem label="Ubicacion" value={lic.location} />
              <DetailItem label="Categoria" value={lic.category} />
              <DetailItem label="Contacto" value={lic.contactName} />
              {lic.contactPhone && (
                <div className="text-sm">
                  <span className="text-muted-foreground font-medium">Telefono: </span>
                  <a href={`tel:${lic.contactPhone.replace(/\D/g, '')}`} className="text-primary hover:underline">
                    📞 {lic.contactPhone}
                  </a>
                  {' '}
                  <a
                    href={`https://wa.me/1${lic.contactPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    💬 WhatsApp
                  </a>
                </div>
              )}
            </Section>

            {/* Visits & Close */}
            <Section title="Visitas y Cierre">
              <DetailItem label="Fecha Visita" value={formatSiteVisitDate(lic.siteVisitDate)} />
              <DetailItem label="Hora Visita" value={formatTimeLabel(lic.siteVisitTime) || 'Sin hora'} />
              <DetailItem label="Lugar de Visita" value={lic.visitLocation} />
              <DetailItem label="Cierre Licitacion" value={lic.biddingCloseDate} />
              <DetailItem label="Hora Cierre" value={formatTimeLabel(lic.biddingCloseTime) || 'Sin hora'} />
            </Section>

            {/* Description */}
            {lic.description && (
              <Section title="Descripcion">
                <p className="text-sm whitespace-pre-wrap">{lic.description}</p>
              </Section>
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

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {hasPdf && (
              <Button asChild>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  📄 Abrir PDF
                </a>
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              🗑️ Eliminar
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
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
