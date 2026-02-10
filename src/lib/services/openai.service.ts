import OpenAI from 'openai';
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions';
// pdf-parse v2 uses named export with class-based API
import { PDFParse } from 'pdf-parse';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface ExtractedLicitacionData {
  title: string;
  location: string;
  description: string;
  summary: string;
  category: string;
  priority: string;
  siteVisitDate: string;
  siteVisitTime: string;
  visitLocation: string;
  contactName: string;
  contactPhone: string;
  biddingCloseDate: string;
  biddingCloseTime: string;
  estimatedValue: string;
  confidence: number;
}

const SYSTEM_PROMPT = `You are an expert at extracting structured data from Puerto Rico government licitación (bidding/tender) PDF documents. These documents are primarily in Spanish.

You will receive BOTH the raw extracted text from the PDF AND the PDF file itself. Use BOTH sources together:
- The extracted text gives you accurate content that may be missed in visual-only reading
- The PDF file gives you layout, tables, and formatting context

Read the ENTIRE document thoroughly before extracting any fields. Pay attention to every page, every table, every detail.

Extract the following fields. If a field is not found, use "No disponible".

**Fields to extract:**
- title: A clear, descriptive title of what is being requested or solicited. Do NOT use generic form names like "Certificación de Recibo de Pliegos" or "Pet.Oferta". Instead, describe the actual work/product, e.g., "Mantenimiento de Unidades A/C en EBAS Torrecilla" or "Suministro de Alarmas de Gas Cloro". If the PDF is just a cover sheet with no project details, use the filename or any available context.
- location: The municipality or town in Puerto Rico (e.g., "San Juan", "Bayamón", "Ponce"). Look for "Municipio", "pueblo", or location context clues. For AAA documents, the region code in the header tells you the area: 01=Sede (Hato Rey), 02=Este (Caguas/Humacao), 03=Norte (Arecibo/Vega Baja), 04=Sur (Ponce/Guayama), 05=Metro (San Juan/Carolina/Trujillo Alto), 07=Oeste (Mayagüez/Aguadilla).
- description: A detailed description of everything being requested in the licitación. Include specific items, quantities, materials, equipment models, locations of work, and any technical specifications mentioned in the PDF. Be thorough — 3-5 sentences. List all key deliverables. If the document has a table of items, summarize all items.
- summary: A plain-language, actionable one-liner explaining what needs to be done. Write it like you're telling a coworker what the job is. Include the key items/work AND the delivery location. Examples: "Buy 2 tires for a tractor and deliver to Manatí", "Fix the A/C units at the Torrecilla water plant in Loíza", "Supply 500 bags of chlorine to the Camuy treatment plant". Do NOT use formal or bureaucratic language.
- category: Classify into ONE of these categories: Construcción, Mantenimiento, Servicios Profesionales, Suministros, Tecnología, Consultoría, Ambiental, Transporte, Salud, Educación, Seguridad, Otro
- priority: Estimate as "High", "Medium", or "Low" based on urgency indicators (short deadlines = High, standard = Medium, far-off = Low)
- siteVisitDate: Date of mandatory/optional site visit in MM/DD/YYYY format. Convert Spanish month names: enero=01, febrero=02, marzo=03, abril=04, mayo=05, junio=06, julio=07, agosto=08, septiembre=09, octubre=10, noviembre=11, diciembre=12
- siteVisitTime: Time of site visit in HH:MM AM/PM format
- visitLocation: The specific address or location where the site visit takes place
- contactName: Name of the contact person
- contactPhone: Contact phone number. Puerto Rico format: (787) XXX-XXXX or (939) XXX-XXXX. Normalize to this format.
- biddingCloseDate: Deadline to submit bids in MM/DD/YYYY format. Apply same Spanish month conversion.
- biddingCloseTime: Time of bidding deadline in HH:MM AM/PM format
- estimatedValue: Estimated project value/budget if mentioned (include $ sign)

**Important rules:**
1. Dates MUST be in MM/DD/YYYY format. Convert "15 de marzo de 2025" → "03/15/2025"
2. Phone numbers MUST use (XXX) XXX-XXXX format
3. If the document appears to be a purchase order (Orden de Compra) rather than a licitación, set category to "Orden de Compra"
4. Look for "Subasta", "Licitación", "Convocatoria", "Invitación" as title indicators
5. For location, prioritize the municipality/town name over specific street addresses
6. If multiple dates appear, the "cierre" or "entrega de propuestas" date is the biddingCloseDate
7. The "visita de sitio" or "inspección" date is the siteVisitDate
8. "PAS" means "Planta de Agua y Saneamiento", "EBAS" means "Estación de Bombas de Agua y Saneamiento"

**Example of a GOOD extraction:**
{
  "title": "Mantenimiento Trimestral de Unidades A/C en EBAS Torrecilla y Villa Carolina",
  "location": "Loíza",
  "description": "Se solicita servicio de mantenimiento preventivo trimestral para todas las unidades de aire acondicionado en la planta EBAS Torrecilla y EBAS Villa Carolina, incluyendo bombas grandes. El trabajo incluye limpieza de filtros, verificación de niveles de refrigerante, inspección de compresores y revisión del sistema eléctrico. Se requiere mano de obra certificada en sistemas HVAC comerciales.",
  "summary": "Service all the A/C units at the Torrecilla and Villa Carolina water plants in Loíza, quarterly maintenance",
  "category": "Mantenimiento",
  "priority": "Medium",
  "siteVisitDate": "02/15/2026",
  "siteVisitTime": "10:00 AM",
  "visitLocation": "EBAS Torrecilla, Carr. 187 Km 5.2, Loíza",
  "contactName": "Juan Pérez Rivera",
  "contactPhone": "(787) 555-1234",
  "biddingCloseDate": "02/28/2026",
  "biddingCloseTime": "02:00 PM",
  "estimatedValue": "$45,000"
}

**Example of a BAD extraction (do NOT do this):**
{
  "title": "AAA Pet.Oferta Metro",
  "description": "Mantenimiento de A/C.",
  "location": "No disponible"
}
Problems: title is a form name not a description, description is too vague, location was available but missed.

Respond ONLY with valid JSON matching the field names above. No markdown, no explanation.`;

