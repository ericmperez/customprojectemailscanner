import pdf from 'pdf-parse';
import logger from '../utils/logger.js';
import AIService from './ai.service.js';

class PDFService {
  constructor() {
    this.aiService = new AIService();
  }
  /**
   * Extract text content from PDF buffer
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @returns {Promise<string>} Extracted text
   */
  async extractText(pdfBuffer) {
    try {
      const data = await pdf(pdfBuffer);
      logger.info('PDF text extraction successful', {
        pages: data.numpages,
        textLength: data.text.length,
      });
      return data.text;
    } catch (error) {
      logger.error('Error extracting PDF text:', error);
      throw error;
    }
  }

  /**
   * Extract specific fields from Licitación PDF using AI with regex fallback
   * @param {string} text - Extracted PDF text
   * @returns {Promise<Object>} Extracted fields
   */
  async extractLicitacionFields(text) {
    try {
      // Try AI extraction first
      if (this.aiService.enabled) {
        try {
          logger.info('Attempting AI-based extraction...');
          const aiData = await this.aiService.extractLicitacionData(text);
          
          // Validate AI results
          const isValid = this.validateAIExtraction(aiData);
          
          if (isValid && aiData.confidence >= 50) {
            logger.info(`✅ Using AI extraction (${aiData.confidence}% confidence)`, {
              category: aiData.category,
              priority: aiData.priority
            });
            return aiData;
          } else {
            logger.warn(`AI confidence too low (${aiData.confidence}%), falling back to regex`);
          }
        } catch (aiError) {
          logger.warn('AI extraction failed, falling back to regex:', aiError.message);
        }
      }

      // Fallback to regex extraction
      logger.info('Using regex-based extraction');
      return this.regexExtraction(text);

    } catch (error) {
      logger.error('Error extracting licitación fields:', error);
      throw error;
    }
  }

  /**
   * Validate AI extraction results
   * @param {Object} data - AI extracted data
   * @returns {boolean} Is valid
   */
  validateAIExtraction(data) {
    // Check that critical fields are present
    if (!data.description || data.description === 'No disponible') {
      logger.warn('AI validation failed: missing description');
      return false;
    }

    // Validate phone format if present
    if (data.contactPhone && data.contactPhone !== 'No disponible') {
      if (!this.aiService.isValidPRPhone(data.contactPhone)) {
        logger.warn('AI validation warning: invalid phone format', { phone: data.contactPhone });
        // Don't fail validation, just log warning
      }
    }

    // Validate date formats
    if (data.biddingCloseDate && data.biddingCloseDate !== 'No disponible') {
      if (!this.aiService.isValidDate(data.biddingCloseDate)) {
        logger.warn('AI validation warning: invalid close date format', { date: data.biddingCloseDate });
      }
    }

    return true;
  }

  /**
   * Regex-based extraction (original method, now as fallback)
   * @param {string} text - PDF text
   * @returns {Object} Extracted fields
   */
  regexExtraction(text) {
    const description = this.extractDescription(text);
    
    const rawSiteVisitDate = this.extractSiteVisitDate(text);
    const rawBiddingCloseDate = this.extractBiddingCloseDate(text);

    const fields = {
      location: this.extractLocation(text),
      description: description,
      summary: this.createSummary(description),
      siteVisitDate: this.formatDate(rawSiteVisitDate),
      siteVisitTime: this.extractSiteVisitTime(text),
      visitLocation: this.extractVisitLocation(text),
      contactName: this.extractContactName(text),
      contactPhone: this.extractContactPhone(text),
      biddingCloseDate: this.formatDate(rawBiddingCloseDate),
      biddingCloseTime: this.extractBiddingCloseTime(text),
      category: 'No clasificado', // Regex can't classify
      priority: 'Medium', // Default priority
      confidence: 70, // Assume 70% confidence for regex
      extractionMethod: 'Regex',
      rawText: text.substring(0, 1000), // Keep first 1000 chars for reference
    };

    logger.info('Extracted licitación fields (regex)', {
      hasLocation: !!fields.location,
      hasDescription: !!fields.description,
      hasSummary: !!fields.summary,
      hasSiteVisit: !!fields.siteVisitDate,
      hasContact: !!fields.contactName,
      hasBiddingClose: !!fields.biddingCloseDate,
    });

    return fields;
  }

