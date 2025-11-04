// API Base URL
const API_BASE = window.location.origin;

// Current modal state
let currentModalAction = null;
let currentLicitacionId = null;
let isCalendarView = false;
let calendarEvents = [];
let calendarMonthDate = new Date();
let calendarDataLoaded = false;
let currentDetailId = null;
const detailCache = new Map();

// Bulk selection
const selectedCards = new Set();

// Store current licitaciones for export
let currentLicitaciones = [];

// Favorites
let favorites = new Set(JSON.parse(localStorage.getItem('licitacion_favorites') || '[]'));

// Notifications
let notificationsEnabled = Notification.permission === 'granted';

// View mode (cards, list, table)
let currentViewMode = localStorage.getItem('viewMode') || 'cards';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('ServiceWorker registered:', registration.scope);
            })
            .catch((error) => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}

// Load licitaciones on page load
document.addEventListener('DOMContentLoaded', async () => {
    loadStats();
    loadLicitaciones();
    
    // Update notification button initial state
    updateNotificationButton();
    
    // Set initial view mode
    setViewMode(currentViewMode);
    
    // Request notification permissions after a short delay
    setTimeout(async () => {
        await requestNotificationPermission();
    }, 2000);

    ['statusFilter', 'categoryFilter', 'typeFilter', 'dateRangeFilter', 'sortSelect'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', handleFilterChange);
        }
    });

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Search input with debounce
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                handleFilterChange();
            }, 300); // 300ms debounce
        });
    }

    // Make stat items clickable for filtering
    setupStatClickHandlers();

    const calendarToggleBtn = document.getElementById('calendarToggleBtn');
    if (calendarToggleBtn) {
        calendarToggleBtn.addEventListener('click', toggleCalendarView);
    }

    const prevBtn = document.getElementById('calendarPrevBtn');
    const nextBtn = document.getElementById('calendarNextBtn');
    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => changeCalendarMonth(-1));
        nextBtn.addEventListener('click', () => changeCalendarMonth(1));
    }

    const detailCloseBtn = document.getElementById('detailModalCloseBtn');
    const detailDismissBtn = document.getElementById('detailModalDismissBtn');
    const detailDeleteBtn = document.getElementById('detailDeleteBtn');
    if (detailCloseBtn) {
        detailCloseBtn.addEventListener('click', closeDetailModal);
    }
    if (detailDismissBtn) {
        detailDismissBtn.addEventListener('click', closeDetailModal);
    }
    if (detailDeleteBtn) {
        detailDeleteBtn.addEventListener('click', handleDeleteLicitacion);
    }
});

function handleFilterChange() {
    // Update stat items visual feedback
    updateStatItemsActiveState();
    
    if (isCalendarView) {
        calendarDataLoaded = false;
        loadCalendarEvents();
    } else {
        loadLicitaciones();
    }
}

function getCurrentFilters() {
    return {
        status: document.getElementById('statusFilter')?.value || '',
        category: document.getElementById('categoryFilter')?.value || '',
        type: document.getElementById('typeFilter')?.value || '',
        dateRange: document.getElementById('dateRangeFilter')?.value || '',
        search: document.getElementById('searchInput')?.value || '',
    };
}

function buildFilterQueryString(filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.filter(Boolean).forEach(item => params.append(key, item));
        } else if (value) {
            params.append(key, value);
        }
    });

    const query = params.toString();
    return query ? `?${query}` : '';
}

function toggleCalendarView() {
    const cardsContainer = document.getElementById('cardsContainer');
    const calendarContainer = document.getElementById('calendarContainer');
    const toggleBtn = document.getElementById('calendarToggleBtn');

    isCalendarView = !isCalendarView;

    if (isCalendarView) {
        calendarDataLoaded = false;
        if (cardsContainer) cardsContainer.style.display = 'none';
        if (calendarContainer) calendarContainer.style.display = 'block';
        if (toggleBtn) toggleBtn.textContent = '📄 Ver Tarjetas';
        loadCalendarEvents();
    } else {
        if (calendarContainer) calendarContainer.style.display = 'none';
        if (cardsContainer) cardsContainer.style.display = 'block';
        if (toggleBtn) toggleBtn.textContent = '📆 Ver Calendario';
        loadLicitaciones();
    }
}

function changeCalendarMonth(offset) {
    calendarMonthDate = new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() + offset, 1);
    renderCalendar();
}

function findUpcomingEvent(events) {
    if (!events || events.length === 0) {
        return null;
    }

    const now = new Date();
    const upcoming = events.find(event => {
        const dateTime = new Date(`${event.visitDate}T${event.visitTime || '00:00'}:00`);
        return !Number.isNaN(dateTime.getTime()) && dateTime >= now;
    });

    return upcoming || events[0] || null;
}

async function loadCalendarEvents() {
    const calendarLoading = document.getElementById('calendarLoadingState');
    const calendarEmpty = document.getElementById('calendarEmptyState');
    const calendarDays = document.getElementById('calendarDays');

    if (calendarLoading) {
        calendarLoading.style.display = 'block';
    }
    if (calendarEmpty) {
        calendarEmpty.style.display = 'none';
    }
    if (calendarDays) {
        calendarDays.innerHTML = '';
    }

    try {
        const filters = getCurrentFilters();
        // Force calendar to only show approved licitaciones with site visits
        filters.status = 'approved';
        const query = buildFilterQueryString(filters);
        const response = await fetch(`${API_BASE}/api/visits${query}`);
        const result = await response.json();

        if (result.success) {
            calendarEvents = Array.isArray(result.data) ? result.data : [];

            if (!calendarDataLoaded) {
                const targetEvent = findUpcomingEvent(calendarEvents);
                if (targetEvent) {
                    const targetDate = new Date(`${targetEvent.visitDate}T00:00:00`);
                    if (!Number.isNaN(targetDate.getTime())) {
                        calendarMonthDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
                    } else {
                        calendarMonthDate = new Date();
                    }
                } else {
                    calendarMonthDate = new Date();
                }
                calendarDataLoaded = true;
            }

            renderCalendar();
            renderVisitList(calendarEvents);
            loadStats();
        } else {
            throw new Error(result.error || 'No se pudo cargar el calendario');
        }
    } catch (error) {
        console.error('Error loading calendar events:', error);
        renderVisitList([]);
        if (calendarEmpty) {
            calendarEmpty.style.display = 'block';
            const message = calendarEmpty.querySelector('p');
            if (message) {
                message.textContent = '⚠️ Error al cargar el calendario';
            }
        }
    } finally {
        if (calendarLoading) {
            calendarLoading.style.display = 'none';
        }
    }
}