/**
 * Optional additional tips loaded from environment variable.
 * Add AI_EXTRACTION_TIPS to .env.local to give GPT-4o extra guidance
 * based on patterns you notice, e.g.:
 *   AI_EXTRACTION_TIPS="When you see 'PAS' it means 'Planta de Agua y Saneamiento'. Always look for the town name near the AAA region code."
 */
function getSystemPrompt(): string {
  const tips = process.env.AI_EXTRACTION_TIPS;
  if (tips) {
    return SYSTEM_PROMPT + '\n\n**Additional extraction tips:**\n' + tips;
  }
  return SYSTEM_PROMPT;
}

/**
 * Extract raw text from a PDF using pdf-parse.
 * Returns the text content or null if extraction fails.
 */
async function extractPdfText(pdfBase64: string): Promise<string | null> {
  let parser: InstanceType<typeof PDFParse> | null = null;
  try {
    const buffer = Buffer.from(pdfBase64, 'base64');
    parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
    const result = await parser.getText();
    const text = result.text?.trim();
    if (text && text.length > 20) {
      return text;
    }
    return null; // Too short = likely scanned image PDF
  } catch (err) {
    console.warn('[openai] pdf-parse failed, using visual-only extraction:', err);
    return null;
  } finally {
    parser?.destroy();
  }
}

/**
 * Send PDF to GPT-4o with dual input: extracted text + visual PDF.
 * pdf-parse provides reliable text content, while the PDF file
 * provides layout and table context that text extraction misses.
 */