  /**
   * Parse and format Spanish date strings to MM/DD/YYYY format
   * @param {string} dateStr - Date string in various formats
   * @returns {string} Formatted date as MM/DD/YYYY or original if can't parse
   */
  formatDate(dateStr) {
    if (!dateStr || dateStr === 'No disponible') {
      return 'No disponible';
    }

    try {
      // Spanish month names mapping
      const spanishMonths = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
        'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
        'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
      };

      // Remove day names like "LUNES", "martes", etc.
      let cleanDate = dateStr.replace(/^(lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)\s+/i, '').trim();

      // Pattern 1: Already in MM/DD/YYYY format
      const usDateMatch = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (usDateMatch) {
        const month = usDateMatch[1].padStart(2, '0');
        const day = usDateMatch[2].padStart(2, '0');
        const year = usDateMatch[3];
        return `${month}/${day}/${year}`;
      }

      // Pattern 2: Spanish format "28 de noviembre" or "28 de noviembre de 2025"
      const spanishDateMatch = cleanDate.match(/(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?/i);
      if (spanishDateMatch) {
        const day = spanishDateMatch[1].padStart(2, '0');
        const monthName = spanishDateMatch[2].toLowerCase();
        const year = spanishDateMatch[3] || new Date().getFullYear();
        
        const monthNum = spanishMonths[monthName];
        
        if (monthNum !== undefined) {
          const month = (monthNum + 1).toString().padStart(2, '0');
          return `${month}/${day}/${year}`;
        }
      }

      // If we can't parse it, return original
      return dateStr;

    } catch (error) {
      logger.warn(`Could not format date: ${dateStr}`, error);
      return dateStr;
    }
  }

  /**
   * Extract location from PDF text
   * Prioritizes extracting the "Ciudad" (city/town) field
   * @param {string} text - PDF text
   * @returns {string|null} Extracted location
   */
  extractLocation(text) {
    // Helper function to clean location (remove zip codes and extra info)
    const cleanLocation = (location) => {
      return location
        // Remove "Cod. Postal:" and everything after
        .replace(/\s*Cod\.?\s*Postal\s*:?\s*\d+.*$/i, '')
        // Remove standalone zip codes (5 digits)
        .replace(/\s+\d{5}\s*$/, '')
        // Remove "PR" or "Puerto Rico" and everything after
        .replace(/\s*(PR|Puerto Rico).*$/i, '')
        .trim();
    };

    // First priority: Look for "Ciudad:" field specifically
    const ciudadPatterns = [
      /Ciudad\s*:?\s*([A-ZÁÉÍÓÚÑ][a-zA-ZáéíóúñÁÉÍÓÚÑ\s]+?)(?:\n|Cod|,|$)/i,
      /Ciudad\s*:?\s*([^\n,]{3,50})/i,
    ];

    for (const pattern of ciudadPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const ciudad = cleanLocation(match[1]);
        if (ciudad) return ciudad;
      }
    }

    // Second priority: Municipio or Localidad
    const municipioPatterns = [
      /(?:Municipio|Localidad)\s*:?\s*([A-ZÁÉÍÓÚÑ][a-zA-ZáéíóúñÁÉÍÓÚÑ\s]+?)(?:\n|Cod|,|$)/i,
      /(?:Municipio|Localidad)\s*:?\s*([^\n,]{3,50})/i,
    ];