function renderCalendar() {
    const monthLabel = document.getElementById('calendarMonthLabel');
    const calendarDays = document.getElementById('calendarDays');
    const calendarEmpty = document.getElementById('calendarEmptyState');
    const calendarLoading = document.getElementById('calendarLoadingState');

    if (!monthLabel || !calendarDays) {
        return;
    }

    if (calendarLoading) {
        calendarLoading.style.display = 'none';
    }

    const year = calendarMonthDate.getFullYear();
    const month = calendarMonthDate.getMonth();
    monthLabel.textContent = `${MONTH_NAMES[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    calendarDays.innerHTML = '';

    for (let i = 0; i < startWeekday; i++) {
        const filler = document.createElement('div');
        filler.className = 'calendar-day empty';
        calendarDays.appendChild(filler);
    }

    let hasEventsInMonth = false;

    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const eventsForDay = calendarEvents.filter(event => event.visitDate === dateKey);

        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';

        if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
            dayCell.classList.add('today');
        }

        const dateLabel = document.createElement('div');
        dateLabel.className = 'date-label';
        dateLabel.textContent = day;
        dayCell.appendChild(dateLabel);

        if (eventsForDay.length > 0) {
            hasEventsInMonth = true;
            dayCell.classList.add('has-events');

            const orderedEvents = eventsForDay
                .slice()
                .sort((a, b) => {
                    const aHasTime = Boolean(a.visitTime);
                    const bHasTime = Boolean(b.visitTime);
                    if (aHasTime && !bHasTime) return -1;
                    if (!aHasTime && bHasTime) return 1;
                    const aDate = new Date(`${a.visitDate}T${a.visitTime || '23:59'}:00`);
                    const bDate = new Date(`${b.visitDate}T${b.visitTime || '23:59'}:00`);
                    return aDate - bDate;
                });

            orderedEvents.slice(0, 3).forEach(event => {
                const eventElement = document.createElement('div');
                const status = (event.approvalStatus || '').toLowerCase();
                eventElement.className = `calendar-event ${status ? `status-${status}` : ''}`;

                const timeLabel = document.createElement('div');
                timeLabel.className = 'calendar-event-time';
                const calendarTime = formatTimeLabel(event.visitTime);
                const timeText = calendarTime || 'Sin hora';
                timeLabel.textContent = `Hora de visita: ${timeText}`;
                eventElement.appendChild(timeLabel);

                const titleLabel = document.createElement('div');
                titleLabel.className = 'calendar-event-title';
                titleLabel.textContent = truncate(event.subject || 'Sin título', 60);
                eventElement.appendChild(titleLabel);

                const metaLabel = document.createElement('div');
                metaLabel.className = 'calendar-event-meta';
                const visitLocationLabel = event.visitLocation && event.visitLocation !== 'No disponible'
                    ? event.visitLocation
                    : event.location || '';
                metaLabel.textContent = truncate(visitLocationLabel ? `Lugar: ${visitLocationLabel}` : '', 60);
                eventElement.appendChild(metaLabel);

                eventElement.classList.add('clickable');
                eventElement.title = 'Ver detalles de la licitación';
                eventElement.addEventListener('click', () => openLicitacionDetails(event.id));

                dayCell.appendChild(eventElement);
            });

            if (eventsForDay.length > 3) {
                const moreElement = document.createElement('div');
                moreElement.className = 'calendar-event more';
                moreElement.textContent = `+${eventsForDay.length - 3} más`;
                dayCell.appendChild(moreElement);
            }
        }

        calendarDays.appendChild(dayCell);
    }

    const totalCells = startWeekday + daysInMonth;
    const trailingEmpty = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < trailingEmpty; i++) {
        const filler = document.createElement('div');
        filler.className = 'calendar-day empty';
        calendarDays.appendChild(filler);
    }

    if (calendarEmpty) {
        calendarEmpty.style.display = hasEventsInMonth ? 'none' : 'block';
        if (!hasEventsInMonth) {
            const message = calendarEmpty.querySelector('p');
            if (message) {
                message.textContent = '📅 No hay visitas programadas para este mes';
            }
        }
    }
}

function renderVisitList(events) {
    const container = document.getElementById('visitListContainer');
    const content = document.getElementById('visitListContent');
    const countBadge = document.getElementById('visitListCount');

    if (!container || !content || !countBadge) {
        return;
    }

    if (!Array.isArray(events) || events.length === 0) {
        container.style.display = 'none';
        content.innerHTML = '';
        countBadge.textContent = '0';
        return;
    }

    container.style.display = 'block';
    countBadge.textContent = events.length;

    content.innerHTML = '';
    const fragment = document.createDocumentFragment();

    events.forEach(event => {
        const item = document.createElement('div');
        item.className = 'visit-item';

        const mainSection = document.createElement('div');
        mainSection.className = 'visit-item-main';

        const titleRow = document.createElement('div');
        titleRow.className = 'visit-item-title-row';

        const title = document.createElement('div');
        title.className = 'visit-item-title';
        title.textContent = event.subject || 'Sin título';
        titleRow.appendChild(title);

        const status = (event.approvalStatus || 'pending').toLowerCase();
        const statusBadge = document.createElement('span');
        statusBadge.className = `visit-status ${status}`;
        statusBadge.textContent = badgeText(event.approvalStatus);
        titleRow.appendChild(statusBadge);

        mainSection.appendChild(titleRow);

        const meta = document.createElement('div');
        meta.className = 'visit-item-meta';

        const dateValue = new Date(`${event.visitDate}T00:00:00`);
        const dateLabel = Number.isNaN(dateValue.getTime())
            ? event.visitDate
            : dateValue.toLocaleDateString('es-PR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        const timeLabel = formatTimeLabel(event.visitTime) || 'Sin hora';
        const visitLocation = event.visitLocation && event.visitLocation !== 'No disponible'
            ? event.visitLocation
            : 'Lugar no especificado';
        const town = extractTownFromLocation(event.location) || 'Pueblo no especificado';

        const dateSpan = document.createElement('span');
        dateSpan.innerHTML = `<strong>📅 Fecha:</strong> ${dateLabel}`;
        meta.appendChild(dateSpan);

        const timeSpan = document.createElement('span');
        timeSpan.innerHTML = `<strong>🕒 Hora:</strong> ${timeLabel}`;
        meta.appendChild(timeSpan);

        const townSpan = document.createElement('span');
        townSpan.innerHTML = `<strong>🏙️ Pueblo:</strong> ${town}`;
        meta.appendChild(townSpan);

        const locationSpan = document.createElement('span');
        locationSpan.innerHTML = `<strong>📍 Lugar:</strong> ${visitLocation}`;
        meta.appendChild(locationSpan);

        mainSection.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'visit-item-actions';

    const pdfUrl = event.pdfUrl || resolvePdfUrl(event.pdfLink);
        const pdfLink = document.createElement('a');
        pdfLink.className = 'btn btn-primary';
        pdfLink.textContent = '📄 Abrir PDF';
        pdfLink.target = '_blank';
        pdfLink.rel = 'noopener noreferrer';

        if (!pdfUrl || pdfUrl === '#') {
            pdfLink.classList.add('disabled');
            pdfLink.textContent = '📄 PDF no disponible';
            pdfLink.setAttribute('aria-disabled', 'true');
            pdfLink.href = '#';
        } else {
            pdfLink.href = pdfUrl;
        }

        actions.appendChild(pdfLink);

        const detailButton = document.createElement('button');
        detailButton.type = 'button';
        detailButton.className = 'btn btn-secondary';
        detailButton.textContent = 'Ver detalles';
        detailButton.addEventListener('click', () => openLicitacionDetails(event.id));
        actions.appendChild(detailButton);

        item.appendChild(mainSection);
        item.appendChild(actions);
        fragment.appendChild(item);
    });

    content.appendChild(fragment);
}

function resolvePdfUrl(rawLink) {
    if (!rawLink) {
        return '#';
    }

    const stringValue = String(rawLink).trim();
    if (!stringValue) {
        return '#';
    }

    const hyperlinkMatch = stringValue.match(/(?:HYPERLINK|HIPERVINCULO)\s*\(\s*"([^"]+)"/i);
    if (hyperlinkMatch) {
        return hyperlinkMatch[1];
    }

    const urlMatch = stringValue.match(/https?:\/\/[^\s"')]+/i);
    if (urlMatch) {
        return urlMatch[0];
    }

    const trimmed = stringValue;
    if (trimmed.startsWith('http')) {
        return trimmed;
    }

    return '#';
}

async function openLicitacionDetails(id) {
    const modal = document.getElementById('detailModal');
    const content = document.getElementById('detailContent');
    const loading = document.getElementById('detailLoading');
    const pdfLink = document.getElementById('detailPdfLink');
    const subtitle = document.getElementById('detailSubtitle');
    const titleEl = document.getElementById('detailModalTitle');
    const badge = document.getElementById('detailStatusBadge');

    if (!modal || !content || !loading) {
        return;
    }

    currentDetailId = id;
    modal.style.display = 'flex';
    loading.style.display = 'block';
    content.innerHTML = '';
    subtitle.textContent = '';
    titleEl.textContent = 'Detalle de Licitación';
    badge.textContent = 'Cargando';
    badge.className = 'detail-modal-badge';
    if (pdfLink) {
        pdfLink.href = '#';
        pdfLink.classList.add('disabled');
        pdfLink.setAttribute('aria-disabled', 'true');
        pdfLink.textContent = '📄 PDF no disponible';
    }

    try {
        const licitacion = await fetchLicitacionDetails(id);
        if (!licitacion) {
            throw new Error('Detalle no disponible');
        }

        renderDetailModal(licitacion);
    } catch (error) {
        console.error('Error loading licitación details:', error);
        content.innerHTML = `<div class="detail-section"><p class="detail-item-value">⚠️ No se pudo cargar la información de esta licitación.</p></div>`;
    } finally {
        loading.style.display = 'none';
    }
}

async function fetchLicitacionDetails(id) {
    if (detailCache.has(id)) {
        return detailCache.get(id);
    }

    const response = await fetch(`${API_BASE}/api/licitaciones/${id}`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result.success || !result.data) {
        throw new Error(result.error || 'Respuesta inválida');
    }

    detailCache.set(id, result.data);
    return result.data;
}

function renderDetailModal(lic) {
    const titleEl = document.getElementById('detailModalTitle');
    const subtitle = document.getElementById('detailSubtitle');
    const badge = document.getElementById('detailStatusBadge');
    const pdfLink = document.getElementById('detailPdfLink');
    const content = document.getElementById('detailContent');
    const deleteBtn = document.getElementById('detailDeleteBtn');

    if (!titleEl || !subtitle || !badge || !pdfLink || !content) {
        return;
    }

    const approvalStatus = (lic.approvalStatus || 'pending').toLowerCase();
    badge.textContent = approvalStatus === 'approved' ? 'Aprobada' : approvalStatus === 'rejected' ? 'Rechazada' : 'Pendiente';
    badge.className = `detail-modal-badge status-${approvalStatus}`;

    titleEl.textContent = lic.subject || 'Sin título';
    subtitle.textContent = [lic.location, lic.category].filter(Boolean).join(' · ');

    const pdfUrl = lic.pdfUrl || resolvePdfUrl(lic.pdfLink);
    if (pdfUrl && pdfUrl !== '#') {
        pdfLink.href = pdfUrl;
        pdfLink.classList.remove('disabled');
        pdfLink.removeAttribute('aria-disabled');
        pdfLink.textContent = '📄 Abrir PDF';
    } else {
        pdfLink.href = '#';
        pdfLink.classList.add('disabled');
        pdfLink.setAttribute('aria-disabled', 'true');
        pdfLink.textContent = '📄 PDF no disponible';
    }

    // Show delete button (always visible)
    if (deleteBtn) {
        deleteBtn.style.display = 'inline-flex';
    }

    content.innerHTML = renderDetailSections(lic);
}

function renderDetailSections(lic) {
    const siteVisitDate = formatSiteVisitDate(lic.siteVisitDate);
    const siteVisitTime = formatTimeLabel(lic.siteVisitTime) || 'Sin hora';
    const closeTime = formatTimeLabel(lic.biddingCloseTime) || (lic.biddingCloseTime || 'Sin hora');

    return `
        <div class="detail-section">
            <h3>Información General</h3>
            <div class="detail-grid">
                ${renderDetailItem('Fecha del Email', lic.emailDate ? new Date(lic.emailDate).toLocaleString('es-PR') : '')}
                ${renderDetailItem('Fecha de Procesamiento', lic.processedAt ? new Date(lic.processedAt).toLocaleString('es-PR') : '')}
                ${renderDetailItem('Estado', badgeText(lic.approvalStatus))}
            </div>
        </div>
        <div class="detail-section">
            <h3>Ubicación y Contacto</h3>
            <div class="detail-grid">
                ${renderDetailItem('Ubicación', lic.location)}
                ${renderDetailItem('Categoría', lic.category)}
                ${renderDetailItem('Contacto', lic.contactName)}
                ${renderDetailItem('Teléfono', lic.contactPhone)}
            </div>
        </div>
        <div class="detail-section">
            <h3>Visitas y Cierre</h3>
            <div class="detail-grid">
                ${renderDetailItem('Fecha Visita', siteVisitDate)}
                ${renderDetailItem('Hora Visita', siteVisitTime)}
                ${renderDetailItem('Lugar de Visita', lic.visitLocation)}
                ${renderDetailItem('Cierre Licitación', lic.biddingCloseDate)}
                ${renderDetailItem('Hora Cierre', closeTime)}
            </div>
        </div>
        ${lic.description ? `
        <div class="detail-section">
            <h3>Descripción</h3>
            <div class="detail-item-value">${formatMultiline(lic.description)}</div>
        </div>
        ` : ''}
        ${lic.summary ? `
        <div class="detail-section">
            <h3>Resumen</h3>
            <div class="detail-item-value">${formatMultiline(lic.summary)}</div>
        </div>
        ` : ''}
        <div class="detail-section">
            <h3>Notas y Decisión</h3>
            <div class="detail-grid">
                ${renderDetailItem('Notas', lic.approvalNotes, 'detail-notes')}
                ${renderDetailItem('Estado de Decisión', lic.decisionStatus)}
                ${renderDetailItem('Interesado', lic.interested ? 'Sí' : 'No')}
                ${renderDetailItem('Método de Extracción', lic.extractionMethod)}
            </div>
        </div>
    `;
}

function renderDetailItem(label, value, extraClass = '') {
    // Don't render if value is empty, null, undefined, or "No disponible"
    if (!value || value === 'No disponible' || value === 'Sin notas' || value === 'Sin decisión' || value === 'No clasificado' || value === 'Sin hora') {
        return '';
    }
    
    let formattedValue;
    
    // Handle phone numbers
    if (label === 'Teléfono') {
        const cleanPhone = String(value).replace(/\D/g, ''); // Remove non-digits
        formattedValue = `
            <a href="tel:${cleanPhone}" class="contact-link phone-link">📞 ${escapeHtml(value)}</a>
            <a href="https://wa.me/1${cleanPhone}" target="_blank" class="contact-link whatsapp-link">💬 WhatsApp</a>
        `;
    }
    // Handle emails
    else if (label === 'Email' || label.toLowerCase().includes('correo')) {
        formattedValue = `<a href="mailto:${escapeHtml(value)}" class="contact-link email-link">📧 ${escapeHtml(value)}</a>`;
    }
    // Default handling
    else {
        formattedValue = typeof value === 'string'
            ? escapeHtml(value).replace(/\n/g, '<br>')
            : value;
    }

    return `
        <div class="detail-item">
            <div class="detail-item-label">${escapeHtml(label)}</div>
            <div class="detail-item-value ${extraClass}">${formattedValue}</div>
        </div>
    `;
}

function badgeText(status) {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'approved') return 'Aprobada';
    if (normalized === 'rejected') return 'Rechazada';
    return 'Pendiente';
}

function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.style.display = 'none';
        currentDetailId = null;
    }
}

/**
 * Load dashboard statistics
 */
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const result = await response.json();

        if (result.success) {
            const stats = result.data;
            document.getElementById('statPending').textContent = stats.pending;
            document.getElementById('statApproved').textContent = stats.approved;
            document.getElementById('statRejected').textContent = stats.rejected;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

/**
 * Setup click handlers for stat items to filter by status
 */
function setupStatClickHandlers() {
    const statsBar = document.getElementById('statsBar');
    if (!statsBar) return;

    const statItems = statsBar.querySelectorAll('.stat-item');
    
    statItems.forEach(statItem => {
        // Make stat items look clickable
        statItem.style.cursor = 'pointer';
        statItem.style.userSelect = 'none';
        
        statItem.addEventListener('click', () => {
            const statusFilter = document.getElementById('statusFilter');
            if (!statusFilter) return;

            // Determine which status was clicked
            let selectedStatus = '';
            if (statItem.classList.contains('pending')) {
                selectedStatus = 'pending';
            } else if (statItem.classList.contains('approved')) {
                selectedStatus = 'approved';
            } else if (statItem.classList.contains('rejected')) {
                selectedStatus = 'rejected';
            }
            
            // If clicking the same status, clear the filter (show all)
            if (statusFilter.value === selectedStatus) {
                statusFilter.value = '';
            } else {
                statusFilter.value = selectedStatus;
            }
            
            // Update visual feedback
            updateStatItemsActiveState();
            
            // Trigger filter change
            handleFilterChange();
        });
    });
    
    // Initial active state update
    updateStatItemsActiveState();
}

/**
 * Update visual feedback on stat items based on current filter
 */
function updateStatItemsActiveState() {
    const statusFilter = document.getElementById('statusFilter');
    const statsBar = document.getElementById('statsBar');
    if (!statusFilter || !statsBar) return;
    
    const currentStatus = statusFilter.value;
    const statItems = statsBar.querySelectorAll('.stat-item');
    
    statItems.forEach(statItem => {
        const isActive = 
            (currentStatus === 'pending' && statItem.classList.contains('pending')) ||
            (currentStatus === 'approved' && statItem.classList.contains('approved')) ||
            (currentStatus === 'rejected' && statItem.classList.contains('rejected')) ||
            (currentStatus === ''); // Show all stats when no filter
        
        if (isActive) {
            statItem.style.opacity = '1';
            statItem.style.transform = 'scale(1.05)';
            statItem.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        } else {
            statItem.style.opacity = '0.6';
            statItem.style.transform = 'scale(1)';
            statItem.style.boxShadow = 'none';
        }
    });
}

/**
 * Sort licitaciones based on selected criteria
 */
function sortLicitaciones(licitaciones, sortBy) {
    const sorted = [...licitaciones];
    
    switch (sortBy) {
        case 'visit-date-asc': {
            // Sort by visit date (earliest first), put items without dates at end
            return sorted.sort((a, b) => {
                const dateA = a.siteVisitDate && a.siteVisitDate !== 'No disponible' ? new Date(a.siteVisitDate) : new Date('9999-12-31');
                const dateB = b.siteVisitDate && b.siteVisitDate !== 'No disponible' ? new Date(b.siteVisitDate) : new Date('9999-12-31');
                return dateA - dateB;
            });
        }
        
        case 'close-date-asc': {
            // Sort by close date (earliest first), put items without dates at end
            return sorted.sort((a, b) => {
                const dateA = a.biddingCloseDate && a.biddingCloseDate !== 'No disponible' ? new Date(a.biddingCloseDate) : new Date('9999-12-31');
                const dateB = b.biddingCloseDate && b.biddingCloseDate !== 'No disponible' ? new Date(b.biddingCloseDate) : new Date('9999-12-31');
                return dateA - dateB;
            });
        }
        
        case 'email-date-desc': {
            // Sort by email date (newest first)
            return sorted.sort((a, b) => {
                const dateA = a.emailDate ? new Date(a.emailDate) : new Date(0);
                const dateB = b.emailDate ? new Date(b.emailDate) : new Date(0);
                return dateB - dateA;
            });
        }
        
        case 'email-date-asc': {
            // Sort by email date (oldest first)
            return sorted.sort((a, b) => {
                const dateA = a.emailDate ? new Date(a.emailDate) : new Date(0);
                const dateB = b.emailDate ? new Date(b.emailDate) : new Date(0);
                return dateA - dateB;
            });
        }
        
        case 'title-asc': {
            // Sort alphabetically A-Z
            return sorted.sort((a, b) => {
                const titleA = (a.subject || '').toLowerCase();
                const titleB = (b.subject || '').toLowerCase();
                return titleA.localeCompare(titleB, 'es');
            });
        }
        
        case 'title-desc': {
            // Sort alphabetically Z-A
            return sorted.sort((a, b) => {
                const titleA = (a.subject || '').toLowerCase();
                const titleB = (b.subject || '').toLowerCase();
                return titleB.localeCompare(titleA, 'es');
            });
        }
        
        default:
            return sorted;
    }
}

/**
 * Load licitaciones with current filters
 */
async function loadLicitaciones() {
    if (isCalendarView) {
        return loadCalendarEvents();
    }

    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const cardsGrid = document.getElementById('cardsGrid');

    // Clear selection when loading new data
    clearSelection();

    // Show loading
    loadingState.style.display = 'block';
    emptyState.style.display = 'none';
    cardsGrid.innerHTML = '';

    try {
        const filters = getCurrentFilters();
        const query = buildFilterQueryString(filters);
        const response = await fetch(`${API_BASE}/api/licitaciones${query}`);
        const result = await response.json();

        loadingState.style.display = 'none';

        if (result.success) {
            let licitaciones = Array.isArray(result.data) ? result.data : [];

            // Apply client-side search filtering
            if (filters.search && filters.search.trim()) {
                const searchTerm = filters.search.toLowerCase().trim();
                licitaciones = licitaciones.filter(lic => {
                    const searchableText = [
                        lic.subject || '',
                        lic.location || '',
                        lic.description || '',
                        lic.pdfFilename || '',
                        lic.contactName || '',
                        lic.visitLocation || '',
                        lic.category || ''
                    ].join(' ').toLowerCase();
                    
                    return searchableText.includes(searchTerm);
                });
            }

            // Apply sorting
            const sortBy = document.getElementById('sortSelect')?.value;
            if (sortBy) {
                licitaciones = sortLicitaciones(licitaciones, sortBy);
            }

            // Store for export
            currentLicitaciones = licitaciones;

            // Generate smart suggestions
            generateSmartSuggestions(licitaciones);
            
            // Check for upcoming events and show notifications
            checkUpcomingEvents(licitaciones);

            if (licitaciones.length > 0) {
                renderCards(licitaciones);
            } else {
                emptyState.style.display = 'block';
                const emptyMsg = emptyState.querySelector('p');
                if (emptyMsg) {
                    emptyMsg.textContent = filters.search 
                        ? `📋 No se encontraron resultados para "${filters.search}"`
                        : '📋 No hay licitaciones que coincidan con los filtros';
                }
            }

            loadStats(); // Refresh stats
        } else {
            emptyState.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading licitaciones:', error);
        loadingState.style.display = 'none';
        emptyState.style.display = 'block';
    }
}

/**
 * Render licitaciones based on current view mode
 */
function renderCards(licitaciones) {
    const cardsGrid = document.getElementById('cardsGrid');
    cardsGrid.innerHTML = '';
    
    // Update grid class based on view mode
    cardsGrid.className = `view-mode-${currentViewMode}`;

    if (currentViewMode === 'cards') {
        licitaciones.forEach(lic => {
            const card = createCard(lic);
            cardsGrid.appendChild(card);
        });
    } else if (currentViewMode === 'list') {
        licitaciones.forEach(lic => {
            const listItem = createListItem(lic);
            cardsGrid.appendChild(listItem);
        });
    } else if (currentViewMode === 'table') {
        const table = createTableView(licitaciones);
        cardsGrid.appendChild(table);
    }
}

/**
 * Create a card element for a licitación
 */
function createCard(lic) {
    const card = document.createElement('div');
    const approvalStatus = (lic.approvalStatus || 'pending').toLowerCase();
    
    // Determine if it's a visit or purchase based on visitLocation
    const visitLocation = (lic.visitLocation || '').toString().trim();
    const isVisit = visitLocation && visitLocation.toLowerCase() !== 'no disponible';
    const typeText = isVisit ? '🏗️ Visita' : '🛒 Compra';
    const typeBadgeClass = isVisit ? 'visit-type-badge' : 'purchase-type-badge';
    
    card.className = `card status-${approvalStatus} ${isVisit ? 'has-visit' : ''}`;
    card.dataset.rowNumber = lic.rowNumber;

    // Format dates
    const emailDate = lic.emailDate ? new Date(lic.emailDate).toLocaleDateString('es-PR') : 'N/A';

    // PDF link - handle both formula and URL formats
    const pdfLink = lic.pdfUrl || resolvePdfUrl(lic.pdfLink);
    const siteVisitDateDisplay = formatSiteVisitDate(lic.siteVisitDate);
    const siteVisitTimeDisplay = formatTimeLabel(lic.siteVisitTime);
    const siteVisitTimeLine = siteVisitTimeDisplay || (siteVisitDateDisplay !== 'No disponible' ? 'Sin hora' : '');

    const isFav = isFavorite(lic.rowNumber);
    
    card.innerHTML = `
        <input type="checkbox" class="card-checkbox" data-row="${lic.rowNumber}" onclick="toggleCardSelection(event, ${lic.rowNumber})">
        <div class="card-header">
            <div class="card-title">${escapeHtml(lic.subject || 'Sin título')}</div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button class="favorite-btn ${isFav ? 'favorited' : ''}" onclick="toggleFavorite(${lic.rowNumber}, event)" title="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
                    ${isFav ? '⭐' : '☆'}
                </button>
                <span class="type-badge ${typeBadgeClass}">${typeText}</span>
            </div>
        </div>

        <div class="card-meta">
            ${isVisit && siteVisitDateDisplay !== 'No disponible' ? `
                <div class="meta-item visit-date-highlight">🗓️ Visita: ${siteVisitDateDisplay}</div>
                ${siteVisitTimeLine ? `<div class="meta-item">🕐 ${siteVisitTimeLine}</div>` : ''}
            ` : `
                <div class="meta-item">📅 ${emailDate}</div>
            `}
            ${lic.category ? `<div class="meta-item">📂 ${escapeHtml(lic.category)}</div>` : ''}
        </div>

        ${lic.location ? `
        <div class="card-section">
            <div class="section-label">Ubicación</div>
            <div class="section-content">${escapeHtml(lic.location)}</div>
        </div>
        ` : ''}

        ${lic.description ? `
        <div class="card-section">
            <div class="section-label">Descripción</div>
            <div class="section-content">${escapeHtml(truncate(lic.description, 150))}</div>
        </div>
        ` : ''}

        ${lic.summary ? `
        <div class="card-section">
            <div class="section-label">Resumen</div>
            <div class="section-content">${escapeHtml(truncate(lic.summary, 120))}</div>
        </div>
        ` : ''}

        <div class="info-grid">
            ${lic.biddingCloseDate && lic.biddingCloseDate !== 'No disponible' ? `
            <div class="info-item">
                <div class="section-label">Cierre de Licitación</div>
                <div class="section-content">
                    ${escapeHtml(lic.biddingCloseDate)}
                    ${lic.biddingCloseTime ? `<br>${escapeHtml(lic.biddingCloseTime)}` : ''}
                </div>
            </div>
            ` : ''}

            ${siteVisitDateDisplay !== 'No disponible' ? `
            <div class="info-item">
                <div class="section-label">Visita al Sitio</div>
                <div class="section-content">
                    ${escapeHtml(siteVisitDateDisplay)}
                    ${siteVisitTimeLine ? `<br>${escapeHtml(siteVisitTimeLine)}` : ''}
                </div>
            </div>
            ` : ''}

            ${lic.contactName ? `
            <div class="info-item">
                <div class="section-label">Contacto</div>
                <div class="section-content">
                    ${escapeHtml(lic.contactName)}
                    ${lic.contactPhone ? `
                        <br>
                        <a href="tel:${lic.contactPhone.replace(/\\D/g, '')}" class="contact-link phone-link" onclick="event.stopPropagation()">
                            📞 ${escapeHtml(lic.contactPhone)}
                        </a>
                        <a href="https://wa.me/1${lic.contactPhone.replace(/\\D/g, '')}" target="_blank" class="contact-link whatsapp-link" onclick="event.stopPropagation()">
                            💬
                        </a>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            ${pdfLink ? `
            <div class="info-item">
                <div class="section-label">Archivo PDF</div>
                <div class="section-content">
                    <a href="${pdfLink}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 600;">
                        📄 ${escapeHtml(lic.pdfFilename || 'Ver PDF')}
                    </a>
                </div>
            </div>
            ` : ''}
        </div>

        ${lic.approvalNotes ? `
        <div class="card-section">
            <div class="section-label">Notas</div>
            <div class="section-content">${escapeHtml(lic.approvalNotes)}</div>
        </div>
        ` : ''}

        <div class="card-actions">
            ${lic.contactEmail ? `
                <button class="btn btn-primary" onclick="showEmailTemplateSelector(${lic.rowNumber})">
                    📧 Enviar Email
                </button>
            ` : ''}
            ${approvalStatus === 'pending' ? `
                <button class="btn btn-success" onclick="approveWithNotes(${lic.id})">
                    ✓ Aprobar
                </button>
                <button class="btn btn-danger" onclick="rejectWithNotes(${lic.id})">
                    ✗ Rechazar
                </button>
            ` : `
                <button class="btn btn-warning" onclick="resetToPending(${lic.id})">
                    ↺ Volver a Pendiente
                </button>
            `}
        </div>
    `;

    return card;
}

/**
 * Create a compact list item for a licitación
 */
function createListItem(lic) {
    const listItem = document.createElement('div');
    listItem.className = `list-item status-${(lic.approvalStatus || 'pending').toLowerCase()}`;
    if (isFavorite(lic.rowNumber)) listItem.classList.add('favorited');
    
    const visitLocation = (lic.visitLocation || '').toString().trim();
    const isVisit = visitLocation && visitLocation.toLowerCase() !== 'no disponible';
    const typeIcon = isVisit ? '🏗️' : '🛒';
    
    const siteVisitDateDisplay = formatSiteVisitDate(lic.siteVisitDate);
    const emailDate = formatSiteVisitDate(lic.emailDate) || 'Sin fecha';
    
    listItem.innerHTML = `
        <input type="checkbox" class="item-checkbox" data-row="${lic.rowNumber}" onclick="toggleCardSelection(event, ${lic.rowNumber})">
        <button class="favorite-btn-small ${isFavorite(lic.rowNumber) ? 'favorited' : ''}" onclick="toggleFavorite(${lic.rowNumber}, event)">
            ${isFavorite(lic.rowNumber) ? '⭐' : '☆'}
        </button>
        <div class="list-item-content" onclick="openDetailModal(${lic.rowNumber})">
            <div class="list-item-main">
                <span class="list-item-icon">${typeIcon}</span>
                <span class="list-item-title">${escapeHtml(lic.subject || 'Sin título')}</span>
            </div>
            <div class="list-item-meta">
                ${isVisit && siteVisitDateDisplay !== 'No disponible' ? 
                    `<span>📅 ${siteVisitDateDisplay}</span>` : 
                    `<span>📅 ${emailDate}</span>`
                }
                ${lic.category ? `<span>📂 ${escapeHtml(lic.category)}</span>` : ''}
                ${lic.contactName ? `<span>👤 ${escapeHtml(lic.contactName)}</span>` : ''}
            </div>
        </div>
    `;
    
    return listItem;
}

/**
 * Create a table view for all licitaciones
 */
function createTableView(licitaciones) {
    const table = document.createElement('table');
    table.className = 'licitaciones-table';
    
    table.innerHTML = `
        <thead>
            <tr>
                <th><input type="checkbox" onclick="toggleSelectAll(event)"></th>
                <th></th>
                <th>Título</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Fecha Visita/Email</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
            ${licitaciones.map(lic => {
                const visitLocation = (lic.visitLocation || '').toString().trim();
                const isVisit = visitLocation && visitLocation.toLowerCase() !== 'no disponible';
                const typeIcon = isVisit ? '🏗️' : '🛒';
                const typeText = isVisit ? 'Visita' : 'Compra';
                
                const siteVisitDateDisplay = formatSiteVisitDate(lic.siteVisitDate);
                const emailDate = formatSiteVisitDate(lic.emailDate) || 'Sin fecha';
                const displayDate = isVisit && siteVisitDateDisplay !== 'No disponible' ? siteVisitDateDisplay : emailDate;
                
                const statusBadge = badgeText(lic.approvalStatus || 'pending');
                
                return `
                    <tr class="table-row status-${(lic.approvalStatus || 'pending').toLowerCase()}" onclick="openDetailModal(${lic.rowNumber})">
                        <td onclick="event.stopPropagation()">
                            <input type="checkbox" class="item-checkbox" data-row="${lic.rowNumber}" onclick="toggleCardSelection(event, ${lic.rowNumber})">
                        </td>
                        <td onclick="event.stopPropagation()">
                            <button class="favorite-btn-small ${isFavorite(lic.rowNumber) ? 'favorited' : ''}" onclick="toggleFavorite(${lic.rowNumber}, event)">
                                ${isFavorite(lic.rowNumber) ? '⭐' : '☆'}
                            </button>
                        </td>
                        <td class="table-title">${escapeHtml(lic.subject || 'Sin título')}</td>
                        <td>${typeIcon} ${typeText}</td>
                        <td>${escapeHtml(lic.category || '-')}</td>
                        <td>${displayDate}</td>
                        <td>${escapeHtml(lic.contactName || '-')}</td>
                        <td>${statusBadge}</td>
                        <td onclick="event.stopPropagation()">
                            <button class="btn-icon" onclick="approveWithNotes(${lic.rowNumber})" title="Aprobar">✓</button>
                            <button class="btn-icon" onclick="rejectWithNotes(${lic.rowNumber})" title="Rechazar">✗</button>
                        </td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    `;
    
    return table;
}

/**
 * Toggle select all checkboxes in table view
 */
function toggleSelectAll(event) {
    event.stopPropagation();
    const isChecked = event.target.checked;
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.checked = isChecked;
        const rowNumber = parseInt(checkbox.dataset.row);
        if (isChecked) {
            selectedCards.add(rowNumber);
        } else {
            selectedCards.delete(rowNumber);
        }
    });
    updateBulkActionsBar();
}

/**
 * Approve a licitación (with modal for notes)
 */
function approveWithNotes(id) {
    currentLicitacionId = id;
    currentModalAction = 'approve';
    document.getElementById('approvalNotes').value = '';
    document.getElementById('modalActionBtn').textContent = '✓ Aprobar';
    document.getElementById('modalActionBtn').className = 'btn btn-success';
    document.getElementById('notesModal').style.display = 'flex';
}

/**
 * Reject a licitación (with modal for notes)
 */
function rejectWithNotes(id) {
    currentLicitacionId = id;
    currentModalAction = 'reject';
    document.getElementById('approvalNotes').value = '';
    document.getElementById('modalActionBtn').textContent = '✗ Rechazar';
    document.getElementById('modalActionBtn').className = 'btn btn-danger';
    document.getElementById('notesModal').style.display = 'flex';
}

/**
 * Reset to pending
 */
async function resetToPending(id) {
    if (!confirm('¿Volver esta licitación a estado pendiente?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/licitaciones/${id}/pending`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: '' })
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Licitación marcada como pendiente', 'success');
            loadLicitaciones();
        } else {
            showNotification('Error al actualizar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al actualizar', 'error');
    }
}

/**
 * Submit modal action (approve or reject with notes)
 */
async function submitModalAction() {
    const notes = document.getElementById('approvalNotes').value.trim();

    if (!currentLicitacionId || !currentModalAction) return;

    try {
        const response = await fetch(`${API_BASE}/api/licitaciones/${currentLicitacionId}/${currentModalAction}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes })
        });

        const result = await response.json();

        if (result.success) {
            const actionText = currentModalAction === 'approve' ? 'aprobada' : 'rechazada';
            showNotification(`Licitación ${actionText} exitosamente`, 'success');
            closeModal();
            loadLicitaciones();
        } else {
            showNotification('Error al actualizar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al actualizar', 'error');
    }
}

/**
 * Handle delete licitación
 */
async function handleDeleteLicitacion() {
    if (!currentDetailId) return;

    const confirmed = confirm('¿Está seguro de que desea eliminar esta licitación? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    try {
        const response = await fetch(`${API_BASE}/api/licitaciones/${currentDetailId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Licitación eliminada exitosamente', 'success');
            closeDetailModal();
            
            // Refresh the data
            if (isCalendarView) {
                calendarDataLoaded = false;
                loadCalendarEvents();
            } else {
                loadLicitaciones();
            }
        } else {
            showNotification('Error al eliminar la licitación', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error al eliminar la licitación', 'error');
    }
}

/**
 * Close modal
 */
function closeModal() {
    document.getElementById('notesModal').style.display = 'none';
    currentModalAction = null;
    currentLicitacionId = null;
}

/**
 * Quick filter: Show visits this week
 */
function quickFilterVisitsThisWeek() {
    document.getElementById('typeFilter').value = 'visits';
    document.getElementById('dateRangeFilter').value = 'visits-this-week';
    document.getElementById('statusFilter').value = 'pending';
    document.getElementById('sortSelect').value = 'visit-date-asc';
    handleFilterChange();
}

/**
 * Quick filter: Show licitaciones closing soon (next 7 days)
 */
function quickFilterClosingSoon() {
    document.getElementById('statusFilter').value = 'pending';
    document.getElementById('dateRangeFilter').value = 'next-week';
    document.getElementById('sortSelect').value = 'close-date-asc';
    handleFilterChange();
}

/**
 * Quick filter: Show pending visits (all upcoming visits that are pending)
 */
function quickFilterPendingVisits() {
    document.getElementById('typeFilter').value = 'visits';
    document.getElementById('statusFilter').value = 'pending';
    document.getElementById('sortSelect').value = 'visit-date-asc';
    handleFilterChange();
}

/**
 * Clear all filters
 */
function clearFilters() {
    document.getElementById('statusFilter').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('typeFilter').value = '';
    document.getElementById('dateRangeFilter').value = '';
    document.getElementById('searchInput').value = '';
    document.getElementById('sortSelect').value = '';
    
    handleFilterChange();
}

/**
 * Toggle card selection
 */
function toggleCardSelection(event, rowNumber) {
    event.stopPropagation();
    const checkbox = event.target;
    const card = checkbox.closest('.card');
    
    if (checkbox.checked) {
        selectedCards.add(rowNumber);
        card.classList.add('selected');
    } else {
        selectedCards.delete(rowNumber);
        card.classList.remove('selected');
    }
    
    updateBulkActionsBar();
}

/**
 * Update bulk actions bar visibility and count
 */
function updateBulkActionsBar() {
    const bulkBar = document.getElementById('bulkActionsBar');
    const countSpan = document.getElementById('bulkSelectedCount');
    
    if (selectedCards.size > 0) {
        bulkBar.style.display = 'flex';
        countSpan.textContent = selectedCards.size;
    } else {
        bulkBar.style.display = 'none';
    }
}

/**
 * Clear all selections
 */
function clearSelection() {
    selectedCards.clear();
    document.querySelectorAll('.card-checkbox').forEach(cb => {
        cb.checked = false;
    });
    document.querySelectorAll('.card.selected').forEach(card => {
        card.classList.remove('selected');
    });
    updateBulkActionsBar();
}

/**
 * Bulk approve selected licitaciones
 */
async function bulkApprove() {
    if (selectedCards.size === 0) return;
    
    if (!confirm(`¿Aprobar ${selectedCards.size} licitación(es)?`)) return;
    
    const promises = Array.from(selectedCards).map(rowNumber => 
        fetch(`${API_BASE}/api/licitaciones/${rowNumber}/approve`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: '[Aprobado en lote]' })
        })
    );
    
    try {
        await Promise.all(promises);
        showNotification(`✓ ${selectedCards.size} licitación(es) aprobada(s)`, 'success');
        clearSelection();
        loadLicitaciones();
        loadStats();
    } catch (error) {
        console.error('Error bulk approving:', error);
        showNotification('Error al aprobar licitaciones', 'error');
    }
}

/**
 * Bulk reject selected licitaciones
 */
async function bulkReject() {
    if (selectedCards.size === 0) return;
    
    if (!confirm(`¿Rechazar ${selectedCards.size} licitación(es)?`)) return;
    
    const promises = Array.from(selectedCards).map(rowNumber => 
        fetch(`${API_BASE}/api/licitaciones/${rowNumber}/reject`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: '[Rechazado en lote]' })
        })
    );
    
    try {
        await Promise.all(promises);
        showNotification(`✓ ${selectedCards.size} licitación(es) rechazada(s)`, 'success');
        clearSelection();
        loadLicitaciones();
        loadStats();
    } catch (error) {
        console.error('Error bulk rejecting:', error);
        showNotification('Error al rechazar licitaciones', 'error');
    }
}

