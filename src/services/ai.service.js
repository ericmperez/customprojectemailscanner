import OpenAI from 'openai';
import logger from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

class AIService {
  constructor() {
    const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      logger.warn('GROQ_API_KEY not set - AI extraction will be disabled');
      this.enabled = false;
      return;
    }

    const isGroq = !!process.env.GROQ_API_KEY;
    this.provider = isGroq ? 'groq' : 'openai';
    this.model = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

    this.openai = new OpenAI({
      apiKey,
      ...(isGroq && { baseURL: 'https://api.groq.com/openai/v1' }),
    });
    this.enabled = true;
    logger.info(`AI Service initialized with ${this.provider} (model: ${this.model})`);
  }

  /**
   * Extract licitación data from PDF text using AI
   * @param {string} pdfText - Raw text extracted from PDF
   * @returns {Promise<Object>} Extracted fields
   */
  async extractLicitacionData(pdfText) {
    if (!this.enabled) {
      throw new Error('AI Service is not enabled - OPENAI_API_KEY not configured');
    }

    const prompt = `You are an expert at analyzing Puerto Rico government bidding documents (Licitaciones de la Autoridad de Acueductos y Alcantarillados). Extract structured data from this document.

DOCUMENT TEXT:
${pdfText.substring(0, 8000)}

Extract the following information in JSON format:

{
  "location": "City/Municipality ONLY",
  "description": "Complete project description",
  "summary": "One-sentence summary (max 150 chars)",
  "siteVisitDate": "MM/DD/YYYY",
  "siteVisitTime": "HH:MM AM/PM",
  "visitLocation": "Site visit meeting place",
  "contactName": "Contact person name",
  "contactPhone": "787-XXX-XXXX or 939-XXX-XXXX",
  "biddingCloseDate": "MM/DD/YYYY",
  "biddingCloseTime": "HH:MM AM/PM",
  "category": "Work category",
  "estimatedValue": "Contract value",
  "priority": "High/Medium/Low"
}

DETAILED EXTRACTION INSTRUCTIONS:

📍 LOCATION (location):
- Extract ONLY the municipality/city name
- Look for: "Ciudad:", "Municipio:", "Localidad:", "Ubicación:"
- Remove: zip codes (00000), "PR", "Puerto Rico", "Cod. Postal"
- Examples: "San Juan", "Caguas", "Ponce", "Mayagüez"

📄 DESCRIPTION (description):
- Full project description from "Objeto:", "Descripción:", "Asunto:"
- Include what work is being requested
- Keep it detailed but remove redundant headers

📝 SUMMARY (summary):
- ONE concise sentence (max 150 characters)
- Focus on the main work/service being requested
- Example: "Mantenimiento de unidades de filtro prensa"

📅 SITE VISIT DATE (siteVisitDate):
- Convert Spanish dates to MM/DD/YYYY
- Look for: "DIA:", "VISITA EL DÍA", "Fecha de Visita", "Día:"
- Remove day names: LUNES, martes, miércoles, etc.
- Examples: "LUNES 3 DE NOVIEMBRE DE 2025" → "11/03/2025"
- NOTE: If bidding is for PURCHASES/SUPPLIES (Suministros), there usually is NO site visit - use "No disponible"

⏰ SITE VISIT TIME (siteVisitTime):
- Format as HH:MM AM/PM
- Look for: "HORA:", "A LAS", time patterns
- Examples: "10:00 AM", "2:30 PM"
- NOTE: If bidding is for PURCHASES/SUPPLIES (Suministros), there usually is NO site visit - use "No disponible"

📍 VISIT LOCATION (visitLocation):
- Physical meeting place for site visit
- Look for: "LUGAR DE ENCUENTRO:", "LUGAR:", "meeting location"
- Example: "PF GUILARTE ADJUNTAS", "Oficina Regional Este"
- NOTE: If bidding is for PURCHASES/SUPPLIES (Suministros), there usually is NO site visit - use "No disponible"

👤 CONTACT NAME (contactName):
- Full name of contact person
- Look for: "PERSONA CONTACTO:", "Contacto:", "CON EL", "CON"
- Remove titles like "Ing.", "Sr.", "Sra." but keep the name
- Examples: "Gerson Diaz", "Francisco Sosa", "Luis Rodríguez"

📞 CONTACT PHONE (contactPhone):
- ONLY Puerto Rico numbers (area codes 787 or 939)
- Format as: 787-XXX-XXXX
- Look for: "TEL:", "Teléfono:", phone patterns
- Handle split numbers: "787-406-94" followed by "20" on next line → "787-406-9420"
- IGNORE: Long numeric codes (UPC codes, invoice numbers)

📅 BIDDING CLOSE DATE (biddingCloseDate):
- Convert to MM/DD/YYYY
- PRIMARY: Look for "Validez de su oferta hasta:"
- ALSO: "Fecha de cierre", "Entrega de propuestas", "Fecha límite"
- Examples: "Validez de su oferta hasta: 11/29/2025" → "11/29/2025"

⏰ BIDDING CLOSE TIME (biddingCloseTime):
- Format as HH:MM AM/PM
- Look on same line as close date or nearby
- Examples: "04:00:00PM" → "04:00 PM"

🏗️ CATEGORY (category):
- Classify the type of work in Spanish:
  * "Construcción" - Building, infrastructure work
  * "Servicios" - Maintenance, repairs, professional services
  * "Suministros" - Materials, supplies, equipment purchase
  * "Equipos" - Equipment rental or purchase
  * "Mantenimiento" - Maintenance services
- Be specific when possible: "Servicios - Mantenimiento de filtros"

💰 ESTIMATED VALUE (estimatedValue):
- Look for contract value, budget estimates
- Include currency: "$50,000", "No disponible"

⚡ PRIORITY (priority):
- High: Urgent (< 7 days to close), complex work, high value, mandatory site visit
- Medium: Standard timeline (1-4 weeks), routine work
- Low: Long timeline (> 4 weeks), simple work, low value

CRITICAL RULES:
1. If field is not found or unclear: use "No disponible"
2. NEVER make up information
3. NEVER leave fields empty - always provide a value
4. Spanish month names: enero=01, febrero=02, marzo=03, abril=04, mayo=05, junio=06, julio=07, agosto=08, septiembre=09, octubre=10, noviembre=11, diciembre=12
5. Always remove day names from dates before converting
6. Phone numbers MUST be PR area codes (787/939) or "No disponible"
7. Dates MUST be MM/DD/YYYY format
8. Times MUST be HH:MM AM/PM format
9. **IMPORTANT**: Purchase orders (Suministros/Supplies) typically DON'T have site visits - this is NORMAL. Use "No disponible" for siteVisitDate, siteVisitTime, and visitLocation when the category is Suministros/Supplies/Equipos.
10. Construction/Services biddings usually DO have site visits - extract if present

Return ONLY valid JSON, no additional text.`;

    try {
      logger.info(`Calling ${this.provider} API for data extraction (model: ${this.model})...`);

      const response = await withRetry(
        () =>
          this.openai.chat.completions.create({
            model: this.model,
            messages: [
              {
                role: "system",
                content: "You are an expert at analyzing Puerto Rico government bidding documents (Licitaciones) and extracting structured data. You understand Spanish and can parse various date formats. Always return valid JSON only, no markdown fences."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            ...(this.provider === 'openai' && { response_format: { type: "json_object" } }),
            temperature: 0.1,
            max_tokens: 1000,
          }),
        { label: `${this.provider}.chat.completions` }
      );

      let content = response.choices[0].message.content.trim();
      // Strip markdown code fences if present
      content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      const extractedData = JSON.parse(content);
      
      // Calculate confidence score
      const confidence = this.calculateConfidence(extractedData);
      
      logger.info('AI extraction completed', { 
        confidence: `${confidence}%`,
        category: extractedData.category,
        priority: extractedData.priority 
      });

      return {
        ...extractedData,
        confidence,
        extractionMethod: 'AI'
      };

    } catch (error) {
      logger.error('Error in AI extraction:', error.message);
      throw error;
    }
  }

  /**
   * Calculate confidence score based on data completeness
   * @param {Object} data - Extracted data
   * @returns {number} Confidence percentage
   */
  calculateConfidence(data) {
    const criticalFields = [
      'location',
      'description',
      'biddingCloseDate',
      'contactPhone'
    ];

    // Check if this is a purchase/supplies bidding (no site visit expected)
    const isPurchase = data.category && 
      (data.category.toLowerCase().includes('suministro') || 
       data.category.toLowerCase().includes('supplies') ||
       data.category.toLowerCase().includes('equipo') ||
       data.category.toLowerCase().includes('compra'));

    if (isPurchase) {
      logger.info('Detected purchase order - site visit not expected, adjusting confidence calculation');
    }

    // For purchases, site visit fields are not expected
    const optionalFields = isPurchase 
      ? ['summary', 'contactName', 'biddingCloseTime']
      : ['summary', 'siteVisitDate', 'siteVisitTime', 'visitLocation', 'contactName', 'biddingCloseTime'];

    let score = 0;
    
    // Critical fields: 60% weight
    const criticalFilled = criticalFields.filter(field => 
      data[field] && data[field] !== 'No disponible'
    ).length;
    score += (criticalFilled / criticalFields.length) * 60;

    // Optional fields: 40% weight
    const optionalFilled = optionalFields.filter(field => 
      data[field] && data[field] !== 'No disponible'
    ).length;
    score += (optionalFilled / optionalFields.length) * 40;

    return Math.round(score);
  }

  /**
   * Validate extracted phone number format
   * @param {string} phone - Phone number
   * @returns {boolean} Is valid Puerto Rico phone
   */
  isValidPRPhone(phone) {
    if (!phone || phone === 'No disponible') return false;
    return /^(787|939)-\d{3}-\d{4}$/.test(phone);
  }

  /**
   * Validate date format
   * @param {string} date - Date string
   * @returns {boolean} Is valid MM/DD/YYYY format
   */
  isValidDate(date) {
    if (!date || date === 'No disponible') return false;
    const match = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return false;
    
    const month = parseInt(match[1]);
    const day = parseInt(match[2]);
    const year = parseInt(match[3]);
    
    return month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2025;
  }
}

export default AIService;

