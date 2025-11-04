// API Base URL
const API_BASE = window.location.origin;

// Current modal state
let currentModalAction = null;
let currentLicitacionId = null;
let isCalendarView = false;
let isVisitsOnlyView = false;
let calendarEvents = [];
let calendarMonthDate = new Date();
let calendarDataLoaded = false;
let currentDetailId = null;
const detailCache = new Map();
const visitLocationOptionsMap = new Map();
const townOptionsMap = new Map();

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Load licitaciones on page load
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadLicitaciones();

    ['statusFilter', 'categoryFilter', 'priorityFilter', 'visitLocationFilter', 'dateRangeFilter'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', handleFilterChange);
        }
    });

    // Make stat items clickable for filtering
    setupStatClickHandlers();

    // Setup town checkbox dropdown
    const townToggle = document.getElementById('townFilterToggle');
    const townMenu = document.getElementById('townFilterMenu');
    const townSearch = document.getElementById('townSearchInput');
    
    if (townToggle && townMenu) {
        townToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = townMenu.style.display === 'block';
            townMenu.style.display = isOpen ? 'none' : 'block';
            townToggle.classList.toggle('active', !isOpen);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!townToggle.contains(e.target) && !townMenu.contains(e.target)) {
                townMenu.style.display = 'none';
                townToggle.classList.remove('active');
            }
        });
    }

    if (townSearch) {
        townSearch.addEventListener('input', (e) => {
            filterTownOptions(e.target.value);
        });
    }

    const calendarToggleBtn = document.getElementById('calendarToggleBtn');
    if (calendarToggleBtn) {
        calendarToggleBtn.addEventListener('click', toggleCalendarView);
    }

    const visitsOnlyBtn = document.getElementById('visitsOnlyToggleBtn');
    if (visitsOnlyBtn) {
        visitsOnlyBtn.addEventListener('click', toggleVisitsOnlyView);
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
    const visitLocationSelect = document.getElementById('visitLocationFilter');
    const visitLocationValues = visitLocationSelect
        ? Array.from(visitLocationSelect.selectedOptions || [])
            .map(option => option.value)
            .filter(Boolean)
        : [];

    // Get selected towns from checkboxes
    const townCheckboxes = document.querySelectorAll('#townFilterOptions input[type="checkbox"]:checked');
    const townValues = Array.from(townCheckboxes).map(cb => cb.value).filter(Boolean);

    return {
        status: document.getElementById('statusFilter')?.value || '',
        category: document.getElementById('categoryFilter')?.value || '',
        priority: document.getElementById('priorityFilter')?.value || '',
        visitLocation: visitLocationValues,
        town: townValues,
        dateRange: document.getElementById('dateRangeFilter')?.value || '',
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
    const visitsBtn = document.getElementById('visitsOnlyToggleBtn');

    isCalendarView = !isCalendarView;
    isVisitsOnlyView = false; // Reset visits-only when switching to calendar

    if (isCalendarView) {
        calendarDataLoaded = false;
        if (cardsContainer) cardsContainer.style.display = 'none';
        if (calendarContainer) calendarContainer.style.display = 'block';
        if (toggleBtn) toggleBtn.textContent = '📄 Ver Tarjetas';
        if (visitsBtn) visitsBtn.textContent = '📍 Solo Visitas';
        loadCalendarEvents();
    } else {
        if (calendarContainer) calendarContainer.style.display = 'none';
        if (cardsContainer) cardsContainer.style.display = 'block';
        if (toggleBtn) toggleBtn.textContent = '📆 Ver Calendario';
        loadLicitaciones();
    }
}

function toggleVisitsOnlyView() {
    if (isCalendarView) {
        // If in calendar view, switch to cards first
        toggleCalendarView();
    }

    isVisitsOnlyView = !isVisitsOnlyView;
    const visitsBtn = document.getElementById('visitsOnlyToggleBtn');
    
    if (visitsBtn) {
        if (isVisitsOnlyView) {
            visitsBtn.textContent = '📋 Ver Todas';
            visitsBtn.classList.add('btn-primary');
            visitsBtn.classList.remove('btn-secondary');
        } else {
            visitsBtn.textContent = '📍 Solo Visitas';
            visitsBtn.classList.remove('btn-primary');
            visitsBtn.classList.add('btn-secondary');
        }
    }

    loadLicitaciones();
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
            updateVisitLocationOptions(calendarEvents.map(event => event.visitLocation));
            updateTownOptions(calendarEvents.map(event => extractTownFromLocation(event.location)));

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
                ${renderDetailItem('Fecha del Email', lic.emailDate ? new Date(lic.emailDate).toLocaleString('es-PR') : 'No disponible')}
                ${renderDetailItem('Fecha de Procesamiento', lic.processedAt ? new Date(lic.processedAt).toLocaleString('es-PR') : 'No disponible')}
                ${renderDetailItem('Prioridad', lic.priority || 'No asignada')}
                ${renderDetailItem('Estado', badgeText(lic.approvalStatus))}
            </div>
        </div>
        <div class="detail-section">
            <h3>Ubicación y Contacto</h3>
            <div class="detail-grid">
                ${renderDetailItem('Ubicación', lic.location || 'No disponible')}
                ${renderDetailItem('Categoría', lic.category || 'No clasificado')}
                ${renderDetailItem('Contacto', lic.contactName || 'No disponible')}
                ${renderDetailItem('Teléfono', lic.contactPhone || 'No disponible')}
            </div>
        </div>
        <div class="detail-section">
            <h3>Visitas y Cierre</h3>
            <div class="detail-grid">
                ${renderDetailItem('Fecha Visita', siteVisitDate)}
                ${renderDetailItem('Hora Visita', siteVisitTime)}
                ${renderDetailItem('Lugar de Visita', lic.visitLocation || 'No disponible')}
                ${renderDetailItem('Cierre Licitación', lic.biddingCloseDate || 'No disponible')}
                ${renderDetailItem('Hora Cierre', closeTime)}
            </div>
        </div>
        <div class="detail-section">
            <h3>Descripción</h3>
            <div class="detail-item-value">${formatMultiline(lic.description || 'No disponible')}</div>
        </div>
        ${lic.summary ? `
        <div class="detail-section">
            <h3>Resumen</h3>
            <div class="detail-item-value">${formatMultiline(lic.summary)}</div>
        </div>
        ` : ''}
        <div class="detail-section">
            <h3>Notas y Decisión</h3>
            <div class="detail-grid">
                ${renderDetailItem('Notas', lic.approvalNotes || 'Sin notas', 'detail-notes')}
                ${renderDetailItem('Estado de Decisión', lic.decisionStatus || 'Sin decisión')}
                ${renderDetailItem('Interesado', lic.interested ? 'Sí' : 'No')}
                ${renderDetailItem('Método de Extracción', lic.extractionMethod || 'No disponible')}
            </div>
        </div>
    `;
}

function renderDetailItem(label, value, extraClass = '') {
    const formattedValue = typeof value === 'string'
        ? escapeHtml(value).replace(/\n/g, '<br>')
        : value;

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
            document.getElementById('statTotal').textContent = stats.total;
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
            (currentStatus === '' && !statItem.classList.contains('pending') && 
             !statItem.classList.contains('approved') && !statItem.classList.contains('rejected'));
        
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
 * Load licitaciones with current filters
 */
async function loadLicitaciones() {
    if (isCalendarView) {
        return loadCalendarEvents();
    }

    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const cardsGrid = document.getElementById('cardsGrid');

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

            // Filter to only show licitaciones with visits if toggle is on
            if (isVisitsOnlyView) {
                licitaciones = licitaciones.filter(lic => {
                    return lic.siteVisitDate && lic.siteVisitDate.toLowerCase() !== 'no disponible';
                });
            }

            if (licitaciones.length > 0) {
                renderCards(licitaciones);
            } else {
                emptyState.style.display = 'block';
                const emptyMsg = emptyState.querySelector('p');
                if (emptyMsg) {
                    emptyMsg.textContent = isVisitsOnlyView 
                        ? '📍 No hay licitaciones con visitas programadas'
                        : '📋 No hay licitaciones que coincidan con los filtros';
                }
            }

            updateVisitLocationOptions(licitaciones.map(lic => lic.visitLocation));
            updateTownOptions(licitaciones.map(lic => extractTownFromLocation(lic.location)));
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
 * Render licitaciones as cards
 */
function renderCards(licitaciones) {
    const cardsGrid = document.getElementById('cardsGrid');
    cardsGrid.innerHTML = '';

    licitaciones.forEach(lic => {
        const card = createCard(lic);
        cardsGrid.appendChild(card);
    });
}

/**
 * Create a card element for a licitación
 */
function createCard(lic) {
    const card = document.createElement('div');
    const approvalStatus = (lic.approvalStatus || 'pending').toLowerCase();
    const hasVisit = lic.siteVisitDate && lic.siteVisitDate.toLowerCase() !== 'no disponible';
    card.className = `card status-${approvalStatus} ${hasVisit ? 'has-visit' : ''}`;

    // Format dates
    const emailDate = lic.emailDate ? new Date(lic.emailDate).toLocaleDateString('es-PR') : 'N/A';

    // Priority styling
    const priorityClass = `priority-${lic.priority?.toLowerCase() || 'medium'}`;
    const priorityText = lic.priority === 'High' ? 'Alta' : lic.priority === 'Medium' ? 'Media' : 'Baja';

    // Status text
    const statusText = approvalStatus === 'pending' ? 'Pendiente' : 
                       approvalStatus === 'approved' ? 'Aprobada' : 'Rechazada';

    // PDF link - handle both formula and URL formats
    const pdfLink = lic.pdfUrl || resolvePdfUrl(lic.pdfLink);
    const siteVisitDateDisplay = formatSiteVisitDate(lic.siteVisitDate);
    const siteVisitTimeDisplay = formatTimeLabel(lic.siteVisitTime);
    const siteVisitTimeLine = siteVisitTimeDisplay || (siteVisitDateDisplay !== 'No disponible' ? 'Sin hora' : '');

    card.innerHTML = `
        <div class="card-header">
            <div class="card-title">${escapeHtml(lic.subject || 'Sin título')}</div>
            <div style="display: flex; gap: 8px; align-items: center;">
                ${hasVisit ? '<span class="visit-badge">📍 Tiene Visita</span>' : ''}
                <span class="status-badge ${approvalStatus}">${statusText}</span>
            </div>
        </div>

        <div class="card-meta">
            <div class="meta-item">📅 ${emailDate}</div>
            <div class="meta-item">📂 ${escapeHtml(lic.category || 'N/A')}</div>
            <div class="meta-item"><span class="${priorityClass}">⚡ ${priorityText}</span></div>
        </div>

        <div class="card-section">
            <div class="section-label">Ubicación</div>
            <div class="section-content">${escapeHtml(lic.location || 'No especificada')}</div>
        </div>

        <div class="card-section">
            <div class="section-label">Descripción</div>
            <div class="section-content">${escapeHtml(truncate(lic.description || 'No disponible', 150))}</div>
        </div>

        ${lic.summary ? `
        <div class="card-section">
            <div class="section-label">Resumen</div>
            <div class="section-content">${escapeHtml(truncate(lic.summary, 120))}</div>
        </div>
        ` : ''}

        <div class="info-grid">
            <div class="info-item">
                <div class="section-label">Cierre de Licitación</div>
                <div class="section-content">
                    ${escapeHtml(lic.biddingCloseDate || 'N/A')}
                    ${lic.biddingCloseTime ? `<br>${escapeHtml(lic.biddingCloseTime)}` : ''}
                </div>
            </div>

            <div class="info-item">
                <div class="section-label">Visita al Sitio</div>
                <div class="section-content">
                    ${escapeHtml(siteVisitDateDisplay)}
                    ${siteVisitTimeLine ? `<br>${escapeHtml(siteVisitTimeLine)}` : ''}
                </div>
            </div>

            ${lic.contactName ? `
            <div class="info-item">
                <div class="section-label">Contacto</div>
                <div class="section-content">
                    ${escapeHtml(lic.contactName)}
                    ${lic.contactPhone ? `<br>${escapeHtml(lic.contactPhone)}` : ''}
                </div>
            </div>
            ` : ''}

            <div class="info-item">
                <div class="section-label">Archivo PDF</div>
                <div class="section-content">
                    <a href="${pdfLink}" target="_blank" rel="noopener noreferrer" style="color: #667eea; text-decoration: none; font-weight: 600;">
                        📄 ${escapeHtml(lic.pdfFilename || 'Ver PDF')}
                    </a>
                </div>
            </div>
        </div>

        ${lic.approvalNotes ? `
        <div class="card-section">
            <div class="section-label">Notas</div>
            <div class="section-content">${escapeHtml(lic.approvalNotes)}</div>
        </div>
        ` : ''}

        <div class="card-actions">
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
 * Clear all filters
 */
function clearFilters() {
    document.getElementById('statusFilter').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('priorityFilter').value = '';
    document.getElementById('dateRangeFilter').value = '';
    
    const visitLocationSelect = document.getElementById('visitLocationFilter');
    if (visitLocationSelect) {
        Array.from(visitLocationSelect.options).forEach(option => {
            option.selected = false;
        });
    }
    
    // Clear town checkboxes
    const townCheckboxes = document.querySelectorAll('#townFilterOptions input[type="checkbox"]:checked');
    townCheckboxes.forEach(cb => {
        cb.checked = false;
    });
    updateTownFilterLabel();
    
    handleFilterChange();
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    // Simple alert for now - can be enhanced with a toast library
    alert(message);
}

function updateVisitLocationOptions(candidates = []) {
    const select = document.getElementById('visitLocationFilter');
    if (!select || !Array.isArray(candidates)) {
        return;
    }

    const previousSelection = new Set(Array.from(select.selectedOptions || []).map(option => option.value));

    // Ensure currently selected values stay available even if not present in latest dataset
    previousSelection.forEach(label => {
        const normalizedLabel = normalizeVisitLocationLabel(label);
        if (!normalizedLabel) {
            return;
        }
        const key = normalizedLabel.toLowerCase();
        if (!visitLocationOptionsMap.has(key)) {
            visitLocationOptionsMap.set(key, normalizedLabel);
        }
    });

    candidates.forEach(label => {
        const normalizedLabel = normalizeVisitLocationLabel(label);
        if (!normalizedLabel) {
            return;
        }
        const key = normalizedLabel.toLowerCase();
        if (!visitLocationOptionsMap.has(key)) {
            visitLocationOptionsMap.set(key, normalizedLabel);
        }
    });

    if (visitLocationOptionsMap.size === 0) {
        select.innerHTML = '';
        return;
    }

    const sortedOptions = Array.from(visitLocationOptionsMap.entries())
        .sort((a, b) => a[1].localeCompare(b[1], 'es', { sensitivity: 'base' }));

    select.innerHTML = '';
    sortedOptions.forEach(([, label]) => {
        const option = document.createElement('option');
        option.value = label;
        option.textContent = label;
        option.selected = previousSelection.has(label);
        select.appendChild(option);
    });
}

function normalizeVisitLocationLabel(value) {
    if (!value) {
        return null;
    }

    const trimmed = value.toString().trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.toLowerCase() === 'no disponible') {
        return null;
    }

    return trimmed;
}

function updateTownOptions(candidates = []) {
    const container = document.getElementById('townFilterOptions');
    if (!container || !Array.isArray(candidates)) {
        return;
    }

    // Get currently selected towns
    const previousSelection = new Set(
        Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value)
    );

    // Ensure currently selected values stay available even if not present in latest dataset
    previousSelection.forEach(town => {
        const normalizedTown = normalizeTownLabel(town);
        if (!normalizedTown) {
            return;
        }
        const key = normalizedTown.toLowerCase();
        if (!townOptionsMap.has(key)) {
            townOptionsMap.set(key, normalizedTown);
        }
    });

    candidates.forEach(town => {
        const normalizedTown = normalizeTownLabel(town);
        if (!normalizedTown) {
            return;
        }
        const key = normalizedTown.toLowerCase();
        if (!townOptionsMap.has(key)) {
            townOptionsMap.set(key, normalizedTown);
        }
    });

    if (townOptionsMap.size === 0) {
        container.innerHTML = '<div style="padding: 12px; text-align: center; color: #718096;">No hay pueblos disponibles</div>';
        return;
    }

    const sortedOptions = Array.from(townOptionsMap.entries())
        .sort((a, b) => a[1].localeCompare(b[1], 'es', { sensitivity: 'base' }));

    container.innerHTML = '';
    sortedOptions.forEach(([key, label]) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'checkbox-option';
        wrapper.dataset.town = key;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `town-${key}`;
        checkbox.value = label;
        checkbox.checked = previousSelection.has(label);
        checkbox.addEventListener('change', () => {
            updateTownFilterLabel();
            handleFilterChange();
        });

        const labelEl = document.createElement('label');
        labelEl.htmlFor = `town-${key}`;
        labelEl.textContent = label;

        wrapper.appendChild(checkbox);
        wrapper.appendChild(labelEl);
        container.appendChild(wrapper);
    });

    updateTownFilterLabel();
}

