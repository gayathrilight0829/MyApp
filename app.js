/**
 * StellarStudy // Premium Personal Study Tracker Core Engine (Full-Stack Version)
 * Communicates with the Node.js Express Backend via REST APIs and JSON Web Tokens
 */

// Global State Object (populated by server)
let state = {
    progress: { dsa: 0, ai: 0, apti: 0, systemdesign: 0, tech: 0, core: 0 },
    logs: [],
    events: [],
    resources: [],
    todos: [],
    mockTests: [],
    files: []
};

let isDataLoaded = false;

// Security Constants
const SESSION_KEY = "stellar_study_auth_session";
const TOKEN_KEY = "stellar_study_jwt_token";

// Motivation Quotes Library
const quotes = [
    { text: "The only way to learn a new programming language is by writing programs in it.", author: "Dennis Ritchie" },
    { text: "Quality is a product of a habit, not an act.", author: "Aristotle" },
    { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
    { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
    { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
    { text: "Clean code always looks like it was written by someone who cares.", author: "Michael Feathers" },
    { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
    { text: "Programs must be written for people to read, and only incidentally for machines to execute.", author: "Harold Abelson" },
    { text: "Consistency beats intensity every single time. Keep grinding.", author: "Anonymous" },
    { text: "Simplicity is the soul of efficiency.", author: "Austin Freeman" },
    { text: "Before software can be reusable it first has to be usable.", author: "Ralph Johnson" }
];

// Calendar Widget Constants & State
let currentDate = new Date();
let selectedCalendarDate = null;
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// Chronometer / Timer State
let timerInterval = null;
let timerDuration = 1800; // 30 minutes in seconds (default)
let timerRemaining = 1800;
let timerIsRunning = false;
let timerPresetSelected = 1800;

// Initialize Web App
document.addEventListener("DOMContentLoaded", () => {
    // 1. Check Authentication Status and setup Login view
    initAuth();
    
    // 2. Setup UI Event Listeners
    setupNavigationEventListeners();
    setupDashboardEventListeners();
    setupCalendarEventListeners();
    setupResourcesEventListeners();
    setupFilesEventListeners();
    setupTimerEventListeners();
});

/* ==========================================================================
   1. AUTHENTICATION & API UTILITIES
   ========================================================================== */
function getAuthToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

// Global API Request Helper with Authorization Headers
async function apiFetch(url, options = {}) {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
    };

    // If body is FormData (file upload), let the browser set the content type and boundary
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 || response.status === 403) {
        // Token has expired or is invalid, force logout
        handleLogout();
        throw new Error("Session expired. Please log in again.");
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    return response.json();
}

function initAuth() {
    const loginOverlay = document.getElementById("login-overlay");
    const appContainer = document.getElementById("app-container");
    const loginForm = document.getElementById("login-form");
    const loginError = document.getElementById("login-error");
    const logoutBtn = document.getElementById("btn-logout");
    const logoutMobileBtn = document.getElementById("btn-logout-mobile");

    // Check if authenticated
    const token = getAuthToken();

    if (token) {
        loginOverlay.classList.add("hidden");
        appContainer.classList.remove("hidden-app");
        updateWelcomeHeader();
        loadCoreData();
    }

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById("username").value.trim();
        const passwordInput = document.getElementById("password").value;

        try {
            const data = await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username: usernameInput, password: passwordInput })
            });

            if (data.token) {
                // Save Token
                sessionStorage.setItem(SESSION_KEY, "true");
                localStorage.setItem(SESSION_KEY, "true");
                sessionStorage.setItem(TOKEN_KEY, data.token);
                localStorage.setItem(TOKEN_KEY, data.token);

                loginError.classList.add("hidden");
                
                // Elegant smooth transition
                loginOverlay.style.opacity = "0";
                setTimeout(() => {
                    loginOverlay.classList.add("hidden");
                    appContainer.classList.remove("hidden-app");
                    updateWelcomeHeader();
                    // Load server study data
                    loadCoreData();
                }, 400);
            }
        } catch (err) {
            loginError.innerText = err.message;
            loginError.classList.remove("hidden");
            document.getElementById("password").value = "";
        }
    });

    if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
    if (logoutMobileBtn) logoutMobileBtn.addEventListener("click", handleLogout);
}

function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);

    const loginOverlay = document.getElementById("login-overlay");
    const appContainer = document.getElementById("app-container");

    appContainer.classList.add("hidden-app");
    loginOverlay.style.opacity = "1";
    loginOverlay.classList.remove("hidden");
    
    // Clear login form fields
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    
    // Clear state
    state = {
        progress: { dsa: 0, ai: 0, apti: 0, systemdesign: 0, tech: 0, core: 0 },
        logs: [],
        events: [],
        resources: [],
        todos: [],
        mockTests: [],
        files: []
    };
    isDataLoaded = false;
}

function updateWelcomeHeader() {
    const hours = new Date().getHours();
    const welcomeText = document.getElementById("welcome-message");
    const subTitleText = document.getElementById("current-date-display");
    
    let timeGreeting = "Welcome Back";
    if (hours < 12) timeGreeting = "Good Morning";
    else if (hours < 18) timeGreeting = "Good Afternoon";
    else timeGreeting = "Good Evening";

    welcomeText.innerText = `${timeGreeting}, Gayathri`;
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    subTitleText.innerText = `Deck Status Active // ${new Date().toLocaleDateString('en-US', options)}`;
}