/**
 * Convert array of objects to CSV
 */
function arrayToCSV(data) {
    if (!data || data.length === 0) return '';
    
    // Define columns to export
    const columns = [
        { key: 'subject', label: 'Título' },
        { key: 'category', label: 'Categoría' },
        { key: 'approvalStatus', label: 'Estado' },
        { key: 'location', label: 'Ubicación' },
        { key: 'description', label: 'Descripción' },
        { key: 'biddingCloseDate', label: 'Fecha Cierre' },
        { key: 'biddingCloseTime', label: 'Hora Cierre' },
        { key: 'siteVisitDate', label: 'Fecha Visita' },
        { key: 'siteVisitTime', label: 'Hora Visita' },
        { key: 'visitLocation', label: 'Lugar Visita' },
        { key: 'contactName', label: 'Contacto' },
        { key: 'contactPhone', label: 'Teléfono' },
        { key: 'contactEmail', label: 'Email' },
        { key: 'emailDate', label: 'Fecha Email' },
        { key: 'pdfFilename', label: 'Archivo PDF' }
    ];
    
    // Create header row
    const headerRow = columns.map(col => `"${col.label}"`).join(',');
    
    // Create data rows
    const dataRows = data.map(item => {
        return columns.map(col => {
            let value = item[col.key] || '';
            // Clean value and escape quotes
            value = String(value).replace(/"/g, '""');
            return `"${value}"`;
        }).join(',');
    });
    
    return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file
 */
function downloadCSV(csvContent, filename) {
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Export all filtered licitaciones to CSV
 */
function exportAllFiltered() {
    if (!currentLicitaciones || currentLicitaciones.length === 0) {
        alert('No hay licitaciones para exportar');
        return;
    }
    
    const csv = arrayToCSV(currentLicitaciones);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `licitaciones_${timestamp}.csv`;
    
    downloadCSV(csv, filename);
    showNotification(`✓ ${currentLicitaciones.length} licitación(es) exportadas`, 'success');
}

/**
 * Export selected licitaciones to CSV
 */
function exportSelected() {
    if (selectedCards.size === 0) {
        alert('No hay licitaciones seleccionadas para exportar');
        return;
    }
    
    // Filter current licitaciones by selected row numbers
    const selectedLicitaciones = currentLicitaciones.filter(lic => 
        selectedCards.has(lic.rowNumber)
    );
    
    const csv = arrayToCSV(selectedLicitaciones);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `licitaciones_seleccionadas_${timestamp}.csv`;
    
    downloadCSV(csv, filename);
    showNotification(`✓ ${selectedLicitaciones.length} licitación(es) exportadas`, 'success');
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore shortcuts when typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            // Allow Escape to blur input fields
            if (e.key === 'Escape') {
                e.target.blur();
            }
            return;
        }
        
        // Ignore if modal is open
        const detailModal = document.getElementById('detailModal');
        const notesModal = document.getElementById('notesModal');
        if ((detailModal && detailModal.style.display !== 'none') || 
            (notesModal && notesModal.style.display !== 'none')) {
            // Allow Escape to close modals
            if (e.key === 'Escape') {
                closeDetailModal();
                closeNotesModal();
            }
            return;
        }
        
        // Keyboard shortcuts
        switch(e.key.toLowerCase()) {
            case '/':
                // Focus search
                e.preventDefault();
                document.getElementById('searchInput')?.focus();
                break;
                
            case 'r':
                // Refresh
                e.preventDefault();
                loadLicitaciones();
                break;
                
            case 'c':
                // Clear filters
                e.preventDefault();
                clearFilters();
                break;
                
            case 'e':
                // Export
                e.preventDefault();
                exportAllFiltered();
                break;
                
            case 's':
                // Toggle calendar
                e.preventDefault();
                toggleCalendarView();
                break;
                
            case '1':
                // Quick filter: Visits this week
                e.preventDefault();
                quickFilterVisitsThisWeek();
                break;
                
            case '2':
                // Quick filter: Closing soon
                e.preventDefault();
                quickFilterClosingSoon();
                break;
                
            case '3':
                // Quick filter: Pending visits
                e.preventDefault();
                quickFilterPendingVisits();
                break;
                
            case '?':
                // Show keyboard shortcuts help
                e.preventDefault();
                showKeyboardShortcutsHelp();
                break;
        }
    });
}

