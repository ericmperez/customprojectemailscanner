'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LicitacionAttachment } from '@/lib/types';
import { ConfirmationDialog } from '@/components/modals/ConfirmationDialog';

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return new Date(dateStr).toLocaleDateString('es-PR', {
    day: 'numeric',
    month: 'short',
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface LicitacionAttachmentsProps {
  licitacionId: string;
}

export function LicitacionAttachments({ licitacionId }: LicitacionAttachmentsProps) {
  const [attachments, setAttachments] = useState<LicitacionAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; filename: string }>({
    open: false,
    id: '',
    filename: '',
  });

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/licitaciones/${licitacionId}/attachments`);
      const result = await res.json();
      if (result.success) {
        setAttachments(result.data);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setLoading(false);
    }
  }, [licitacionId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleUpload = async () => {
    if (!selectedFile || !label.trim()) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('label', label.trim());

      const res = await fetch(`/api/licitaciones/${licitacionId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();

      if (result.success && result.data) {
        setAttachments((prev) => [result.data, ...prev]);
        setLabel('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading attachment:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClick = (id: string, filename: string) => {
    setDeleteConfirm({ open: true, id, filename });
  };

  const executeDelete = async () => {
    const { id } = deleteConfirm;
    setDeleteConfirm({ open: false, id: '', filename: '' });

    // Optimistic removal
    setAttachments((prev) => prev.filter((a) => a.id !== id));

    try {
      await fetch(`/api/licitaciones/${licitacionId}/attachments/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting attachment:', error);
      fetchAttachments();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    // Auto-fill label from filename (without extension) if label is empty
    if (file && !label.trim()) {
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, '');
      setLabel(nameWithoutExt);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-2">Cargando archivos...</div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header with count */}
      <div className="text-xs text-muted-foreground">
        {attachments.length} {attachments.length === 1 ? 'archivo' : 'archivos'}
      </div>

      {/* Attachment list */}
      {attachments.map((att) => (
        <div
          key={att.id}
          className="flex items-start gap-2 group text-sm py-0.5"
        >
          <span className="mt-0.5 flex-shrink-0">📎</span>
          <div className="flex-1 min-w-0">
            <a
              href={att.public_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline truncate block"
              title={att.filename}
            >
              {att.label}
            </a>
            <span className="text-xs text-muted-foreground">
              {att.uploaded_by} · {relativeTime(att.uploaded_at)}
              {att.file_size_bytes ? ` · ${formatFileSize(att.file_size_bytes)}` : ''}
            </span>
          </div>
          <button
            onClick={() => handleDeleteClick(att.id, att.filename)}
            className="flex-shrink-0 text-xs text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Eliminar"
          >
            🗑️
          </button>
        </div>
      ))}

      {/* Upload form */}
      <div className="space-y-1.5 pt-1">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="block w-full text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded-md file:border file:border-input file:bg-background file:text-xs file:font-medium hover:file:bg-accent cursor-pointer"
          disabled={uploading}
        />
        {selectedFile && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="flex-1 rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Etiqueta del archivo..."
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpload();
              }}
              disabled={uploading}
            />
            <button
              onClick={handleUpload}
              disabled={uploading || !label.trim()}
              className="text-xs text-primary hover:underline disabled:opacity-50 whitespace-nowrap"
            >
              {uploading ? 'Subiendo...' : '📤 Subir'}
            </button>
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={deleteConfirm.open}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleteConfirm({ open: false, id: '', filename: '' });
        }}
        title="Eliminar archivo"
        description={`¿Eliminar "${deleteConfirm.filename}"?`}
        confirmLabel="Eliminar"
        variant="destructive"
        loading={false}
        onConfirm={executeDelete}
      />
    </div>
  );
}
