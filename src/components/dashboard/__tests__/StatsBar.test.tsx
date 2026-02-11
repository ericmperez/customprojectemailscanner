import { render, screen, fireEvent } from '@/__tests__/test-utils';
import { StatsBar } from '../StatsBar';
import { buildStats } from '@/__tests__/factories';

describe('StatsBar', () => {
  const defaultProps = {
    stats: buildStats(),
    activeStatus: '',
    onStatusClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all stat items with counts', () => {
    render(<StatsBar {...defaultProps} />);
    expect(screen.getByText('5')).toBeInTheDocument(); // pending
    expect(screen.getByText('3')).toBeInTheDocument(); // approved
    expect(screen.getByText('2')).toBeInTheDocument(); // rejected
  });

  it('renders labels', () => {
    render(<StatsBar {...defaultProps} />);
    expect(screen.getByText('Pendientes')).toBeInTheDocument();
    expect(screen.getByText('Aprobadas')).toBeInTheDocument();
    expect(screen.getByText('Rechazadas')).toBeInTheDocument();
  });

  it('shows interested count when > 0', () => {
    render(<StatsBar {...defaultProps} stats={buildStats({ interested: 7 })} />);
    expect(screen.getByText('Interesadas')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('hides interested when 0', () => {
    render(<StatsBar {...defaultProps} stats={buildStats({ interested: 0 })} />);
    expect(screen.queryByText('Interesadas')).not.toBeInTheDocument();
  });

  it('calls onStatusClick with status name when clicking a stat', () => {
    render(<StatsBar {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]); // pending button
    expect(defaultProps.onStatusClick).toHaveBeenCalledWith('pending');
  });

  it('calls onStatusClick with empty string when clicking the active status', () => {
    render(<StatsBar {...defaultProps} activeStatus="pending" />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(defaultProps.onStatusClick).toHaveBeenCalledWith('');
  });

  it('renders 3 clickable buttons', () => {
    render(<StatsBar {...defaultProps} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