/**
 * Generate smart suggestions based on current licitaciones
 */
function generateSmartSuggestions(licitaciones) {
    const suggestionsContainer = document.getElementById('smartSuggestions');
    if (!licitaciones || licitaciones.length === 0) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    const suggestions = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Count pending licitaciones
    const pending = licitaciones.filter(lic => lic.approvalStatus === 'pending');
    
    // Count pending visits
    const pendingVisits = pending.filter(lic => {
        const visitLocation = (lic.visitLocation || '').toString().trim();
        return visitLocation && visitLocation.toLowerCase() !== 'no disponible';
    });
    
    // Count licitaciones closing this week
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const closingSoon = pending.filter(lic => {
        if (!lic.biddingCloseDate || lic.biddingCloseDate === 'No disponible') return false;
        try {
            const closeDate = new Date(lic.biddingCloseDate);
            return closeDate >= today && closeDate <= nextWeek;
        } catch {
            return false;
        }
    });
    
    // Count visits this week
    const visitsThisWeek = pendingVisits.filter(lic => {
        if (!lic.siteVisitDate || lic.siteVisitDate === 'No disponible') return false;
        try {
            const visitDate = new Date(lic.siteVisitDate);
            return visitDate >= today && visitDate <= nextWeek;
        } catch {
            return false;
        }
    });
    
    // Count visits tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);
    const visitsTomorrow = pendingVisits.filter(lic => {
        if (!lic.siteVisitDate || lic.siteVisitDate === 'No disponible') return false;
        try {
            const visitDate = new Date(lic.siteVisitDate);
            return visitDate >= tomorrow && visitDate <= tomorrowEnd;
        } catch {
            return false;
        }
    });
    
    // Generate suggestion items
    if (visitsTomorrow.length > 0) {
        suggestions.push({
            icon: '🚨',
            text: `Tienes ${visitsTomorrow.length} visita(s) mañana`,
            action: 'Click para ver',
            onClick: () => {
                document.getElementById('typeFilter').value = 'visits';
                document.getElementById('dateRangeFilter').value = 'visits-this-week';
                document.getElementById('statusFilter').value = 'pending';
                handleFilterChange();
            }
        });
    }
    
    if (visitsThisWeek.length > 0 && !visitsTomorrow.length) {
        suggestions.push({
            icon: '🏗️',
            text: `${visitsThisWeek.length} visita(s) esta semana`,
            action: 'Click para ver',
            onClick: () => quickFilterVisitsThisWeek()
        });
    }
    
    if (closingSoon.length > 0) {
        suggestions.push({
            icon: '⏰',
            text: `${closingSoon.length} licitación(es) cierran en 7 días`,
            action: 'Click para ver',
            onClick: () => quickFilterClosingSoon()
        });
    }
    
    if (pendingVisits.length > 5) {
        suggestions.push({
            icon: '📍',
            text: `${pendingVisits.length} visitas pendientes de aprobar`,
            action: 'Click para ver',
            onClick: () => quickFilterPendingVisits()
        });
    }
    
    // Display suggestions
    if (suggestions.length > 0) {
        suggestionsContainer.innerHTML = suggestions.map(s => `
            <div class="suggestion-item" onclick="(${s.onClick.toString()})()">
                <span class="suggestion-icon">${s.icon}</span>
                <span class="suggestion-text">${s.text}</span>
                <span class="suggestion-action">${s.action} →</span>
            </div>
        `).join('');
        suggestionsContainer.style.display = 'block';
    } else {
        suggestionsContainer.style.display = 'none';
    }
}