/* ==========================================================================
   2. DATA SYNC & STORAGE (API Driven)
   ========================================================================== */
async function loadCoreData() {
    try {
        const data = await apiFetch('/api/userdata');
        if (data) {
            state = data;
            // Setup defaults if missing
            if (!state.progress) state.progress = { dsa: 0, ai: 0, apti: 0, systemdesign: 0, tech: 0, core: 0 };
            if (!state.logs) state.logs = [];
            if (!state.events) state.events = [];
            if (!state.resources) state.resources = [];
            if (!state.todos) state.todos = [];
            if (!state.mockTests) state.mockTests = [];
            if (!state.files) state.files = [];

            isDataLoaded = true; // Mark as successfully fetched

            recalculateAllProgress();
            
            // Refresh Active Tab Views
            const activeTab = document.querySelector(".nav-item.active").getAttribute("data-tab");
            refreshTabDisplay(activeTab);
        }
    } catch (err) {
        console.error("Failed to load user state from server", err);
    }
}

function recalculateAllProgress() {
    state.progress = { dsa: 0, ai: 0, apti: 0, systemdesign: 0, tech: 0, core: 0 };

    if (state.logs) {
        state.logs.forEach(log => {
            const cat = log.category;
            if (state.progress[cat] !== undefined) {
                state.progress[cat] = Math.min(100, state.progress[cat] + log.percentageIncrement);
            }
        });
    }
}

async function saveCoreData() {
    if (!isDataLoaded) {
        console.warn("Attempted to save core data before loading from server. Sync aborted.");
        return;
    }
    recalculateAllProgress();
    try {
        await apiFetch('/api/sync', {
            method: 'POST',
            body: JSON.stringify(state)
        });
        
        // Synchronize display views
        renderDashboardProgress();
        renderSubjectCards();
    } catch (err) {
        console.error("Failed to sync core study state with server", err);
    }
}

function refreshTabDisplay(tabId) {
    if (tabId === "home") {
        renderDashboardProgress();
        renderSubjectCards();
        rotateMotivationQuote();
    } else if (tabId === "calendar") {
        initCalendarWidget();
    } else if (tabId === "resources") {
        renderResources("all");
        renderTodos();
    } else if (tabId === "files") {
        renderFilesVaultList();
    } else if (tabId === "mocktest") {
        renderTestHistory();
    }
}

// Utility to get date relative to today
function getOffsetDateString(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split("T")[0];
}

/* ==========================================================================
   3. ROUTING & NAVIGATION
   ========================================================================== */
function setupNavigationEventListeners() {
    const navItems = document.querySelectorAll(".nav-item");
    const tabs = document.querySelectorAll(".tab-content");

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const targetTabId = item.getAttribute("data-tab");

            // Update Navigation Menu Active state
            navItems.forEach(btn => btn.classList.remove("active"));
            item.classList.add("active");

            // Update Tab Display State
            tabs.forEach(tab => tab.classList.remove("active"));
            const targetTab = document.getElementById(`tab-${targetTabId}`);
            if (targetTab) {
                targetTab.classList.add("active");
            }

            refreshTabDisplay(targetTabId);
        });
    });
}

/* ==========================================================================
   4. TAB 1: HOME PAGE BUSINESS LOGIC
   ========================================================================== */
function renderDashboardProgress() {
    // Calculated Overall Completion as average of categories
    const values = Object.values(state.progress);
    const sum = values.reduce((acc, curr) => acc + curr, 0);
    const average = Math.round(sum / values.length);

    // Update Percentage labels
    document.getElementById("overall-progress-text").innerText = average;
    document.getElementById("overall-percentage-badge").innerText = `${average}%`;

    // Calculate Dashoffset for Circular Progress ring (Circumference = 364.4)
    const ringFill = document.getElementById("overall-ring-fill");
    const circumference = 364.4;
    const offset = circumference - (average / 100) * circumference;
    ringFill.style.strokeDashoffset = offset;

    // Update session metrics
    document.getElementById("total-study-sessions").innerText = `${state.logs.length} Sessions`;

    // Recalculate streak count
    calculateStudyStreak();
    
    // Load dashboard list feeds
    renderHomeTimelineFeeds();
}

function renderSubjectCards() {
    const subjects = ["dsa", "ai", "apti", "systemdesign", "tech", "core"];
    subjects.forEach(sub => {
        const val = state.progress[sub] || 0;
        const progressBar = document.getElementById(`${sub}-progress-bar`);
        const progressText = document.getElementById(`${sub}-progress-text`);
        
        if (progressBar) progressBar.style.width = `${val}%`;
        if (progressText) progressText.innerText = `${val}%`;
    });
}

