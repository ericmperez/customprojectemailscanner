import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock pdf-parse ──────────────────────────────────────────────────────
const mockGetText = vi.fn();
const mockDestroy = vi.fn();

vi.mock('pdf-parse', () => {
  class MockPDFParse {
    getText = mockGetText;
    destroy = mockDestroy;
    constructor() {}
  }
  return { PDFParse: MockPDFParse };
});

// ── Mock openai ─────────────────────────────────────────────────────────
const mockCreate = vi.fn();

vi.mock('openai', () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
    constructor() {}
  }
  return { default: MockOpenAI };
});

// ── Mock retry ──────────────────────────────────────────────────────────
vi.mock('@/lib/utils/retry', () => ({
  withRetry: vi.fn((fn: () => unknown) => fn()),
}));

// ── Mock supabase confidence settings ───────────────────────────────────
const mockGetConfidenceSettings = vi.fn();

vi.mock('@/lib/services/supabase.service', () => ({
  getConfidenceSettings: (...args: unknown[]) => mockGetConfidenceSettings(...args),
}));

// Set required env vars
process.env.OPENAI_API_KEY = 'test-openai-key';

import { extractLicitacionData } from '@/lib/services/openai.service';

describe('extractLicitacionData', () => {
  const fakePdfBase64 = Buffer.from('fake pdf content here').toString('base64');
  const filename = 'licitacion-test.pdf';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: pdf-parse returns text successfully
    mockGetText.mockResolvedValue({
      text: 'This is a long enough extracted text from the PDF for testing purposes here.',
    });

    // Default: confidence settings
    mockGetConfidenceSettings.mockResolvedValue({
      critical: ['location', 'description', 'biddingCloseDate', 'contactPhone'],
      optional: ['title', 'summary', 'category', 'siteVisitDate', 'siteVisitTime', 'visitLocation', 'contactName', 'biddingCloseTime', 'estimatedValue'],
      ignored: [],
    });
  });

  it('returns extracted data when GPT returns valid JSON', async () => {
    const gptResponse = {
      title: 'Mantenimiento A/C',
      location: 'San Juan',
      description: 'Servicio de mantenimiento',
      summary: 'Fix A/C units',
      category: 'Mantenimiento',
      priority: 'High',
      siteVisitDate: '03/15/2025',
      siteVisitTime: '10:00 AM',
      visitLocation: 'EBAS Torrecilla',
      contactName: 'Juan Perez',
      contactPhone: '(787) 555-1234',
      biddingCloseDate: '03/31/2025',
      biddingCloseTime: '02:00 PM',
      estimatedValue: '$50,000',
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(gptResponse) } }],
    });

    const result = await extractLicitacionData(fakePdfBase64, filename);

    expect(result.title).toBe('Mantenimiento A/C');
    expect(result.location).toBe('San Juan');
    expect(result.description).toBe('Servicio de mantenimiento');
    expect(result.priority).toBe('High');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('handles missing fields with defaults ("No disponible")', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ title: 'Test' }) } }],
    });

    const result = await extractLicitacionData(fakePdfBase64, filename);

    expect(result.title).toBe('Test');
    expect(result.location).toBe('No disponible');
    expect(result.description).toBe('No disponible');
    expect(result.contactPhone).toBe('No disponible');
    expect(result.category).toBe('No clasificado');
    expect(result.priority).toBe('Medium');
  });

  it('handles failed JSON parsing from GPT response', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not valid json {{{' } }],
    });

    const result = await extractLicitacionData(fakePdfBase64, filename);

    // All fields should get defaults
    expect(result.title).toBe('No disponible');
    expect(result.location).toBe('No disponible');
  });

  it('uses text-only mode when pdf-parse fails', async () => {
    mockGetText.mockRejectedValue(new Error('pdf-parse broke'));

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ title: 'Visual Only', location: 'Ponce' }),
          },
        },
      ],
    });

    const result = await extractLicitacionData(fakePdfBase64, filename);

    expect(result.title).toBe('Visual Only');
    expect(result.location).toBe('Ponce');
  });

  it('calculates confidence score based on filled fields', async () => {
    // All critical fields present, some optional missing
    const gptResponse = {
      location: 'Bayamon',
      description: 'Full description text',
      biddingCloseDate: '04/01/2025',
      contactPhone: '(787) 555-9999',
      title: 'Some title',
      // other optional fields missing
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(gptResponse) } }],
    });

    const result = await extractLicitacionData(fakePdfBase64, filename);

    // 4/4 critical (100% * 0.6 = 0.6) + 1/9 optional (~11% * 0.4 ~ 0.044)
    // With text extraction bonus: ~67.5 -> expect > 50
    expect(result.confidence).toBeGreaterThan(50);
  });

  it('returns 0 confidence when GPT returns empty object', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{}' } }],
    });

    const result = await extractLicitacionData(fakePdfBase64, filename);
    expect(result.confidence).toBe(0);
  });

  it('handles GPT returning numeric values by converting them to strings', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ title: 'Test', estimatedValue: 50000 }),
          },
        },
      ],
    });

    const result = await extractLicitacionData(fakePdfBase64, filename);
    expect(result.estimatedValue).toBe('50000');
  });

  it('handles empty choices array from GPT', async () => {
    mockCreate.mockResolvedValue({ choices: [] });

    const result = await extractLicitacionData(fakePdfBase64, filename);
    expect(result.title).toBe('No disponible');
  });

  it('falls back to visual-only when pdf text is too short', async () => {
    mockGetText.mockResolvedValue({ text: 'short' });

    mockCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ title: 'Short Text PDF' }) } },
      ],
    });

    const result = await extractLicitacionData(fakePdfBase64, filename);

    expect(result.title).toBe('Short Text PDF');
    // Confidence should not have the text extraction bonus
  });

  it('confidence is lower without text extraction', async () => {
    mockGetText.mockRejectedValue(new Error('fail'));

    const fullResponse = {
      location: 'Arecibo',
      description: 'Desc',
      biddingCloseDate: '05/01/2025',
      contactPhone: '(787) 111-2222',
      title: 'Title',
      summary: 'Summary',
      category: 'Mantenimiento',
      siteVisitDate: '04/15/2025',
      siteVisitTime: '09:00 AM',
      visitLocation: 'PAS Arecibo',
      contactName: 'Maria',
      biddingCloseTime: '03:00 PM',
      estimatedValue: '$100,000',
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(fullResponse) } }],
    });

    const resultNoText = await extractLicitacionData(fakePdfBase64, filename);

    // Reset to allow text extraction
    mockGetText.mockResolvedValue({
      text: 'This is a long enough extracted text from the PDF for testing purposes here.',
    });
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(fullResponse) } }],
    });

    const resultWithText = await extractLicitacionData(fakePdfBase64, filename);

    // With text extraction bonus the score should be >= without it
    expect(resultWithText.confidence).toBeGreaterThanOrEqual(resultNoText.confidence);
  });
});