/**
 * Show keyboard shortcuts help
 */
function showKeyboardShortcutsHelp() {
    const helpText = `
╔══════════════════════════════════════╗
║   ATAJOS DE TECLADO                  ║
╠══════════════════════════════════════╣
║  /   → Buscar                        ║
║  R   → Refrescar                     ║
║  C   → Limpiar filtros               ║
║  E   → Exportar a CSV                ║
║  S   → Calendario/Tarjetas           ║
║  1   → Visitas esta semana           ║
║  2   → Cierre pronto (7 días)        ║
║  3   → Visitas pendientes            ║
║  ?   → Mostrar esta ayuda            ║
║  ESC → Cerrar modales/Desenfocar     ║
╚══════════════════════════════════════╝
    `.trim();
    
    alert(helpText);
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    // Simple alert for now - can be enhanced with a toast library
    alert(message);
}

function parseSheetDateValue(value) {
    if (value === undefined || value === null) {
        return null;
    }

    const trimmed = String(value).trim();
    if (!trimmed || trimmed.toLowerCase() === 'no disponible') {
        return null;
    }

    const numericValue = Number(trimmed);
    if (!Number.isNaN(numericValue) && numericValue > 59) {
        const milliseconds = Math.round((numericValue - 25569) * 86400 * 1000);
        const dateFromSerial = new Date(milliseconds);
        if (!Number.isNaN(dateFromSerial.getTime())) {
            return dateFromSerial;
        }
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed;
    }

    return null;
}

