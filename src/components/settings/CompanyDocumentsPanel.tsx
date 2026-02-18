'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmationDialog } from '@/components/modals/ConfirmationDialog';
import { toast } from 'sonner';
import type { OrgDocument } from '@/lib/types';

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CompanyDocumentsPanel() {
  const [documents, setDocuments] = useState<OrgDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/settings/documents');
      const json = await res.json();
      if (json.success) setDocuments(json.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !label.trim()) {
      toast.error('Selecciona un archivo y escribe una etiqueta');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('label', label.trim());

      const res = await fetch('/api/settings/documents', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Documento subido');
        setLabel('');
        if (fileRef.current) fileRef.current.value = '';
        fetchDocuments();
      } else {
        toast.error(json.error || 'Error al subir');
      }
    } catch {
      toast.error('Error al subir el documento');
    } finally {
      setUploading(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/settings/documents/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Documento eliminado');
        setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      } else {
        toast.error(json.error || 'Error al eliminar');
      }
    } catch {
      toast.error('Error al eliminar el documento');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Subir documento</h4>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Etiqueta (ej. Certificacion OSHA)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="sm:flex-1"
          />
          <input
            ref={fileRef}
            type="file"
            className="text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border file:text-sm file:font-medium file:bg-background hover:file:bg-accent file:cursor-pointer"
          />
          <Button onClick={handleUpload} disabled={uploading} size="sm">
            {uploading ? 'Subiendo...' : '📤 Subir'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Maximo 10 MB por archivo.</p>
      </div>

      {/* Document list */}
      <div>
        <h4 className="text-sm font-medium mb-2">Documentos ({documents.length})</h4>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay documentos. Sube certificaciones, licencias, seguros, etc.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-2 rounded-md border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{doc.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {doc.filename}
                    {doc.file_size_bytes ? ` · ${formatFileSize(doc.file_size_bytes)}` : ''}
                    {' · '}{doc.uploaded_by}
                    {' · '}{new Date(doc.uploaded_at).toLocaleDateString('es-PR', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {doc.public_url && (
                    <Button asChild variant="outline" size="sm">
                      <a href={doc.public_url} target="_blank" rel="noopener noreferrer">
                        📥 Descargar
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget({ id: doc.id, label: doc.label })}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => { if (!isOpen) setDeleteTarget(null); }}
        title="Eliminar documento"
        description={`¿Eliminar "${deleteTarget?.label}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleting}
        onConfirm={executeDelete}
      />
    </div>
  );
}