function calculateStudyStreak() {
    const streakEl = document.getElementById("streak-count");
    if (!streakEl) return;

    if (state.logs.length === 0) {
        streakEl.innerText = "0";
        return;
    }

    // Extract all unique logged dates sorted descending
    const loggedDates = [...new Set(state.logs.map(log => log.date))].sort((a, b) => new Date(b) - new Date(a));
    
    const todayStr = getOffsetDateString(0);
    const yesterdayStr = getOffsetDateString(-1);

    // If latest log is neither today nor yesterday, streak is broken
    if (loggedDates[0] !== todayStr && loggedDates[0] !== yesterdayStr) {
        streakEl.innerText = "0";
        return;
    }

    let streak = 1;
    let checkDate = new Date(loggedDates[0]);

    for (let i = 1; i < loggedDates.length; i++) {
        const diffTime = Math.abs(checkDate - new Date(loggedDates[i]));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            streak++;
            checkDate = new Date(loggedDates[i]);
        } else if (diffDays > 1) {
            break; // Streak broken in logs
        }
    }

    streakEl.innerText = streak;
}

function rotateMotivationQuote() {
    const quoteText = document.getElementById("motivation-quote");
    const quoteAuthor = document.getElementById("motivation-author");
    
    // Choose random quote
    const index = Math.floor(Math.random() * quotes.length);
    const selection = quotes[index];

    // Smooth animation
    quoteText.style.opacity = "0";
    quoteAuthor.style.opacity = "0";
    
    setTimeout(() => {
        quoteText.innerText = `"${selection.text}"`;
        quoteAuthor.innerText = `— ${selection.author}`;
        quoteText.style.opacity = "1";
        quoteAuthor.style.opacity = "1";
    }, 250);
}

function renderHomeTimelineFeeds() {
    const upcomingContainer = document.getElementById("home-upcoming-events");
    const recentLogsContainer = document.getElementById("home-recent-logs");
    const upcomingCountBadge = document.getElementById("upcoming-events-count");

    // RENDER UPCOMING EVENTS
    const today = new Date(getOffsetDateString(0));
    
    // Filter events scheduled for today or later and sort ascending
    const filteredEvents = state.events
        .filter(ev => new Date(ev.date) >= today)
        .sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

    if (upcomingCountBadge) upcomingCountBadge.innerText = `${filteredEvents.length} Event(s)`;

    if (filteredEvents.length === 0) {
        upcomingContainer.innerHTML = `
            <div class="empty-state">
                <p>No upcoming events or deadlines scheduled.</p>
            </div>
        `;
    } else {
        upcomingContainer.innerHTML = filteredEvents.slice(0, 5).map(ev => {
            let indicatorColorClass = "dot-deadline";
            if (ev.type === "milestone") indicatorColorClass = "dot-milestone";
            else if (ev.type === "test") indicatorColorClass = "dot-test";

            const d = new Date(ev.date);
            const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

            return `
                <div class="timeline-item">
                    <div class="timeline-indicator ${indicatorColorClass}"></div>
                    <div class="timeline-details">
                        <h5>${escapeHTML(ev.title)}</h5>
                        <div class="meta">${ev.type.toUpperCase()} • Scheduled at ${ev.time}</div>
                    </div>
                    <div class="timeline-meta-right">${dateStr}</div>
                </div>
            `;
        }).join("");
    }

    // RENDER RECENT STUDY LOGS
    const sortedLogs = [...state.logs].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sortedLogs.length === 0) {
        recentLogsContainer.innerHTML = `
            <div class="empty-state">
                <p>No logs found. Head over to Calendar tab to log your study sessions!</p>
            </div>
        `;
    } else {
        recentLogsContainer.innerHTML = sortedLogs.slice(0, 5).map(log => {
            const d = new Date(log.date);
            const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            const catLabel = getCategoryLabel(log.category);

            return `
                <div class="timeline-item">
                    <div class="timeline-indicator dot-log"></div>
                    <div class="timeline-details">
                        <h5>${escapeHTML(log.description)}</h5>
                        <div class="meta">${catLabel} • Completed (+${log.percentageIncrement}%)</div>
                    </div>
                    <div class="timeline-meta-right">${dateStr} (${log.duration}h)</div>
                </div>
            `;
        }).join("");
    }
}

function setupDashboardEventListeners() {
    document.getElementById("btn-next-quote").addEventListener("click", rotateMotivationQuote);
}

/* ==========================================================================
   5. TAB 2: CALENDAR & DAY STUDY LOGGER BUSINESS LOGIC
   ========================================================================== */