    for (const pattern of municipioPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const municipio = cleanLocation(match[1]);
        if (municipio) return municipio;
      }
    }

    // Fallback: Other location patterns
    const fallbackPatterns = [
      /(?:Ubicaci[óo]n|Lugar)\s*:?\s*([^\n]{5,200})/i,
      /Provincia\s*:?\s*([^\n]{5,200})/i,
    ];

    for (const pattern of fallbackPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const location = cleanLocation(match[1]);
        if (location) return location;
      }
    }

    logger.warn('Could not extract location from PDF');
    return 'No se pudo extraer la ubicación';
  }

  /**
   * Extract description/object of bidding
   * Common patterns: "Objeto:", "Descripción:", "Objeto de la licitación:"
   * @param {string} text - PDF text
   * @returns {string|null} Extracted description
   */
  extractDescription(text) {
    const descriptionPatterns = [
      /(?:Objeto|Descripci[óo]n|Asunto)\s*(?:de\s*la\s*licitaci[óo]n)?\s*:?\s*([^\n]{10,500})/i,
      /(?:Object|Description|Subject)\s*:?\s*([^\n]{10,500})/i,
      /Licitaci[óo]n\s*(?:para|de)\s*:?\s*([^\n]{10,500})/i,
    ];

    for (const pattern of descriptionPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: extract first few meaningful lines after "Licitación"
    const licitacionIndex = text.toLowerCase().indexOf('licitación');
    if (licitacionIndex !== -1) {
      const afterLicitacion = text.substring(licitacionIndex, licitacionIndex + 500);
      const lines = afterLicitacion.split('\n').filter(line => line.trim().length > 20);
      if (lines.length > 0) {
        return lines[0].trim();
      }
    }

    logger.warn('Could not extract description from PDF');
    return 'No se pudo extraer la descripción';
  }

  /**
   * Create a concise summary from the description
   * Extracts the key information about what the bidding is for
   * @param {string} description - Full description text
   * @returns {string} Concise summary
   */
  createSummary(description) {
    if (!description || description === 'No se pudo extraer la descripción') {
      return 'No disponible';
    }

    // Remove common prefixes
    let summary = description
      .replace(/^(?:Objeto|Descripción|Asunto)\s*(?:de\s*la\s*licitación)?\s*:?\s*/i, '')
      .replace(/^Licitación\s*(?:para|de)\s*:?\s*/i, '')
      .trim();

    // Take first sentence or first 150 characters
    const firstSentence = summary.split(/[.;]|Lugar:|Ubicación:|Ciudad:/i)[0].trim();
    
    if (firstSentence.length > 150) {
      return firstSentence.substring(0, 147) + '...';
    }

    return firstSentence || summary.substring(0, 150);
  }

  /**
   * Extract site visit date from PDF text
   * Pattern: "Día: 3 de noviembre" or "VISITA EL DÍA 4 DE NOVIEMBRE DE 2025"
   * @param {string} text - PDF text
   * @returns {string|null} Extracted site visit date
   */
  extractSiteVisitDate(text) {
    const datePatterns = [
      // Pattern: "#DIA: LUNES 3 DE NOVIEMBRE DE 2025"
      /#DIA\s*:\s*([^#\n]{3,100})/i,
      // Pattern: "VISITA EL DÍA 4 DE NOVIEMBRE DE 2025"
      /VISITA\s+EL\s+D[ÍI]A\s+(\d{1,2}\s+DE\s+\w+(?:\s+DE\s+\d{4})?)/i,
      /D[íi]a\s*:\s*([^\n#]{3,50})/i,
      /Fecha\s*(?:de\s*)?(?:Site\s*Visit|Visita)\s*:?\s*([^\n#]{3,50})/i,
      /Site\s*Visit[#\s]*D[íi]a\s*:\s*([^\n#]{3,50})/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return 'No disponible';
  }

  /**
   * Extract site visit time from PDF text
   * Pattern: "Hora: 10:00 am" or "A LAS 10:30 AM"
   * @param {string} text - PDF text
   * @returns {string|null} Extracted site visit time
   */
  extractSiteVisitTime(text) {
    const timePatterns = [
      // Pattern: "A LAS 10:30 AM" or "HORA: 10:00 AM"
      /A\s+LAS\s+([0-9]{1,2}[:.][0-9]{2}\s*(?:[AP]\.?M\.?))/i,
      /#HORA\s*:\s*([0-9]{1,2}[:.][0-9]{2}\s*(?:[AP]\.?M\.?))/i,
      /Hora\s*:\s*([0-9]{1,2}[:.][0-9]{2}\s*(?:[AP]\.?M\.?))/i,
      /Hora\s*:\s*([0-9]{1,2}[:.][0-9]{2})/i,
      /Site\s*Visit[#\s]*Hora\s*:\s*([^\n#]{3,25})/i,
      /Horario\s*:\s*([^\n#]{3,25})/i,
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const normalized = this._normalizeTimeToken(match[1]);
        if (normalized) {
          return normalized;
        }
      }
    }

    const genericMatch = text.match(/(\d{1,2}[:.]\d{2}\s*(?:[ap]\.?m\.?)?)/i);
    if (genericMatch && genericMatch[1]) {
      const normalized = this._normalizeTimeToken(genericMatch[1]);
      if (normalized) {
        return normalized;
      }
    }

    return 'No disponible';
  }

  _normalizeTimeToken(value) {
    if (!value) {
      return null;
    }

    let raw = String(value)
      .trim()
      .replace(/a\.?\s*m\.?/gi, 'AM')
      .replace(/p\.?\s*m\.?/gi, 'PM')
      .replace(/[()]/g, ' ')
      .replace(/[,.;]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!raw) {
      return null;
    }

    const tokenMatch = raw.match(/(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)/i);
    const target = tokenMatch ? tokenMatch[1] : raw;

    const amPmMatch = target.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)$/i);
    if (amPmMatch) {
      let hours = parseInt(amPmMatch[1], 10);
      const minutes = amPmMatch[2];
      const period = amPmMatch[3].toUpperCase();
      const displayHours = hours % 12 || 12;
      return `${String(displayHours).padStart(2, '0')}:${minutes} ${period}`;
    }

    const hourPeriodMatch = target.match(/^(\d{1,2})\s*(AM|PM)$/i);
    if (hourPeriodMatch) {
      const period = hourPeriodMatch[2].toUpperCase();
      const displayHours = (parseInt(hourPeriodMatch[1], 10) % 12) || 12;
      return `${String(displayHours).padStart(2, '0')}:00 ${period}`;
    }

    const standardMatch = target.match(/^(\d{1,2})[:.](\d{2})$/);
    if (standardMatch) {
      const hours = parseInt(standardMatch[1], 10) % 24;
      const minutes = standardMatch[2];
      return `${String(hours).padStart(2, '0')}:${minutes}`;
    }

    return null;
  }

  /**
   * Extract visit location from PDF text
   * Pattern: "LUGAR DE ENCUENTRO: PF GUILARTE ADJUNTAS" or "LUGAR: ..."
   * @param {string} text - PDF text
   * @returns {string|null} Extracted visit location
   */
  extractVisitLocation(text) {
    const locationPatterns = [
      // Pattern: "#LUGAR DE ENCUENTRO: PF GUILARTE ADJUNTAS"
      /#LUGAR\s*(?:DE\s*ENCUENTRO)?\s*:\s*([^#\n]{3,100})/i,
      /LUGAR\s*DE\s*ENCUENTRO\s*:\s*([^#\n]{3,100})/i,
      /LUGAR\s*:\s*([^#\n]{3,100})/i,
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return 'No disponible';
  }

  /**
   * Extract contact name from PDF text
   * Pattern: "Contacto: Francisco Sosa 787-406-94" or "CON EL SUP. LUIS RODRÍGUEZ"
   * @param {string} text - PDF text
   * @returns {string|null} Extracted contact name
   */
  extractContactName(text) {
    const contactPatterns = [
      // Pattern: "#PERSONA CONTACTO: BERTMARIE RODRIGUEZ"
      /#PERSONA\s*CONTACTO\s*:\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s]+?)(?:#|TEL)/i,
      // Pattern: "CON EL SUP. LUIS RODRÍGUEZ"
      /CON\s+EL\s+SUP\.?\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s]+?)(?:,|\d{3})/i,
      /CON\s+(?:EL\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s]+?)(?:,|\d{3})/i,
      /Contacto\s*:\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s]+?)(?:\d{3}[-\s]?\d{3}[-\s]?\d{2,4})/i,
      /Contacto\s*:\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s]{3,50}?)(?:\n|#)/i,
    ];

    for (const pattern of contactPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return 'No disponible';
  }

  /**
   * Extract contact phone from PDF text
   * Pattern: Phone numbers like "787-406-94\n20" which should become "787-406-9420"
   * Format: Always returns "787-xxx-xxxx"
   * @param {string} text - PDF text
   * @returns {string|null} Extracted contact phone
   */
  extractContactPhone(text) {
    // Pattern 0: Look for "#TEL: 787-259-5700 EXT 3032" - don't clean # yet
    const telPattern = /#TEL\s*:\s*(787|939)[-\s]?(\d{3})[-\s]?(\d{4})/i;
    const telMatch = text.match(telPattern);
    
    if (telMatch) {
      return `${telMatch[1]}-${telMatch[2]}-${telMatch[3]}`;
    }
    
    // Clean text - remove # symbols that might interfere
    const cleanText = text.replace(/#/g, ' ');
    
    // Pattern 1: Look for complete phone numbers (787-345-1742 or 787-3451742)
    const completePattern = /(787|939)[-\s]?(\d{3})[-\s]?(\d{4})(?!\d)/;
    const completeMatch = cleanText.match(completePattern);
    
    if (completeMatch) {
      return `${completeMatch[1]}-${completeMatch[2]}-${completeMatch[3]}`;
    }
    
    // Pattern 2: Look for phone number after Contacto (can be on next line)
    // Match pattern: Contacto:\nName 787-406-94
    // Important: Stop before UPC or other long numeric codes
    const contactoMatch = cleanText.match(/Contacto\s*:[\s\S]{0,200}?(\d{3})[-\s]?(\d{3})[-\s]?(\d{2,4})(?!\d)/i);
    
    if (contactoMatch) {
      const area = contactoMatch[1];    // 787
      const prefix = contactoMatch[2];  // 406
      const digits = contactoMatch[3];  // 94 or 9420
      
      // Validate it's a Puerto Rico phone number (787, 939)
      if (area !== '787' && area !== '939') {
        // Not a valid PR phone number, skip it
        logger.info(`Skipping non-PR phone pattern: ${area}-${prefix}-${digits}`);
        return 'No disponible';
      }
      
      // If we already have 4 digits, we're done
      if (digits.length === 4) {
        return `${area}-${prefix}-${digits}`;
      }
      
      // If we have 2 digits, look for the next 2
      if (digits.length === 2) {
        const firstTwo = digits;
        
        // Find position after the matched text
        const afterPhone = cleanText.indexOf(contactoMatch[0]) + contactoMatch[0].length;
        const remainingText = cleanText.substring(afterPhone, afterPhone + 30);
        
        // Look for 2 standalone digits (on new line or after whitespace/symbols)
        // But NOT if followed by more digits (to avoid UPC codes)
        const lastTwoMatch = remainingText.match(/[\s\n\r]+(\d{2})(?!\d)/);
        
        if (lastTwoMatch) {
          const lastTwo = lastTwoMatch[1];
          return `${area}-${prefix}-${firstTwo}${lastTwo}`;
        }
      }
      
      // If we have 3 digits, look for 1 more
      if (digits.length === 3) {
        const firstThree = digits;
        const afterPhone = cleanText.indexOf(contactoMatch[0]) + contactoMatch[0].length;
        const remainingText = cleanText.substring(afterPhone, afterPhone + 20);
        const lastDigit = remainingText.match(/[\s\n\r]+(\d)(?!\d)/);
        
        if (lastDigit) {
          return `${area}-${prefix}-${firstThree}${lastDigit[1]}`;
        }
      }
    }

    return 'No disponible';
  }

  /**
   * Extract bidding close date from PDF text
   * Pattern: "Validez de su oferta hasta:" or "Fecha de cierre" or similar
   * @param {string} text - PDF text
   * @returns {string|null} Extracted bidding close date
   */
  extractBiddingCloseDate(text) {
    const datePatterns = [
      // Primary pattern: "Validez de su oferta hasta: 11/29/2025"
      /Validez\s*de\s*su\s*oferta\s*hasta\s*:?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i,
      /Validez\s*de\s*su\s*oferta\s*hasta\s*:?\s*([^\n#]{3,50})/i,
      // Other patterns
      /(?:Fecha\s*de\s*)?(?:Cierre|cierre|entrega)\s*de\s*(?:propuestas?|ofertas?)\s*:?\s*([^\n#]{3,50})/i,
      /Fecha\s*[lí]mite\s*(?:de\s*entrega)?\s*:?\s*([^\n#]{3,50})/i,
      /Fecha\s*de\s*cierre\s*:?\s*([^\n#]{3,50})/i,
      /(?:Due\s*date|Deadline)\s*:?\s*([^\n#]{3,50})/i,
      /Entrega\s*de\s*propuestas?\s*:?\s*([^\n#]{3,50})/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        // Clean up the extracted date
        let date = match[1].trim();
        // Remove "Hora:" or time info if it got captured
        date = date.replace(/\s*Hora\s*:.*$/i, '').trim();
        return date;
      }
    }

    return 'No disponible';
  }

  /**
   * Extract bidding close time from PDF text
   * Pattern: Time associated with close date (often on same line as "Validez de su oferta hasta")
   * @param {string} text - PDF text
   * @returns {string|null} Extracted bidding close time
   */
  extractBiddingCloseTime(text) {
    const timePatterns = [
      // Primary pattern: Time on same line as "Validez de su oferta hasta: 11/29/2025 04:00:00PM"
      /Validez\s*de\s*su\s*oferta\s*hasta\s*:?.*?([0-9]{1,2}:[0-9]{2}:[0-9]{2}\s*[AP]M)/i,
      /Validez\s*de\s*su\s*oferta\s*hasta\s*:?.*?([0-9]{1,2}:[0-9]{2}\s*[ap]m)/i,
      // Pattern: "Período de presentación de la oferta: 00:00:00AM- 11/07/2025 04:00:00PM" (extract last time)
      /Per[íi]odo\s*de\s*presentaci[óo]n.*?[0-9\/]+\s*([0-9]{1,2}:[0-9]{2}:[0-9]{2}\s*[AP]M)/i,
      // Other patterns
      /(?:Cierre|entrega).*?Hora\s*:?\s*([0-9]{1,2}:[0-9]{2}\s*[ap]m)/i,
      /Fecha\s*de\s*cierre.*?([0-9]{1,2}:[0-9]{2}\s*[ap]m)/i,
      /Entrega.*?(?:a\s*las?|@)\s*([0-9]{1,2}:[0-9]{2}\s*[ap]m)/i,
      /Hora\s*de\s*cierre\s*:?\s*([0-9]{1,2}:[0-9]{2}\s*[ap]m)/i,
      /Hora\s*l[íi]mite\s*:?\s*([0-9]{1,2}:[0-9]{2}\s*[ap]m)/i,
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return 'No disponible';
  }

  /**
   * Process PDF attachment from Gmail
   * @param {Object} attachment - Attachment object with base64 data
   * @returns {Promise<Object>} Extracted fields
   */
  async processPDFAttachment(attachment) {
    try {
      // Convert base64 to buffer
      const pdfBuffer = Buffer.from(attachment.data, 'base64');
      
      logger.info(`Processing PDF: ${attachment.filename}`);

      // Extract text
      const text = await this.extractText(pdfBuffer);

      // Extract specific fields (now async with AI)
      const fields = await this.extractLicitacionFields(text);

      return {
        filename: attachment.filename,
        ...fields,
      };
    } catch (error) {
      logger.error(`Error processing PDF ${attachment.filename}:`, error);
      throw error;
    }
  }
}

export default PDFService;