function formatSiteVisitDate(value) {
    const date = parseSheetDateValue(value);
    if (!date) {
        return 'No disponible';
    }

    return date.toLocaleDateString('es-PR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function normalizeTimeValue(value) {
    if (value === undefined || value === null) {
        return null;
    }

    const trimmed = String(value).trim();
    if (!trimmed || trimmed.toLowerCase() === 'no disponible') {
        return null;
    }

    const numericValue = Number(trimmed);
    if (!Number.isNaN(numericValue) && numericValue >= 0 && numericValue < 24) {
        const totalMinutes = numericValue < 1
            ? Math.round(numericValue * 24 * 60)
            : Math.round(numericValue * 60);
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    const sanitized = trimmed
        .replace(/a\.?\s*m\.?/gi, 'AM')
        .replace(/p\.?\s*m\.?/gi, 'PM')
        .replace(/[()]/g, ' ')
        .replace(/[,.;]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const firstTokenMatch = sanitized.match(/(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)/i);
    const target = firstTokenMatch ? firstTokenMatch[1] : sanitized;

    const amPmMatch = target.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)$/i);
    if (amPmMatch) {
        let hours = parseInt(amPmMatch[1], 10);
        const minutes = amPmMatch[2];
        const period = amPmMatch[3].toUpperCase();
        if (period === 'PM' && hours < 12) {
            hours += 12;
        }
        if (period === 'AM' && hours === 12) {
            hours = 0;
        }
        return `${String(hours).padStart(2, '0')}:${minutes}`;
    }

    const hourPeriodMatch = target.match(/^(\d{1,2})\s*(AM|PM)$/i);
    if (hourPeriodMatch) {
        let hours = Number(hourPeriodMatch[1]);
        const period = hourPeriodMatch[2].toUpperCase();
        if (period === 'PM' && hours < 12) {
            hours += 12;
        }
        if (period === 'AM' && hours === 12) {
            hours = 0;
        }
        return `${String(hours % 24).padStart(2, '0')}:00`;
    }

    const standardMatch = target.match(/^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/);
    if (standardMatch) {
        const hours = Number(standardMatch[1]);
        const minutes = Number(standardMatch[2]);

        if (Number.isNaN(hours) || Number.isNaN(minutes)) {
            return null;
        }

        return `${String(hours % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    return null;
}

function formatTimeLabel(value) {
    if (value === undefined || value === null) {
        return null;
    }

    const trimmed = String(value).trim();
    if (!trimmed || trimmed.toLowerCase() === 'no disponible') {
        return null;
    }

    const normalized = normalizeTimeValue(trimmed);
    if (!normalized) {
        return trimmed || null;
    }

    const [hoursStr, minutesStr] = normalized.split(':');
    const hours = Number(hoursStr);
    if (Number.isNaN(hours)) {
        return normalized;
    }

    const minutes = minutesStr ?? '00';
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    return `${displayHours}:${minutes} ${suffix} (${normalized})`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatMultiline(text) {
    return escapeHtml(text || '').replace(/\n/g, '<br>');
}

/**
 * Truncate text
 */
function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const notesModal = document.getElementById('notesModal');
    if (e.target === notesModal) {
        closeModal();
    }

    const detailModal = document.getElementById('detailModal');
    const detailDialog = document.querySelector('.detail-modal-content');
    if (detailModal && detailDialog && e.target === detailModal) {
        closeDetailModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeDetailModal();
    }
});

/**
 * Toggle favorite status for a licitación
 */
function toggleFavorite(licId, event) {
    if (event) {
        event.stopPropagation(); // Prevent card click
    }
    
    const idStr = String(licId);
    if (favorites.has(idStr)) {
        favorites.delete(idStr);
    } else {
        favorites.add(idStr);
    }
    
    // Save to localStorage
    localStorage.setItem('licitacion_favorites', JSON.stringify([...favorites]));
    
    // Update star icon
    const starBtn = event?.target?.closest('.favorite-btn');
    if (starBtn) {
        updateFavoriteIcon(starBtn, favorites.has(idStr));
    }
}

/**
 * Update favorite icon appearance
 */
function updateFavoriteIcon(btn, isFavorite) {
    btn.innerHTML = isFavorite ? '⭐' : '☆';
    btn.title = isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos';
    btn.classList.toggle('favorited', isFavorite);
}

/**
 * Check if a licitación is favorited
 */
function isFavorite(licId) {
    return favorites.has(String(licId));
}

/**
 * Quick filter: Show only favorites
 */
function showOnlyFavorites() {
    if (favorites.size === 0) {
        alert('No tienes licitaciones en favoritos');
        return;
    }
    
    // Filter current licitaciones
    const favoriteLics = currentLicitaciones.filter(lic => isFavorite(lic.id || lic.rowNumber));
    
    if (favoriteLics.length === 0) {
        alert('No hay favoritos en los resultados actuales');
        return;
    }
    
    renderCards(favoriteLics);
}

/**
 * Request notification permissions
 */
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Browser does not support notifications');
        return false;
    }
    
    if (Notification.permission === 'granted') {
        notificationsEnabled = true;
        updateNotificationButton();
        return true;
    }
    
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        notificationsEnabled = permission === 'granted';
        updateNotificationButton();
        return notificationsEnabled;
    }
    
    return false;
}

/**
 * Toggle notifications on/off
 */
async function toggleNotifications() {
    if (!('Notification' in window)) {
        alert('Tu navegador no soporta notificaciones');
        return;
    }
    
    if (Notification.permission === 'denied') {
        alert('Las notificaciones están bloqueadas. Por favor, habilítalas en la configuración de tu navegador.');
        return;
    }
    
    if (Notification.permission === 'default') {
        const granted = await requestNotificationPermission();
        if (granted) {
            alert('¡Notificaciones activadas! Recibirás alertas sobre visitas y cierres próximos.');
            // Check immediately for upcoming events
            if (currentLicitaciones.length > 0) {
                checkUpcomingEvents(currentLicitaciones);
            }
        }
    } else if (Notification.permission === 'granted') {
        alert('Las notificaciones están activas. Para desactivarlas, hazlo desde la configuración de tu navegador.');
    }
}

/**
 * Update notification button appearance
 */
function updateNotificationButton() {
    const btn = document.getElementById('notificationsToggle');
    if (!btn) return;
    
    if (notificationsEnabled) {
        btn.innerHTML = '🔔';
        btn.title = 'Notificaciones activadas';
        btn.style.opacity = '1';
    } else {
        btn.innerHTML = '🔕';
        btn.title = 'Activar notificaciones';
        btn.style.opacity = '0.5';
    }
}

/**
 * Show browser notification
 */
function showBrowserNotification(title, body, data = {}) {
    if (!notificationsEnabled) return;
    
    try {
        const notification = new Notification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: data.tag || 'licitacion',
            requireInteraction: false,
            ...data
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
            
            // If there's a rowNumber, open the detail modal
            if (data.rowNumber) {
                openDetailModal(data.rowNumber);
            }
        };
    } catch (error) {
        console.error('Error showing notification:', error);
    }
}

/**
 * Switch view mode (cards, list, table)
 */
function setViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('viewMode', mode);
    
    // Update button states
    document.querySelectorAll('.view-mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`viewMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`)?.classList.add('active');
    
    // Re-render with new view
    if (currentLicitaciones && currentLicitaciones.length > 0) {
        renderCards(currentLicitaciones);
    }
}

/**
 * Send email to contact with pre-filled template
 */
function sendEmailToContact(licId, templateType = 'inquiry') {
    const lic = currentLicitaciones.find(l => l.rowNumber === licId);
    if (!lic || !lic.contactEmail) {
        alert('No hay email de contacto disponible');
        return;
    }
    
    const templates = {
        inquiry: {
            subject: `Consulta sobre Licitación: ${lic.subject || ''}`,
            body: `Estimado/a ${lic.contactName || 'contacto'},

Saludos cordiales. Me comunico con respecto a la licitación:

${lic.subject || 'N/A'}

Me gustaría obtener más información sobre:
- [Agregar detalles específicos]

${lic.siteVisitDate && lic.siteVisitDate !== 'No disponible' ? 
`Además, confirmo mi interés en la visita programada para ${lic.siteVisitDate}.` : ''}

Quedo atento/a a su respuesta.

Gracias por su atención.

Saludos,
[Tu nombre]
[Tu empresa]
[Tu teléfono]`
        },
        visitConfirmation: {
            subject: `Confirmación de Visita - ${lic.subject || ''}`,
            body: `Estimado/a ${lic.contactName || 'contacto'},

Saludos cordiales.

Por medio de la presente, confirmo mi asistencia a la visita programada:

📅 Fecha: ${lic.siteVisitDate || 'N/A'}
🕐 Hora: ${lic.siteVisitTime || 'N/A'}
📍 Lugar: ${lic.visitLocation || 'N/A'}
📋 Licitación: ${lic.subject || 'N/A'}

Por favor, confirme si necesita alguna información adicional o documentación previa.

Gracias.

Saludos,
[Tu nombre]
[Tu empresa]
[Tu teléfono]`
        },
        followUp: {
            subject: `Seguimiento - ${lic.subject || ''}`,
            body: `Estimado/a ${lic.contactName || 'contacto'},

Saludos cordiales.

Me comunico para dar seguimiento a la licitación:

${lic.subject || 'N/A'}

Me gustaría conocer el estatus y si hay alguna actualización o documentación adicional requerida.

Quedo atento/a a sus comentarios.

Gracias.

Saludos,
[Tu nombre]
[Tu empresa]
[Tu teléfono]`
        }
    };
    
    const template = templates[templateType] || templates.inquiry;
    const mailtoLink = `mailto:${lic.contactEmail}?subject=${encodeURIComponent(template.subject)}&body=${encodeURIComponent(template.body)}`;
    
    window.location.href = mailtoLink;
}

/**
 * Show email template selector modal
 */
function showEmailTemplateSelector(licId) {
    const lic = currentLicitaciones.find(l => l.rowNumber === licId);
    if (!lic || !lic.contactEmail) {
        alert('No hay email de contacto disponible');
        return;
    }
    
    const hasVisit = lic.siteVisitDate && lic.siteVisitDate !== 'No disponible';
    
    const options = [
        { value: 'inquiry', label: '📧 Consulta General', description: 'Solicitar información sobre la licitación' },
        hasVisit ? { value: 'visitConfirmation', label: '✅ Confirmar Visita', description: 'Confirmar asistencia a la visita programada' } : null,
        { value: 'followUp', label: '🔄 Seguimiento', description: 'Dar seguimiento al estado de la licitación' }
    ].filter(Boolean);
    
    const optionsHtml = options.map(opt => `
        <button class="email-template-option" onclick="sendEmailToContact(${licId}, '${opt.value}'); closeEmailTemplateModal()">
            <div class="template-label">${opt.label}</div>
            <div class="template-description">${opt.description}</div>
        </button>
    `).join('');
    
    const modal = document.getElementById('emailTemplateModal');
    if (!modal) {
        // Create modal if it doesn't exist
        const modalHtml = `
            <div id="emailTemplateModal" class="modal-overlay" onclick="if(event.target === this) closeEmailTemplateModal()">
                <div class="modal-content email-template-modal">
                    <h2>Seleccionar Plantilla de Email</h2>
                    <p>Contacto: <strong>${escapeHtml(lic.contactEmail)}</strong></p>
                    <div id="emailTemplateOptions" class="email-template-options">
                        ${optionsHtml}
                    </div>
                    <button class="btn btn-secondary" onclick="closeEmailTemplateModal()">Cancelar</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } else {
        document.getElementById('emailTemplateOptions').innerHTML = optionsHtml;
        modal.style.display = 'flex';
    }
}

/**
 * Close email template modal
 */
function closeEmailTemplateModal() {
    const modal = document.getElementById('emailTemplateModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Export visits to iCal format (.ics)
 */
function exportToICalendar() {
    if (!currentLicitaciones || currentLicitaciones.length === 0) {
        alert('No hay licitaciones para exportar');
        return;
    }
    
    // Filter for visits only (licitaciones with visit dates)
    const visits = currentLicitaciones.filter(lic => {
        return lic.siteVisitDate && lic.siteVisitDate !== 'No disponible';
    });
    
    if (visits.length === 0) {
        alert('No hay visitas para exportar al calendario');
        return;
    }
    
    // Generate iCal content
    let icalContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Licitaciones Dashboard//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Visitas Licitaciones',
        'X-WR-TIMEZONE:America/Puerto_Rico'
    ];
    
    visits.forEach(lic => {
        try {
            const visitDate = new Date(lic.siteVisitDate);
            
            // Set time if available
            let startDate = new Date(visitDate);
            if (lic.siteVisitTime && lic.siteVisitTime !== 'Sin hora') {
                const [hours, minutes] = lic.siteVisitTime.split(':');
                startDate.setHours(parseInt(hours) || 9, parseInt(minutes) || 0, 0, 0);
            } else {
                startDate.setHours(9, 0, 0, 0); // Default to 9:00 AM
            }
            
            // End time (1 hour later)
            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
            
            // Format dates to iCal format (YYYYMMDDTHHMMSS)
            const formatICalDate = (date) => {
                const pad = (n) => String(n).padStart(2, '0');
                return date.getFullYear() +
                       pad(date.getMonth() + 1) +
                       pad(date.getDate()) + 'T' +
                       pad(date.getHours()) +
                       pad(date.getMinutes()) +
                       pad(date.getSeconds());
            };
            
            const dtStart = formatICalDate(startDate);
            const dtEnd = formatICalDate(endDate);
            const dtStamp = formatICalDate(new Date());
            
            // Create unique ID
            const uid = `lic-${lic.rowNumber}-${Date.now()}@licitaciones-dashboard`;
            
            // Clean and escape text for iCal
            const escapeICalText = (text) => {
                if (!text) return '';
                return String(text)
                    .replace(/\\/g, '\\\\')
                    .replace(/;/g, '\\;')
                    .replace(/,/g, '\\,')
                    .replace(/\n/g, '\\n');
            };
            
            const summary = escapeICalText(`Visita: ${lic.subject || 'Sin título'}`);
            const location = escapeICalText(lic.visitLocation || '');
            const description = escapeICalText(
                `Licitación: ${lic.subject || ''}\\n` +
                `Ubicación: ${lic.visitLocation || 'N/A'}\\n` +
                `Contacto: ${lic.contactName || 'N/A'}\\n` +
                `Teléfono: ${lic.contactPhone || 'N/A'}\\n` +
                `Categoría: ${lic.category || 'N/A'}`
            );
            
            icalContent.push('BEGIN:VEVENT');
            icalContent.push(`UID:${uid}`);
            icalContent.push(`DTSTAMP:${dtStamp}`);
            icalContent.push(`DTSTART:${dtStart}`);
            icalContent.push(`DTEND:${dtEnd}`);
            icalContent.push(`SUMMARY:${summary}`);
            if (location) icalContent.push(`LOCATION:${location}`);
            icalContent.push(`DESCRIPTION:${description}`);
            icalContent.push('STATUS:CONFIRMED');
            icalContent.push('TRANSP:OPAQUE');
            
            // Add alarm (reminder 1 day before)
            icalContent.push('BEGIN:VALARM');
            icalContent.push('TRIGGER:-P1D');
            icalContent.push('ACTION:DISPLAY');
            icalContent.push(`DESCRIPTION:Visita mañana: ${summary}`);
            icalContent.push('END:VALARM');
            
            icalContent.push('END:VEVENT');
        } catch (error) {
            console.error(`Error creating iCal event for ${lic.subject}:`, error);
        }
    });
    
    icalContent.push('END:VCALENDAR');
    
    // Create blob and download
    const icalString = icalContent.join('\r\n');
    const blob = new Blob([icalString], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `visitas-licitaciones-${new Date().toISOString().split('T')[0]}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert(`✅ Se exportaron ${visits.length} visita(s) al calendario.\n\nAbre el archivo .ics para importarlo a Google Calendar, Apple Calendar, Outlook, etc.`);
}

/**
 * Check for upcoming visits and closing dates
 */
function checkUpcomingEvents(licitaciones) {
    if (!notificationsEnabled || !licitaciones) return;
    
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);
    
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    // Check for visits tomorrow
    const visitsTomorrow = licitaciones.filter(lic => {
        if (lic.approvalStatus !== 'pending' && lic.approvalStatus !== 'approved') return false;
        if (!lic.siteVisitDate || lic.siteVisitDate === 'No disponible') return false;
        
        try {
            const visitDate = new Date(lic.siteVisitDate);
            return visitDate >= tomorrow && visitDate <= tomorrowEnd;
        } catch {
            return false;
        }
    });
    
    if (visitsTomorrow.length > 0) {
        showBrowserNotification(
            `🏗️ ${visitsTomorrow.length} Visita(s) Mañana`,
            `Tienes ${visitsTomorrow.length} visita(s) programada(s) para mañana`,
            { tag: 'visits-tomorrow' }
        );
    }
    
    // Check for visits in next 2 hours
    const visitsIn2Hours = licitaciones.filter(lic => {
        if (lic.approvalStatus !== 'pending' && lic.approvalStatus !== 'approved') return false;
        if (!lic.siteVisitDate || lic.siteVisitDate === 'No disponible') return false;
        
        try {
            const visitDate = new Date(lic.siteVisitDate);
            // Add time if available
            if (lic.siteVisitTime && lic.siteVisitTime !== 'Sin hora') {
                const [hours, minutes] = lic.siteVisitTime.split(':');
                visitDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0);
            }
            
            return visitDate >= now && visitDate <= in2Hours;
        } catch {
            return false;
        }
    });
    
    visitsIn2Hours.forEach(lic => {
        showBrowserNotification(
            `🚨 Visita Próxima`,
            `${lic.subject} - ${lic.siteVisitTime || 'Hora no especificada'}`,
            { 
                tag: `visit-soon-${lic.rowNumber}`,
                rowNumber: lic.rowNumber,
                requireInteraction: true
            }
        );
    });
    
    // Check for closing soon (tomorrow)
    const closingTomorrow = licitaciones.filter(lic => {
        if (lic.approvalStatus !== 'pending') return false;
        if (!lic.biddingCloseDate || lic.biddingCloseDate === 'No disponible') return false;
        
        try {
            const closeDate = new Date(lic.biddingCloseDate);
            return closeDate >= tomorrow && closeDate <= tomorrowEnd;
        } catch {
            return false;
        }
    });
    
    if (closingTomorrow.length > 0) {
        showBrowserNotification(
            `⏰ ${closingTomorrow.length} Licitación(es) Cierra(n) Mañana`,
            `No olvides revisar las licitaciones que cierran mañana`,
            { tag: 'closing-tomorrow' }
        );
    }
}