function setupCalendarEventListeners() {
    const btnMonth = document.getElementById("btn-calendar-month");
    const btnDay = document.getElementById("btn-calendar-day");
    const viewMonth = document.getElementById("calendar-month-view");
    const viewDay = document.getElementById("calendar-day-view");

    // Calendar Tab Toggle Sub-navigation
    btnMonth.addEventListener("click", () => {
        btnMonth.classList.add("active");
        btnDay.classList.remove("active");
        viewMonth.classList.remove("hidden-subview");
        viewDay.classList.add("hidden-subview");
        initCalendarWidget();
    });

    btnDay.addEventListener("click", () => {
        btnDay.classList.add("active");
        btnMonth.classList.remove("active");
        viewDay.classList.remove("hidden-subview");
        viewMonth.classList.add("hidden-subview");
        renderStudyLogsTable();
        document.getElementById("log-date").value = getOffsetDateString(0);
    });

    // Month Navigation Controls
    document.getElementById("prev-month").addEventListener("click", () => {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendarDays();
    });

    document.getElementById("next-month").addEventListener("click", () => {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendarDays();
    });

    // Form Event: Save New Event
    const eventForm = document.getElementById("add-event-form");
    eventForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const dateVal = document.getElementById("event-date-field").value;
        const titleVal = document.getElementById("event-title").value.trim();
        const timeVal = document.getElementById("event-time").value;
        const typeVal = document.getElementById("event-type").value;

        if (!dateVal || !titleVal) return;

        const newEvent = {
            id: Date.now(),
            date: dateVal,
            title: titleVal,
            time: timeVal,
            type: typeVal
        };

        state.events.push(newEvent);
        saveCoreData();
        
        document.getElementById("event-title").value = "";
        document.getElementById("event-time").value = "";
        
        renderCalendarDays();
        renderDayEventDetails(dateVal);
    });

    // Form Event: Submit Daily Study Log
    const studyLogForm = document.getElementById("study-logger-form");
    studyLogForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const dateVal = document.getElementById("log-date").value;
        const categoryVal = document.getElementById("log-category").value;
        const durationVal = parseFloat(document.getElementById("log-duration").value);
        const percentVal = parseInt(document.getElementById("log-percentage").value);
        const descVal = document.getElementById("log-description").value.trim();

        if (!dateVal || !categoryVal || isNaN(durationVal) || isNaN(percentVal) || !descVal) return;

        const newLog = {
            id: Date.now(),
            date: dateVal,
            category: categoryVal,
            duration: durationVal,
            description: descVal,
            percentageIncrement: percentVal
        };

        state.logs.push(newLog);
        saveCoreData();

        studyLogForm.reset();
        document.getElementById("log-date").value = getOffsetDateString(0);

        renderStudyLogsTable();
    });
}

function initCalendarWidget() {
    selectedCalendarDate = getOffsetDateString(0); // Default to today
    renderCalendarDays();
    renderDayEventDetails(selectedCalendarDate);
}

function renderCalendarDays() {
    const grid = document.getElementById("calendar-days-grid");
    const label = document.getElementById("calendar-month-year-label");
    
    grid.innerHTML = "";
    label.innerText = `${monthNames[currentMonth]} ${currentYear}`;

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevTotalDays = new Date(currentYear, currentMonth, 0).getDate();

    // Inactive previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevTotalDays - i;
        const monthNum = currentMonth === 0 ? 11 : currentMonth - 1;
        const yearNum = currentMonth === 0 ? currentYear - 1 : currentYear;
        const dateStr = formatDateString(yearNum, monthNum, dayNum);
        createDayNode(grid, dayNum, dateStr, true);
    }

    // Current month days
    const todayStr = getOffsetDateString(0);
    for (let day = 1; day <= totalDays; day++) {
        const dateStr = formatDateString(currentYear, currentMonth, day);
        createDayNode(grid, day, dateStr, false, dateStr === todayStr);
    }

    // Inactive next month padding
    const totalRendered = firstDayIndex + totalDays;
    const paddingNeeded = 42 - totalRendered;
    for (let day = 1; day <= paddingNeeded; day++) {
        const monthNum = currentMonth === 11 ? 0 : currentMonth + 1;
        const yearNum = currentMonth === 11 ? currentYear + 1 : currentYear;
        const dateStr = formatDateString(yearNum, monthNum, day);
        createDayNode(grid, day, dateStr, true);
    }
}

function createDayNode(container, dayNum, dateStr, isInactive, isToday = false) {
    const node = document.createElement("div");
    node.className = "calendar-grid-day";
    if (isInactive) node.classList.add("inactive-month-day");
    if (isToday) node.classList.add("current-day-badge");
    if (selectedCalendarDate === dateStr) node.classList.add("selected-day-badge");

    node.addEventListener("click", () => {
        selectedCalendarDate = dateStr;
        const allDays = container.querySelectorAll(".calendar-grid-day");
        allDays.forEach(cell => cell.classList.remove("selected-day-badge"));
        node.classList.add("selected-day-badge");
        renderDayEventDetails(dateStr);
    });

    const numSpan = document.createElement("span");
    numSpan.className = "day-num-label";
    numSpan.innerText = dayNum;
    node.appendChild(numSpan);

    const dotsDiv = document.createElement("div");
    dotsDiv.className = "day-event-dots";

    const dayEvents = state.events.filter(ev => ev.date === dateStr);
    dayEvents.forEach(ev => {
        const dot = document.createElement("div");
        dot.className = `event-dot dot-${ev.type}`;
        dotsDiv.appendChild(dot);
    });

    const isStudyLogged = state.logs.some(log => log.date === dateStr);
    if (isStudyLogged) {
        const dot = document.createElement("div");
        dot.className = "event-dot dot-log";
        dotsDiv.appendChild(dot);
    }

    node.appendChild(dotsDiv);
    container.appendChild(node);
}