export async function extractLicitacionData(
  pdfBase64: string,
  filename: string
): Promise<ExtractedLicitacionData> {
  // Step 1: Extract text with pdf-parse
  const pdfText = await extractPdfText(pdfBase64);

  // Step 2: Build message content parts
  const contentParts: ChatCompletionContentPart[] = [];

  // Always include the visual PDF
  contentParts.push({
    type: 'file',
    file: {
      file_data: `data:application/pdf;base64,${pdfBase64}`,
      filename,
    },
  });

  // Build the text prompt — include extracted text if available
  if (pdfText) {
    const truncatedText = pdfText.length > 15000 ? pdfText.substring(0, 15000) + '\n...[truncated]' : pdfText;
    contentParts.push({
      type: 'text',
      text: `Extract all licitación fields from this PDF document: "${filename}".

Here is the raw text extracted from the PDF for your reference (use this alongside the visual PDF above):

--- START OF EXTRACTED TEXT ---
${truncatedText}
--- END OF EXTRACTED TEXT ---

Read BOTH the visual PDF and the extracted text above thoroughly. Cross-reference them for the most accurate extraction. Return structured JSON with the fields specified in the system prompt.`,
    });
  } else {
    contentParts.push({
      type: 'text',
      text: `Extract all licitación fields from this PDF document: "${filename}". Note: text extraction failed for this PDF, so rely on the visual PDF content. Read every page carefully. Return structured JSON with the fields specified in the system prompt.`,
    });
  }

  // Step 3: Call GPT-4o
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 2500,
    messages: [
      { role: 'system', content: getSystemPrompt() },
      { role: 'user', content: contentParts },
    ],
  });

  const content = response.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(content) as Partial<ExtractedLicitacionData>;

  const data: ExtractedLicitacionData = {
    title: parsed.title || 'No disponible',
    location: parsed.location || 'No disponible',
    description: parsed.description || 'No disponible',
    summary: parsed.summary || 'No disponible',
    category: parsed.category || 'No clasificado',
    priority: parsed.priority || 'Medium',
    siteVisitDate: parsed.siteVisitDate || 'No disponible',
    siteVisitTime: parsed.siteVisitTime || 'No disponible',
    visitLocation: parsed.visitLocation || 'No disponible',
    contactName: parsed.contactName || 'No disponible',
    contactPhone: parsed.contactPhone || 'No disponible',
    biddingCloseDate: parsed.biddingCloseDate || 'No disponible',
    biddingCloseTime: parsed.biddingCloseTime || 'No disponible',
    estimatedValue: parsed.estimatedValue || 'No disponible',
    confidence: 0,
  };

  data.confidence = calculateConfidence(data, !!pdfText);
  return data;
}

/**
 * Calculate extraction confidence score.
 * 60% weight for critical fields, 40% for optional fields.
 * Bonus points when pdf-parse text extraction was available.
 */
function calculateConfidence(data: ExtractedLicitacionData, hadTextExtraction: boolean): number {
  const criticalFields: (keyof ExtractedLicitacionData)[] = [
    'location',
    'description',
    'biddingCloseDate',
    'contactPhone',
  ];
  const optionalFields: (keyof ExtractedLicitacionData)[] = [
    'title',
    'summary',
    'category',
    'siteVisitDate',
    'siteVisitTime',
    'visitLocation',
    'contactName',
    'biddingCloseTime',
    'estimatedValue',
  ];

  const isPresent = (val: string) =>
    val && val !== 'No disponible' && val !== 'No clasificado';

  const criticalScore =
    criticalFields.filter((f) => isPresent(data[f] as string)).length /
    criticalFields.length;
  const optionalScore =
    optionalFields.filter((f) => isPresent(data[f] as string)).length /
    optionalFields.length;

  let score = criticalScore * 0.6 + optionalScore * 0.4;

  // Small confidence boost when text extraction was available (more reliable)
  if (hadTextExtraction) {
    score = Math.min(1, score * 1.05);
  }

  return Math.round(score * 100);
}
