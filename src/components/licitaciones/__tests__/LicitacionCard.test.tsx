import { render, screen, fireEvent } from '@/__tests__/test-utils';
import { LicitacionCard } from '../LicitacionCard';
import { buildLicitacion } from '@/__tests__/factories';

// Mock the PriceSearchSection to avoid complex dependency issues
vi.mock('@/components/licitaciones/PriceSearchSection', () => ({
  PriceSearchSection: () => <div data-testid="price-search" />,
}));

describe('LicitacionCard', () => {
  const defaultProps = {
    lic: buildLicitacion(),
    isFavorite: false,
    isSelected: false,
    onToggleFavorite: vi.fn(),
    onToggleSelection: vi.fn(),
    onOpenDetail: vi.fn(),
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onResetPending: vi.fn(),
    onToggleInterested: vi.fn(),
    onQuickDismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title', () => {
    render(<LicitacionCard {...defaultProps} />);
    expect(screen.getByText('Mantenimiento de A/C en EBAS')).toBeInTheDocument();
  });

  it('renders approve and reject buttons for pending status', () => {
    render(<LicitacionCard {...defaultProps} />);
    expect(screen.getByLabelText('Aprobar licitación')).toBeInTheDocument();
    expect(screen.getByLabelText('Rechazar licitación')).toBeInTheDocument();
  });

  it('renders reset button for approved status', () => {
    const lic = buildLicitacion({ approvalStatus: 'approved' });
    render(<LicitacionCard {...defaultProps} lic={lic} />);
    expect(screen.getByLabelText('Volver a pendiente')).toBeInTheDocument();
    expect(screen.queryByLabelText('Aprobar licitación')).not.toBeInTheDocument();
  });

  it('calls onApprove when approve button clicked', () => {
    render(<LicitacionCard {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Aprobar licitación'));
    expect(defaultProps.onApprove).toHaveBeenCalledWith(defaultProps.lic.id);
  });

  it('calls onReject when reject button clicked', () => {
    render(<LicitacionCard {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Rechazar licitación'));
    expect(defaultProps.onReject).toHaveBeenCalledWith(defaultProps.lic.id);
  });

  it('calls onOpenDetail when card clicked', () => {
    render(<LicitacionCard {...defaultProps} />);
    // Click the card container (not a button)
    const card = screen.getByText('Mantenimiento de A/C en EBAS').closest('[class*="rounded-lg"]');
    if (card) fireEvent.click(card);
    expect(defaultProps.onOpenDetail).toHaveBeenCalledWith(defaultProps.lic.id);
  });

  it('calls onToggleFavorite when star clicked', () => {
    render(<LicitacionCard {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Agregar a favoritos'));
    expect(defaultProps.onToggleFavorite).toHaveBeenCalledWith(defaultProps.lic.rowNumber);
  });

  it('renders filled star when isFavorite is true', () => {
    render(<LicitacionCard {...defaultProps} isFavorite={true} />);
    expect(screen.getByLabelText('Quitar de favoritos')).toBeInTheDocument();
  });

  it('renders the checkbox', () => {
    render(<LicitacionCard {...defaultProps} />);
    expect(screen.getByLabelText('Seleccionar licitación')).toBeInTheDocument();
  });

  it('shows worth-it score', () => {
    render(<LicitacionCard {...defaultProps} />);
    // The score should be rendered somewhere in the card
    const scoreElement = screen.getByText(/\/10/);
    expect(scoreElement).toBeInTheDocument();
  });

  it('shows quick dismiss button for pending items', () => {
    render(<LicitacionCard {...defaultProps} />);
    expect(screen.getByLabelText('Descartar licitación')).toBeInTheDocument();
  });

  it('hides quick dismiss button for non-pending items', () => {
    const lic = buildLicitacion({ approvalStatus: 'approved' });
    render(<LicitacionCard {...defaultProps} lic={lic} />);
    expect(screen.queryByLabelText('Descartar licitación')).not.toBeInTheDocument();
  });

  it('displays category', () => {
    render(<LicitacionCard {...defaultProps} />);
    // Category appears in both the badge area and the meta section
    const categoryElements = screen.getAllByText(/Mantenimiento/);
    expect(categoryElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Visita type badge when visitLocation is present', () => {
    render(<LicitacionCard {...defaultProps} />);
    // "Visita" appears in multiple places (badge + date labels), so check for at least one
    const visitaElements = screen.getAllByText(/Visita/);
    expect(visitaElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Compra badge when visitLocation is absent', () => {
    const lic = buildLicitacion({ visitLocation: '' });
    render(<LicitacionCard {...defaultProps} lic={lic} />);
    expect(screen.getByText(/Compra/)).toBeInTheDocument();
  });
});