function renderDayEventDetails(dateStr) {
    const selectedDate = new Date(dateStr);
    const dateTitle = document.getElementById("calendar-selected-date-title");
    const dateSubtitle = document.getElementById("calendar-selected-date-subtitle");
    
    const options = { month: "short", day: "numeric", year: "numeric" };
    dateTitle.innerText = selectedDate.toLocaleDateString("en-US", options);
    dateSubtitle.innerText = "Schedule events, milestones & deadlines";

    const eventForm = document.getElementById("add-event-form");
    const eventTitle = document.getElementById("event-title");
    const eventTime = document.getElementById("event-time");
    const eventType = document.getElementById("event-type");
    const eventSubmitBtn = document.getElementById("event-submit-btn");

    eventForm.classList.remove("disabled-form");
    eventTitle.disabled = false;
    eventTime.disabled = false;
    eventType.disabled = false;
    eventSubmitBtn.disabled = false;

    document.getElementById("event-date-field").value = dateStr;

    // Study logs for selection
    const daySummary = document.getElementById("day-study-summary");
    const dayLogs = state.logs.filter(log => log.date === dateStr);

    if (dayLogs.length === 0) {
        daySummary.innerHTML = `
            <div class="empty-state" style="padding: 1rem;">
                <p>No study logs logged on this date.</p>
            </div>
        `;
    } else {
        daySummary.innerHTML = dayLogs.map(log => {
            const catLabel = getCategoryLabel(log.category);
            return `
                <div class="day-study-tag tag-${log.category}">
                    <span>${catLabel}</span>
                    <span>${log.duration} Hrs • Incremented (+${log.percentageIncrement}%)</span>
                </div>
            `;
        }).join("");
    }

    // Events for selection
    const dayEventsList = document.getElementById("day-events-list");
    const dayEvents = state.events.filter(ev => ev.date === dateStr);

    if (dayEvents.length === 0) {
        dayEventsList.innerHTML = `
            <div class="empty-state" style="padding: 1rem;">
                <p>No events set for this date.</p>
            </div>
        `;
    } else {
        dayEventsList.innerHTML = dayEvents.map(ev => {
            return `
                <div class="day-event-item">
                    <div class="event-details-text">
                        <h6>${escapeHTML(ev.title)}</h6>
                        <span>${ev.type.toUpperCase()} at ${ev.time}</span>
                    </div>
                    <button class="btn-delete-event" onclick="deleteCalendarEvent(${ev.id}, '${dateStr}')">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
        }).join("");
    }
}

window.deleteCalendarEvent = function(eventId, dateStr) {
    state.events = state.events.filter(ev => ev.id !== eventId);
    saveCoreData();
    renderCalendarDays();
    renderDayEventDetails(dateStr);
};

function renderStudyLogsTable() {
    const tbody = document.getElementById("study-logs-tbody");
    const emptyState = document.getElementById("study-logs-empty");
    const tableContainer = document.getElementById("study-logs-table");

    if (state.logs.length === 0) {
        tbody.innerHTML = "";
        emptyState.classList.remove("hidden");
        tableContainer.classList.add("hidden");
    } else {
        emptyState.classList.add("hidden");
        tableContainer.classList.remove("hidden");

        const sortedLogs = [...state.logs].sort((a, b) => new Date(b.date) - new Date(a.date));

        tbody.innerHTML = sortedLogs.map(log => {
            const catLabel = getCategoryLabel(log.category);
            return `
                <tr>
                    <td style="font-family: var(--font-heading); font-weight: 500;">${log.date}</td>
                    <td>
                        <span class="subject-badge-inline ${log.category}-accent-bg" style="color: #fff;">
                            ${catLabel}
                        </span>
                    </td>
                    <td>${log.duration} Hours</td>
                    <td>+${log.percentageIncrement}% Increment</td>
                    <td>
                        <button class="btn-table-action" onclick="deleteStudyLog(${log.id})">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }
}

window.deleteStudyLog = function(logId) {
    state.logs = state.logs.filter(log => log.id !== logId);
    saveCoreData();
    renderStudyLogsTable();
};

function formatDateString(year, month, day) {
    const y = year;
    const m = String(month + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function getCategoryLabel(cat) {
    const labels = {
        dsa: "DSA",
        ai: "Artificial Intelligence",
        apti: "Aptitude",
        systemdesign: "System Design",
        tech: "Technology",
        core: "Core IT"
    };
    return labels[cat] || cat.toUpperCase();
}

/* ==========================================================================
   6. TAB 3: RESOURCE VAULT & TODOLIST BUSINESS LOGIC
   ========================================================================== */
function setupResourcesEventListeners() {
    const openAddBtn = document.getElementById("btn-open-add-resource");
    const cancelAddBtn = document.getElementById("btn-cancel-resource");
    const resourcePanel = document.getElementById("add-resource-panel");
    const filterChips = document.querySelectorAll(".resource-filters .filter-chip");

    openAddBtn.addEventListener("click", () => {
        resourcePanel.classList.toggle("hidden-element");
    });
    
    cancelAddBtn.addEventListener("click", () => {
        resourcePanel.classList.add("hidden-element");
    });

    const addResourceForm = document.getElementById("add-resource-form");
    addResourceForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const nameVal = document.getElementById("resource-name").value.trim();
        const catVal = document.getElementById("resource-category").value;
        const urlVal = document.getElementById("resource-url").value.trim();

        if (!nameVal || !catVal || !urlVal) return;

        const newResource = {
            id: Date.now(),
            name: nameVal,
            category: catVal,
            url: urlVal
        };

        state.resources.push(newResource);
        saveCoreData();

        addResourceForm.reset();
        resourcePanel.classList.add("hidden-element");
        
        const activeFilter = document.querySelector(".resource-filters .filter-chip.active").getAttribute("data-filter");
        renderResources(activeFilter);
    });

    filterChips.forEach(chip => {
        chip.addEventListener("click", () => {
            filterChips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            const filterVal = chip.getAttribute("data-filter");
            renderResources(filterVal);
        });
    });

    const todoForm = document.getElementById("add-todo-form");
    todoForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const textVal = document.getElementById("todo-text").value.trim();
        const priorityVal = document.getElementById("todo-priority").value;

        if (!textVal) return;

        const newTodo = {
            id: Date.now(),
            text: textVal,
            priority: priorityVal,
            completed: false
        };

        state.todos.push(newTodo);
        saveCoreData();

        todoForm.reset();
        document.getElementById("todo-priority").value = "medium";
        renderTodos();
    });

    document.getElementById("btn-clear-completed-todo").addEventListener("click", () => {
        state.todos = state.todos.filter(t => !t.completed);
        saveCoreData();
        renderTodos();
    });
}

