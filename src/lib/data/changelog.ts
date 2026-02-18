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
    version: '1.21.0',
    date: '2026-02-18',
    headline: 'Hoja de cotizacion por licitacion',
    features: [
      {
        type: 'feature',
        title: 'Hoja de cotizacion',
        description:
          'Nueva pagina de cotizacion estilo hoja de calculo para licitaciones aprobadas. Desglosa productos con columnas de precio, envio, markup e IVU. Edicion inline, totales en tiempo real y extraccion de items con AI.',
      },
    ],
  },
  {
    version: '1.20.0',
    date: '2026-02-18',
    headline: 'Archivos adjuntos por licitacion',
    features: [
      {
        type: 'feature',
        title: 'Archivos adjuntos por licitacion',
        description:
          'Sube documentos (cotizaciones, planos, certificaciones) directamente a cada licitacion desde el modal de detalle. Los miembros del equipo pueden ver, descargar y eliminar archivos.',
      },
    ],
  },
  {
    version: '1.19.0',
    date: '2026-02-17',
    headline: 'Documentos de empresa y mejoras de UI',
    features: [
      {
        type: 'feature',
        title: 'Documentos de empresa',
        description:
          'Nueva seccion en Configuracion para subir y gestionar documentos de la organizacion (certificaciones, licencias, seguros). Accesibles desde el modal de detalle.',
      },
      {
        type: 'fix',
        title: 'Boton de cerrar modal visible',
        description:
          'El boton X para cerrar el modal de detalle ahora es completamente visible sobre el encabezado fijo.',
      },
    ],
  },
  {
    version: '1.18.0',
    date: '2026-02-15',
    headline: 'Modal de detalle mejorado',
    features: [
      {
        type: 'improvement',
        title: 'Encabezado fijo y fondo difuminado',
        description:
          'El modal de detalle ahora tiene el encabezado y pie fijos mientras el contenido se desplaza. El fondo se difumina para mejor enfoque.',
      },
      {
        type: 'feature',
        title: 'Fecha de cierre y checklist en encabezado',
        description:
          'El encabezado del modal ahora muestra la fecha de cierre con indicador de urgencia y un checklist visual de campos completados (PDF, descripcion, contacto, visita, fecha cierre, decision).',
      },
      {
        type: 'feature',
        title: 'Aprobar o rechazar desde el modal',
        description:
          'El encabezado del modal muestra botones de Aprobar y Rechazar cuando la licitacion esta pendiente. Una vez decidida, muestra el estado actual.',
      },
    ],
  },
  {
    version: '1.17.0',
    date: '2026-02-15',
    headline: 'Barra de herramientas simplificada',
    features: [
      {
        type: 'improvement',
        title: 'Interfaz mas limpia',
        description:
          'Se consolidaron las dos barras de herramientas en una sola. Accesos rapidos, exportar, configuracion y tema estan ahora en un menu compacto (...).',
      },
    ],
  },
  {
    version: '1.16.0',
    date: '2026-02-15',
    headline: 'Busqueda de precios en ingles',
    features: [
      {
        type: 'improvement',
        title: 'Busqueda de precios en ingles',
        description:
          'Los items se extraen traducidos al ingles y los precios se buscan en sitios de USA y Puerto Rico (Grainger, Home Depot, Amazon, etc.) para mejores resultados.',
      },
    ],
  },
  {
    version: '1.15.0',
    date: '2026-02-12',
    headline: 'Detalles de visita en el calendario',
    features: [
      {
        type: 'improvement',
        title: 'Hora y ubicacion en cada dia del calendario',
        description:
          'Cada celda del calendario ahora muestra la hora y el pueblo de cada visita, no solo el titulo.',
      },
      {
        type: 'feature',
        title: 'Version checker',
        description:
          'La aplicacion detecta automaticamente nuevas versiones desplegadas y sugiere refrescar la pagina.',
      },
    ],
  },
  {
    version: '1.14.0',
    date: '2026-02-15',
    headline: 'Tab de Visitas y mejoras de equipo',
    features: [
      {
        type: 'feature',
        title: 'Tab dedicado de Visitas',
        description:
          'Nuevo tab "Visitas" que muestra solo licitaciones con visitas de sitio, agrupadas por fecha (Hoy, Manana, Esta semana, etc.). Marca cada visita como Asistir o Saltar.',
      },
      {
        type: 'feature',
        title: 'Usuarios conectados en tiempo real',
        description:
          'Avatares con indicador verde en el header muestran que miembros del equipo estan conectados en este momento.',
      },
      {
        type: 'improvement',
        title: 'Calendario solo en Visitas',
        description:
          'El boton de calendario y exportar .ics ahora solo aparecen dentro del tab de Visitas.',
      },
      {
        type: 'fix',
        title: 'Usuarios invitados ven los datos correctos',
        description:
          'Los miembros invitados a una organizacion ahora se activan automaticamente en la org correcta al iniciar sesion, evitando la creacion de organizaciones duplicadas.',
      },
    ],
  },
  {
    version: '1.13.0',
    date: '2026-02-15',
    headline: 'Una organizacion por usuario',
    features: [
      {
        type: 'improvement',
        title: 'Una organizacion por usuario',
        description:
          'Cada usuario ahora solo puede pertenecer a una organizacion. Se removio el selector de organizaciones y se agregaron protecciones para evitar la creacion de organizaciones adicionales.',
      },
    ],
  },
  {
    version: '1.12.0',
    date: '2026-02-15',
    headline: 'Ordenar por columnas, historial de actividad y multi-tenant',
    features: [
      {
        type: 'feature',
        title: 'Ordenar por columnas en tabla',
        description:
          'Haz clic en cualquier encabezado de columna (Titulo, Tipo, Punt., Categoria, Fecha, Plazo, Contacto) para ordenar. Clic de nuevo para invertir el orden.',
      },
      {
        type: 'feature',
        title: 'Historial de actividad',
        description:
          'Nuevo panel lateral que muestra el historial de acciones realizadas: aprobaciones, rechazos, favoritos e intereses.',
      },
      {
        type: 'improvement',
        title: 'Soporte multi-tenant',
        description:
          'La plataforma ahora soporta multiples organizaciones con datos aislados por orgId.',
      },
    ],
  },
  {
    version: '1.11.0',
    date: '2026-02-13',
    headline: 'Deteccion de emergencias',
    features: [
      {
        type: 'feature',
        title: 'Licitaciones de emergencia',
        description:
          'Los emails con "emergencia" en el asunto ahora se marcan automaticamente con borde rojo, badge pulsante y puntuacion elevada para maxima visibilidad.',
      },
    ],
  },
  {
    version: '1.10.0',
    date: '2026-02-12',
    headline: 'Busqueda por archivos BID y fetch manual sin limite',
    features: [
      {
        type: 'improvement',
        title: 'Deteccion de adjuntos BID',
        description:
          'Ahora se detectan automaticamente emails con archivos PDF que comienzan con BID, capturando licitaciones que no tienen palabras clave en el asunto.',
      },
    ],
  },
  {
    version: '1.9.0',
    date: '2026-02-12',
    headline: 'Validacion inteligente, correcciones semanticas y log de calidad',
    features: [
      {
        type: 'feature',
        title: 'Validacion post-extraccion',
        description:
          'Los municipios, telefonos y fechas extraidos se validan y corrigen automaticamente. Municipios se verifican contra los 78 de PR con fuzzy matching.',
      },
      {
        type: 'feature',
        title: 'Correcciones semanticas',
        description:
          'Las correcciones que haces ahora se recuperan por similitud al documento actual usando embeddings, en vez de mostrar las 5 mas recientes.',
      },
      {
        type: 'feature',
        title: 'Log de calidad de extraccion',
        description:
          'Cada extraccion se registra con score de confianza, problemas de validacion, auto-correcciones y tiempo de procesamiento.',
      },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-02-11',
    headline: 'Tarjetas rediseñadas y mayor capacidad de emails',
    features: [
      {
        type: 'improvement',
        title: 'Tarjetas mas compactas',
        description:
          'Las tarjetas ahora muestran solo la info esencial para triaje rapido. Detalles completos se ven al abrir la licitacion.',
      },
      {
        type: 'improvement',
        title: 'Mejor experiencia movil',
        description:
          'Checkbox, favorito y corazon con areas de toque de 44px. Badges con shadcn Badge para evitar desbordamiento.',
      },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-02-11',
    headline: 'Busqueda de emails ampliada',
    features: [
      {
        type: 'improvement',
        title: 'Mas palabras clave en busqueda',
        description:
          'Ahora se buscan emails con Invitación, Cotización, Propuesta, Pliego, Notificación y Pet.Oferta ademas de Licitación y Subasta.',
      },
      {
        type: 'improvement',
        title: 'Dominios de gobierno incluidos',
        description:
          'Se incluyen automaticamente emails de @acueductos, @juntadesubastas y @gobierno.pr aunque no tengan palabras clave en el asunto.',
      },
      {
        type: 'improvement',
        title: 'Procesamiento mas rapido',
        description:
          'Se aumentó el limite de emails por ejecución de 3 a 5 para procesar correos pendientes mas rapido.',
      },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-02-11',
    headline: 'Interfaz simplificada, cron cada hora y ajustes de IA',
    features: [
      {
        type: 'improvement',
        title: 'Interfaz simplificada',
        description:
          'Se removio el boton de descarte rapido y la columna de estado. Las licitaciones aprobadas ahora se resaltan en verde.',
      },
      {
        type: 'improvement',
        title: 'Busqueda de emails cada hora',
        description:
          'El cron ahora busca emails automaticamente cada hora en vez de una vez al dia.',
      },
      {
        type: 'feature',
        title: 'Ajustes de IA y edicion de campos',
        description:
          'Nuevo tab de ajustes de IA y posibilidad de editar campos directamente desde el modal de detalle.',
      },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-02-11',
    headline: 'Compartir visitas por WhatsApp y correccion de emails',
    features: [
      {
        type: 'fix',
        title: 'Corregido error al buscar emails',
        description:
          'Se corrigio un error de DOMMatrix que impedia procesar emails en Vercel. La importacion de pdf-parse ahora es dinamica para compatibilidad con serverless.',
      },
      {
        type: 'feature',
        title: 'Compartir visitas por WhatsApp',
        description:
          'Boton para compartir tarjeta de visita directamente por WhatsApp desde las tarjetas y el modal de detalle.',
      },
      {
        type: 'improvement',
        title: 'Vista de tabla por defecto',
        description:
          'La vista de tabla es ahora la vista predeterminada. Se removio la columna de valor estimado y la fecha ahora siempre muestra la fecha del email.',
      },
      {
        type: 'feature',
        title: 'Sistema de novedades',
        description:
          'Nueva pagina de novedades con historial de cambios y notificacion de nuevas versiones.',
      },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-02-11',
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


