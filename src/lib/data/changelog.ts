export type FeatureType = 'feature' | 'improvement' | 'fix';

export interface ChangelogFeature {
  type: FeatureType;
  title: string;
  description: string;
  image?: string;
}

export interface ChangelogRelease {
  version: string;
  date: string;
  headline: string;
  features: ChangelogFeature[];
}

export const CHANGELOG: ChangelogRelease[] = [
  {
    version: '1.4.0',
    date: '2025-02-11',
    headline: 'Tabla mejorada y recordatorio de changelog',
    features: [
      {
        type: 'improvement',
        title: 'Tabla de licitaciones rediseñada',
        description:
          'La vista de tabla ahora muestra plazo en dias con indicadores de urgencia y resalta filas aprobadas en verde. Se removieron columnas innecesarias para una vista mas limpia.',
      },
      {
        type: 'feature',
        title: 'Recordatorio de novedades pre-commit',
        description:
          'Un hook de git bloquea commits si se cambian archivos fuente sin actualizar el changelog de novedades.',
      },
    ],
  },
  {
    version: '1.3.0',
    date: '2025-02-10',
    headline: 'Configuracion de confianza y suite de pruebas',
    features: [
      {
        type: 'feature',
        title: 'Configuracion de confianza',
        description:
          'Clasifica los campos extraidos como criticos, opcionales o ignorados para controlar la calidad de extraccion de datos.',
      },
      {
        type: 'feature',
        title: 'Deduplicacion con Supabase',
        description:
          'Los correos procesados se registran en Supabase para evitar duplicados entre ejecuciones del cron.',
      },
      {
        type: 'improvement',
        title: 'Extraccion de items en dos pasos',
        description:
          'El flujo de busqueda de precios ahora extrae los items del PDF primero y luego permite buscar precios individualmente.',
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2025-01-28',
    headline: 'Busqueda de precios y mejoras de UI',
    features: [
      {
        type: 'feature',
        title: 'Buscar Precios',
        description:
          'Busca precios de referencia en la web para los items de cada licitacion directamente desde el detalle.',
      },
      {
        type: 'improvement',
        title: 'App completamente responsiva',
        description:
          'Todas las vistas (tarjetas, lista, tabla, calendario) se adaptan correctamente a pantallas moviles.',
      },
      {
        type: 'improvement',
        title: 'Filtros guardados',
        description:
          'Guarda hasta 10 combinaciones de filtros como presets para acceso rapido.',
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2025-01-15',
    headline: 'Lanzamiento inicial',
    features: [
      {
        type: 'feature',
        title: 'Dashboard de licitaciones',
        description:
          'Vista principal con tarjetas, lista y tabla para gestionar licitaciones extraidas automaticamente de correos.',
      },
      {
        type: 'feature',
        title: 'Procesamiento automatico de emails',
        description:
          'Cron job que lee correos de Gmail, extrae datos de PDFs con GPT-4o y los guarda en Google Sheets.',
      },
      {
        type: 'feature',
        title: 'Calendario de visitas',
        description:
          'Vista de calendario para visualizar y exportar las fechas de visitas de sitio.',
      },
    ],
  },
];

export const LATEST_VERSION = CHANGELOG[0].version;