function renderResources(filterCategory) {
    const listContainer = document.getElementById("resources-vault-list");
    let targetList = state.resources;

    if (filterCategory !== "all") {
        targetList = state.resources.filter(res => res.category === filterCategory);
    }

    if (targetList.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state" style="grid-column: span 2;">
                <p>No resources found for this category.</p>
            </div>
        `;
    } else {
        listContainer.innerHTML = targetList.map(res => {
            const catLabel = getCategoryLabel(res.category);
            return `
                <div class="resource-item-card">
                    <div class="resource-item-header">
                        <div>
                            <span class="subject-badge-inline ${res.category}-accent-bg" style="color: #fff; margin-bottom: 0.35rem;">
                                ${catLabel}
                            </span>
                            <h5>${escapeHTML(res.name)}</h5>
                        </div>
                        <button class="btn-delete-event" onclick="deleteResource(${res.id}, '${filterCategory}')">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                    <div class="resource-meta-footer">
                        <span class="small-text text-muted" style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${escapeHTML(res.url)}
                        </span>
                        <a href="${escapeHTML(res.url)}" target="_blank" class="resource-link-btn">
                            Visit Link
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                        </a>
                    </div>
                </div>
            `;
        }).join("");
    }
}

window.deleteResource = function(resId, currentFilter) {
    state.resources = state.resources.filter(res => res.id !== resId);
    saveCoreData();
    renderResources(currentFilter);
};

function renderTodos() {
    const container = document.getElementById("todos-list-container");
    const countsDisplay = document.getElementById("todo-counts-display");

    const pendingTodos = state.todos.filter(t => !t.completed);
    countsDisplay.innerText = `${pendingTodos.length} Active Items`;

    if (state.todos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No milestone tasks planned. Complete details above.</p>
            </div>
        `;
    } else {
        const sortedTodos = [...state.todos].sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            const priorities = { high: 3, medium: 2, low: 1 };
            return priorities[b.priority] - priorities[a.priority];
        });

        container.innerHTML = sortedTodos.map(todo => {
            return `
                <div class="todo-item-node">
                    <label class="todo-checkbox-wrapper" for="todo-chk-${todo.id}">
                        <input type="checkbox" id="todo-chk-${todo.id}" ${todo.completed ? 'checked' : ''} onchange="toggleTodoComplete(${todo.id})">
                        <div class="custom-checkbox-node">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <span class="todo-label-text">${escapeHTML(todo.text)}</span>
                    </label>
                    <div class="todo-item-meta-right">
                        <span class="priority-tag priority-${todo.priority}">${todo.priority}</span>
                        <button class="btn-delete-event" onclick="deleteTodo(${todo.id})">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join("");
    }
}

window.toggleTodoComplete = function(todoId) {
    const todo = state.todos.find(t => t.id === todoId);
    if (todo) {
        todo.completed = !todo.completed;
        saveCoreData();
        renderTodos();
    }
};

window.deleteTodo = function(todoId) {
    state.todos = state.todos.filter(t => t.id !== todoId);
    saveCoreData();
    renderTodos();
};

/* ==========================================================================
   7. TAB 4: FILE VAULT SYSTEM (Multipart Server-Side Storage)
   ========================================================================== */
function setupFilesEventListeners() {
    const dropzone = document.getElementById("file-dropzone");
    const fileInput = document.getElementById("real-file-input");
    const triggerUpload = document.getElementById("btn-trigger-upload");
    const fileFilters = document.querySelectorAll(".files-category-selector .filter-chip");

    triggerUpload.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
        handleVaultFiles(e.target.files);
    });

    dropzone.addEventListener("dragenter", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
    });
    
    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
    });
    
    dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        handleVaultFiles(e.dataTransfer.files);
    });

    fileFilters.forEach(chip => {
        chip.addEventListener("click", () => {
            fileFilters.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");
            renderFilesVaultList();
        });
    });
}

async function handleVaultFiles(files) {
    if (!files || files.length === 0) return;
    
    const indicator = document.getElementById("upload-status-indicator");
    const label = document.getElementById("upload-status-filename");
    const bar = document.getElementById("upload-status-bar");

    indicator.classList.remove("hidden-element");
    bar.style.width = "0%";

    // Loop upload files to backend server
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        label.innerText = `Uploading: ${file.name} (${formatBytes(file.size)})`;
        bar.style.width = `${(i / files.length) * 100}%`;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const result = await apiFetch('/api/files/upload', {
                method: 'POST',
                body: formData
            });

            if (result.file) {
                // Add uploaded file reference to state
                if (!state.files) state.files = [];
                state.files.push(result.file);
            }
        } catch (err) {
            console.error("File upload failed", err);
            alert(`Failed to upload file ${file.name}: ${err.message}`);
        }
    }

    bar.style.width = "100%";
    setTimeout(() => {
        indicator.classList.add("hidden-element");
        renderFilesVaultList();
    }, 600);
}

function renderFilesVaultList() {
    const listContainer = document.getElementById("files-vault-list");
    const activeFilter = document.querySelector(".files-category-selector .filter-chip.active").getAttribute("data-file-filter");

    const allFiles = state.files || [];
    
    // Calculate storage space
    const totalSize = allFiles.reduce((acc, curr) => acc + curr.size, 0);
    document.getElementById("storage-utilization-badge").innerText = formatBytes(totalSize);

    // Filter files based on chips
    let filtered = allFiles;
    if (activeFilter === "pdf") {
        filtered = allFiles.filter(f => f.type.toLowerCase().includes("pdf"));
    } else if (activeFilter === "excel") {
        filtered = allFiles.filter(f => f.type.toLowerCase().includes("excel") || f.type.toLowerCase().includes("sheet") || f.name.endsWith(".xls") || f.name.endsWith(".xlsx") || f.name.endsWith(".csv"));
    } else if (activeFilter === "ebook") {
        filtered = allFiles.filter(f => f.name.endsWith(".epub") || f.name.endsWith(".mobi") || f.name.endsWith(".txt") || f.type.includes("epub"));
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <p>No documents matching this category in server vault.</p>
            </div>
        `;
    } else {
        // Sort descending
        filtered.sort((a, b) => b.id.localeCompare(a.id));

        listContainer.innerHTML = filtered.map(file => {
            let badgeClass = "icon-ebook";
            let badgeSVG = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;

            if (file.type.includes("pdf")) {
                badgeClass = "icon-pdf";
                badgeSVG = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
            } else if (file.type.includes("excel") || file.type.includes("sheet") || file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv")) {
                badgeClass = "icon-excel";
                badgeSVG = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>`;
            }

            return `
                <div class="file-item-row">
                    <div class="file-details-left">
                        <div class="file-type-icon ${badgeClass}">
                            ${badgeSVG}
                        </div>
                        <div class="file-meta-text">
                            <h5>${escapeHTML(file.name)}</h5>
                            <div class="file-subtext">Uploaded: ${file.uploadedAt} • Size: ${formatBytes(file.size)}</div>
                        </div>
                    </div>
                    <div class="file-actions-right">
                        <button class="btn-file-download" onclick="downloadVaultFile('${file.id}')" title="Download Document">
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </button>
                        <button class="btn-table-action" onclick="deleteVaultFile('${file.id}')" style="margin-left: 0.5rem;" title="Delete Document from Server">
                            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join("");
    }
}

window.downloadVaultFile = function(fileId) {
    // Redirect browser directly to download url (bypass jwt block on link clicks)
    const anchor = document.createElement("a");
    anchor.href = `/api/files/download/${fileId}`;
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
};

window.deleteVaultFile = async function(fileId) {
    if (!confirm("Are you sure you want to delete this document from the server vault?")) return;
    
    try {
        const response = await apiFetch(`/api/files/${fileId}`, {
            method: 'DELETE'
        });

        if (response.success) {
            state.files = state.files.filter(f => f.id !== fileId);
            renderFilesVaultList();
        }
    } catch (err) {
        console.error("Failed to delete physical file from server", err);
        alert(err.message);
    }
};

// Size formatting utility
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/* ==========================================================================
   8. TAB 5: MOCK TEST & CODING TIMER CHRONOMETER
   ========================================================================= */
function setupTimerEventListeners() {
    const btnStartPause = document.getElementById("btn-timer-start-pause");
    const btnReset = document.getElementById("btn-timer-reset");
    const presetsRow = document.getElementById("timer-presets-row");

    presetsRow.addEventListener("click", (e) => {
        const presetBtn = e.target.closest("button");
        if (!presetBtn || timerIsRunning) return;

        const val = parseInt(presetBtn.getAttribute("data-preset"));
        presetsRow.querySelectorAll("button").forEach(btn => btn.classList.remove("active-preset"));
        presetBtn.classList.add("active-preset");

        timerDuration = val;
        timerRemaining = val;
        timerPresetSelected = val;
        updateTimerDisplay();
    });

    btnStartPause.addEventListener("click", () => {
        if (timerIsRunning) {
            pauseTimer();
        } else {
            startTimer();
        }
    });

    btnReset.addEventListener("click", () => {
        resetTimer();
    });

    const testLogForm = document.getElementById("mock-test-log-form");
    testLogForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const titleVal = document.getElementById("test-title").value.trim();
        const categoryVal = document.getElementById("test-category").value;
        const solvedVal = parseInt(document.getElementById("test-problems-solved").value);
        const totalVal = parseInt(document.getElementById("test-problems-total").value);
        const durationVal = parseInt(document.getElementById("test-duration-logged").value);
        const scoreVal = parseInt(document.getElementById("test-score").value);

        if (!titleVal || isNaN(solvedVal) || isNaN(totalVal) || isNaN(durationVal) || isNaN(scoreVal)) return;

        const newTest = {
            id: Date.now(),
            date: getOffsetDateString(0),
            title: titleVal,
            category: categoryVal,
            problemsSolved: solvedVal,
            problemsTotal: totalVal,
            duration: durationVal,
            score: scoreVal
        };

        state.mockTests.push(newTest);
        saveCoreData();

        testLogForm.reset();
        document.getElementById("test-category").value = "dsa";

        renderTestHistory();
    });
}

function startTimer() {
    const labelSpan = document.getElementById("label-start-pause");
    const iconSVG = document.getElementById("icon-start-pause");
    const indicator = document.getElementById("timer-status-indicator");

    timerIsRunning = true;
    indicator.innerText = "TEST ACTIVE";
    indicator.style.color = "var(--accent-pink)";
    
    labelSpan.innerText = "Pause Test chronometer";
    iconSVG.innerHTML = `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`;

    let lastTime = Date.now();

    timerInterval = setInterval(() => {
        const currentTime = Date.now();
        const delta = Math.round((currentTime - lastTime) / 1000);
        
        if (delta >= 1) {
            timerRemaining = Math.max(0, timerRemaining - delta);
            lastTime = currentTime;
            updateTimerDisplay();

            if (timerRemaining === 0) {
                playChimeSound();
                pauseTimer();
                alert("Chronometer session elapsed! Log your results in the Coding session logger.");
                resetTimer();
            }
        }
    }, 200);
}

function pauseTimer() {
    const labelSpan = document.getElementById("label-start-pause");
    const iconSVG = document.getElementById("icon-start-pause");
    const indicator = document.getElementById("timer-status-indicator");

    timerIsRunning = false;
    indicator.innerText = "PAUSED";
    indicator.style.color = "var(--accent-yellow)";

    labelSpan.innerText = "Resume Test Session";
    iconSVG.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;

    clearInterval(timerInterval);
    timerInterval = null;
}

function resetTimer() {
    pauseTimer();
    
    const indicator = document.getElementById("timer-status-indicator");
    indicator.innerText = "STANDBY";
    indicator.style.color = "var(--text-muted)";

    timerRemaining = timerPresetSelected;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById("timer-display");
    const timerRing = document.getElementById("timer-ring-fill");

    const minutes = String(Math.floor(timerRemaining / 60)).padStart(2, "0");
    const seconds = String(timerRemaining % 60).padStart(2, "0");
    timerDisplay.innerText = `${minutes}:${seconds}`;

    const circumference = 502.65; // Matches the mobile scaled circle (2 * PI * 80 = 502.65)
    const fractionElapsed = (timerDuration - timerRemaining) / timerDuration;
    const offset = fractionElapsed * circumference;
    timerRing.style.strokeDashoffset = offset;
}

function playChimeSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (!audioCtx) return;

        const notes = [261.63, 329.63, 392.00, 523.25];
        let time = audioCtx.currentTime;

        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, time);
            
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(0.3, time + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            osc.start(time);
            osc.stop(time + 0.6);

            time += 0.15;
        });
    } catch (e) {
        console.error("Browser Web Audio API blocked or not supported", e);
    }
}