function normalizeTownLabel(value) {
    if (!value) {
        return null;
    }

    const trimmed = value.toString().trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.toLowerCase() === 'no disponible') {
        return null;
    }

    return trimmed;
}

function extractTownFromLocation(location) {
    if (!location) {
        return null;
    }

    // Extract town name from location string (e.g., "SAN JUAN PR" -> "SAN JUAN")
    const normalized = location.toString().trim().toUpperCase();
    
    // Remove "PR" or "PUERTO RICO" suffix
    const withoutSuffix = normalized
        .replace(/\s*,?\s*PUERTO\s+RICO\s*$/i, '')
        .replace(/\s*,?\s*PR\s*$/i, '')
        .trim();
    
    if (!withoutSuffix || withoutSuffix.toLowerCase() === 'no disponible') {
        return null;
    }

    return withoutSuffix;
}

function updateTownFilterLabel() {
    const label = document.getElementById('townFilterLabel');
    if (!label) return;

    const checked = document.querySelectorAll('#townFilterOptions input[type="checkbox"]:checked');
    const count = checked.length;

    if (count === 0) {
        label.textContent = 'Todos los pueblos';
    } else if (count === 1) {
        label.textContent = checked[0].value;
    } else {
        label.textContent = `${count} pueblos seleccionados`;
    }
}

function filterTownOptions(searchTerm) {
    const options = document.querySelectorAll('#townFilterOptions .checkbox-option');
    const normalized = searchTerm.toLowerCase().trim();

    options.forEach(option => {
        const town = option.dataset.town || '';
        const label = option.querySelector('label')?.textContent || '';
        const matches = town.includes(normalized) || label.toLowerCase().includes(normalized);
        option.style.display = matches ? 'flex' : 'none';
    });
}

function selectAllTowns() {
    const checkboxes = document.querySelectorAll('#townFilterOptions input[type="checkbox"]:not(:checked)');
    const visibleCheckboxes = Array.from(checkboxes).filter(cb => {
        const option = cb.closest('.checkbox-option');
        return option && option.style.display !== 'none';
    });

    visibleCheckboxes.forEach(cb => {
        cb.checked = true;
    });

    updateTownFilterLabel();
    handleFilterChange();
}

function clearTownSelection() {
    const checkboxes = document.querySelectorAll('#townFilterOptions input[type="checkbox"]:checked');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });

    updateTownFilterLabel();
    handleFilterChange();
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