function renderTestHistory() {
    const tbody = document.getElementById("test-history-tbody");
    const emptyState = document.getElementById("test-history-empty");
    const tableContainer = document.getElementById("test-history-table");

    if (state.mockTests.length === 0) {
        tbody.innerHTML = "";
        emptyState.classList.remove("hidden");
        tableContainer.classList.add("hidden");
    } else {
        emptyState.classList.add("hidden");
        tableContainer.classList.remove("hidden");

        const sortedTests = [...state.mockTests].sort((a, b) => b.id - a.id);

        tbody.innerHTML = sortedTests.map(test => {
            const catLabel = getCategoryLabel(test.category);
            
            let efficiencyClass = "priority-low";
            if (test.score >= 80) efficiencyClass = "priority-medium";
            if (test.score >= 90) efficiencyClass = "priority-high";

            return `
                <tr>
                    <td style="font-family: var(--font-heading); font-weight: 500;">${test.date}</td>
                    <td>${escapeHTML(test.title)}</td>
                    <td>
                        <span class="subject-badge-inline ${test.category}-accent-bg" style="color: #fff;">
                            ${catLabel}
                        </span>
                    </td>
                    <td>${test.duration} mins</td>
                    <td>${test.problemsSolved} / ${test.problemsTotal} Qs</td>
                    <td>
                        <span class="efficiency-badge ${efficiencyClass}">
                            ${test.score}%
                        </span>
                    </td>
                    <td>
                        <button class="btn-table-action" onclick="deleteMockTestHistory(${test.id})">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }
}

window.deleteMockTestHistory = function(testId) {
    state.mockTests = state.mockTests.filter(t => t.id !== testId);
    saveCoreData();
    renderTestHistory();
};

/* ==========================================================================
   9. SECURITY HELPER FUNCTIONS
   ========================================================================== */
function escapeHTML(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
