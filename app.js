document.addEventListener('DOMContentLoaded', () => {
  const libraryEl = document.getElementById('widget-library');
  const gridEl = document.getElementById('dashboard-grid');
  const resetBtn = document.getElementById('reset-btn');
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('toggle-sidebar');
  const closeBtn = document.getElementById('close-sidebar');

  // Sidebar Toggle Logic
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.remove('collapsed');
  });

  closeBtn.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
  });

  // Live Data Endpoints
  const VERSE_API = 'https://labs.bible.org/api/?passage=votd&type=json';
  const WEATHER_API = 'https://api.open-meteo.com/v1/forecast?latitude=37.8716&longitude=-122.2727&current_weather=true&daily=precipitation_sum&timezone=America%2FLos_Angeles';
  const NEWS_API = 'https://saurav.tech/NewsAPI/top-headlines/category/technology/us.json';

  // Google API Configuration
  const CLIENT_ID = '1058518352466-6js0odii9p9lcj3g8r3omi5p0liv9j2r.apps.googleusercontent.com';
  const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';

  let tokenClient;
  let gapiInited = false;
  let gisInited = false;
  let activeCalendarWidget = null;

  // Initialize Google APIs
  function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
  }

  async function initializeGapiClient() {
    await gapi.client.init({
      discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    checkAuthStatus();
  }

  function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: '', // defined later in handleAuthClick
    });
    gisInited = true;
  }

  // Bind the global callbacks to window so the script tags can find them
  window.gapiLoaded = gapiLoaded;
  window.gisLoaded = gisLoaded;

  function handleAuthClick(widget) {
    activeCalendarWidget = widget;
    tokenClient.callback = async (resp) => {
      if (resp.error) throw (resp);
      await fetchCalendarEvents(widget);
      updateCalendarUI(widget, true);
    };

    if (gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  }

  function checkAuthStatus(widget = null) {
    const isAuth = gapi.client.getToken() !== null;
    if (widget) updateCalendarUI(widget, isAuth);
    return isAuth;
  }

  function updateCalendarUI(widget, isAuthenticated) {
    const authState = widget.querySelector('.calendar-auth-state');
    const eventsState = widget.querySelector('.calendar-events-state');
    if (isAuthenticated) {
      if (authState) authState.style.display = 'none';
      if (eventsState) eventsState.style.display = 'block';
    } else {
      if (authState) authState.style.display = 'block';
      if (eventsState) eventsState.style.display = 'none';
    }
  }

  // Initialize Sortable for the Library (Clone items)
  new Sortable(libraryEl, {
    group: {
      name: 'shared',
      pull: 'clone',
      put: false // Do not allow dropping back into the library
    },
    animation: 150,
    sort: false, // Prevent original library from being reordered
    handle: '.drag-handle',
  });

  // Initialize Sortable for the Dashboard Grid
  new Sortable(gridEl, {
    group: 'shared',
    animation: 150,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    onAdd: function (evt) {
      const itemEl = evt.item;
      setupWidget(itemEl);
      updateGridState();
      saveLayout();
    },
    onSort: function (evt) {
      saveLayout();
    },
    onRemove: function (evt) {
      updateGridState();
    }
  });

  function setupWidget(widget) {
    // Remove template class so it styled natively
    widget.classList.remove('template');

    // Add delete button if it doesn't exist
    if (!widget.querySelector('.delete-widget')) {
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-widget';
      delBtn.innerHTML = '✕';
      delBtn.title = 'Remove Widget';
      delBtn.onclick = () => {
        widget.style.transform = 'scale(0.8)';
        widget.style.opacity = '0';
        setTimeout(() => {
          widget.remove();
          updateGridState();
          saveLayout();
        }, 200);
      };
      widget.appendChild(delBtn);
    }

    // Initialize specific widget logic based on data-type
    const type = widget.getAttribute('data-type');

    if (type === 'clock') {
      updateClock(widget.querySelector('.clock-display'));
      // Start interval
      setInterval(() => {
        const clockDisplay = widget.querySelector('.clock-display');
        if (clockDisplay) updateClock(clockDisplay);
      }, 1000);
    } else if (type === 'verse') {
      fetchVerse(widget);
    } else if (type === 'notes') {
      const textarea = widget.querySelector('.glass-textarea');
      if (textarea) {
        textarea.addEventListener('input', saveLayout); // Save content on type
      }
    } else if (type === 'news') {
      fetchNews(widget);
    } else if (type === 'weather') {
      fetchWeather(widget);
    } else if (type === 'calendar') {
      setupCalendarWidget(widget);
    } else if (type === 'trends') {
      setupTrendsWidget(widget);
    }
  }

  function setupCalendarWidget(widget) {
    const signInBtn = widget.querySelector('.g-sign-in');
    if (signInBtn) {
      signInBtn.onclick = () => handleAuthClick(widget);
    }

    const addBtn = widget.querySelector('.add-event-btn');
    const input = widget.querySelector('.new-event-input');

    if (addBtn && input) {
      addBtn.onclick = () => addCalendarEvent(widget, input.value);
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addCalendarEvent(widget, input.value);
      });
    }

    // Check auth status if APIs are loaded
    if (gapiInited) {
      if (checkAuthStatus(widget)) {
        fetchCalendarEvents(widget);
      }
    }
  }

  function setupTrendsWidget(widget) {
    const container = widget.querySelector('.trends-container');
    if (!container || container.dataset.loaded === 'true') return;

    // Only load if it's on the dashboard (not in the library template)
    if (widget.closest('#widget-library')) return;

    container.innerHTML = ''; // clear placeholder

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://ssl.gstatic.com/trends_nrtr/3796_RC01/embed_loader.js';

    script.onload = () => {
      trends.embed.renderExploreWidgetTo(container, "TIMESERIES", { "comparisonItem": [{ "keyword": "AI", "geo": "US", "time": "today 12-m" }], "category": 0, "property": "" }, { "exploreQuery": "q=AI&geo=US&date=today 12-m", "guestPath": "https://trends.google.com:443/trends/embed/" });
    };

    container.appendChild(script);
    container.dataset.loaded = 'true';
  }

  async function fetchVerse(widget) {
    const display = widget.querySelector('#verse-display');
    const refDisplay = widget.querySelector('#verse-reference');
    if (!display) return;
    try {
      const res = await fetch(VERSE_API);
      const data = await res.json();
      if (data && data.length > 0) {
        display.textContent = `"${data[0].text}"`;
        refDisplay.textContent = `- ${data[0].bookname} ${data[0].chapter}:${data[0].verse}`;
      }
    } catch (e) {
      display.textContent = '"The Lord is my shepherd, I lack nothing."';
      refDisplay.textContent = '- Psalm 23:1';
    }
  }

  async function fetchWeather(widget) {
    const display = widget.querySelector('#weather-display');
    const subtitle = widget.querySelector('#weather-subtitle');
    const warning = widget.querySelector('#雨-warning') || widget.querySelector('.rain-warning');
    if (!display) return;
    try {
      const res = await fetch(WEATHER_API);
      const data = await res.json();
      const temp = Math.round(data.current_weather.temperature);
      const code = data.current_weather.weathercode;

      // Simple weather code mapping
      let icon = '☁️';
      if (code === 0 || code === 1) icon = '☀️';
      else if (code === 2 || code === 3) icon = '⛅';
      else if (code >= 60 && code <= 69) icon = '🌧️';
      else if (code >= 70 && code <= 79) icon = '❄️';

      display.textContent = `${icon} ${temp}°C`;
      subtitle.textContent = "Berkeley, CA";

      // Check rain warning for the next 3 days
      const rainDays = data.daily.precipitation_sum.slice(1, 4);
      const willRain = rainDays.some(amount => amount > 1.0);
      if (willRain && warning) {
        warning.style.display = 'block';
        warning.textContent = '⚠️ Rain expected soon';
      } else if (warning) {
        warning.style.display = 'none';
      }
    } catch (e) {
      display.textContent = '☁️ 16°C';
      subtitle.textContent = "Berkeley, CA (Offline)";
    }
  }

  async function fetchNews(widget) {
    const list = widget.querySelector('#news-list');
    if (!list) return;
    try {
      const res = await fetch(NEWS_API);
      const data = await res.json();
      const articles = data.articles.slice(0, 3); // Get top 3

      list.innerHTML = ''; // Clear loading state
      articles.forEach(article => {
        const li = document.createElement('li');
        li.className = 'news-item';
        li.style = 'margin-bottom: 10px; border-bottom: 1px solid var(--glass-border); padding-bottom: 8px;';

        const title = article.title.split(' - ')[0]; // Clean up title
        const url = `https://www.google.com/search?q=${encodeURIComponent(title)}`;
        const desc = article.description ? article.description.substring(0, 80) + '...' : '';

        li.innerHTML = `
            <a href="${url}" target="_blank" class="news-title" style="font-weight: 500; font-size: 0.95rem; color: #a5b4fc; text-decoration: none; display: block; margin-bottom: 4px;">${title}</a>
            <div class="news-summary" style="font-size: 0.85rem; color: var(--text-secondary);">${desc}</div>
         `;
        list.appendChild(li);
      });
    } catch (e) {
      list.innerHTML = '<li class="news-item" style="color: var(--text-secondary); font-size: 0.85rem;">Failed to load live news.</li>';
    }
  }

  async function fetchCalendarEvents(widget) {
    const list = widget.querySelector('.calendar-list');
    if (!list) return;

    try {
      const response = await gapi.client.calendar.events.list({
        'calendarId': 'primary',
        'timeMin': (new Date()).toISOString(),
        'showDeleted': false,
        'singleEvents': true,
        'maxResults': 5,
        'orderBy': 'startTime',
      });

      const events = response.result.items;
      list.innerHTML = '';

      if (!events || events.length === 0) {
        list.innerHTML = '<li style="font-size: 0.85rem; color: var(--text-secondary);">No upcoming events today.</li>';
        return;
      }

      events.forEach(event => {
        const start = event.start.dateTime || event.start.date;
        const timeString = new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const li = document.createElement('li');
        li.style = 'margin-bottom: 8px; font-size: 0.9rem; display: flex; align-items: flex-start; gap: 8px;';
        li.innerHTML = `
          <span style="color: #a5b4fc; min-width: 65px; font-weight: 500;">${timeString}</span>
          <span style="color: white;">${event.summary}</span>
        `;
        list.appendChild(li);
      });
    } catch (err) {
      console.error(err);
      list.innerHTML = '<li style="font-size: 0.85rem; color: #ff6b6b;">Error fetching events.</li>';
    }
  }

  async function addCalendarEvent(widget, title) {
    if (!title.trim()) return;
    const input = widget.querySelector('.new-event-input');
    input.value = ''; // clear input
    input.placeholder = 'Adding...';

    // Simple 1-hour event starting now
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const event = {
      'summary': title,
      'start': {
        'dateTime': startDate.toISOString(),
        'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      'end': {
        'dateTime': endDate.toISOString(),
        'timeZone': Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    try {
      await gapi.client.calendar.events.insert({
        'calendarId': 'primary',
        'resource': event,
      });
      input.placeholder = 'New event title...';
      fetchCalendarEvents(widget); // Refresh list
    } catch (err) {
      console.error(err);
      input.placeholder = 'Failed to add.';
      setTimeout(() => input.placeholder = 'New event title...', 2000);
    }
  }

  function updateClock(element) {
    if (!element) return;
    const now = new Date();
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutes = now.getMinutes().toString().padStart(2, '0');
    element.textContent = `${hours}:${minutes} ${ampm}`;
  }

  function updateGridState() {
    // Check if there are any widgets (ignore element with .empty-state-msg)
    const hasWidgets = Array.from(gridEl.children).some(child => child.classList.contains('widget-card'));
    if (hasWidgets) {
      gridEl.classList.add('has-widgets');
    } else {
      gridEl.classList.remove('has-widgets');
    }
  }

  function saveLayout() {
    const widgets = [];
    Array.from(gridEl.children).forEach(widget => {
      if (!widget.classList.contains('widget-card')) return;

      const type = widget.getAttribute('data-type');
      let content = null;

      if (type === 'notes') {
        content = widget.querySelector('.glass-textarea').value;
      }

      widgets.push({ type, content });
    });

    try {
      localStorage.setItem('superAppLayout', JSON.stringify(widgets));
    } catch (e) {
      console.error("Could not save to localStorage", e);
    }
  }

  function loadLayout() {
    try {
      const saved = localStorage.getItem('superAppLayout');
      if (saved) {
        const widgets = JSON.parse(saved);

        // Only clear if there are widgets to load
        if (widgets.length > 0) {
          // remove all existing widget cards from grid
          Array.from(gridEl.querySelectorAll('.widget-card')).forEach(w => w.remove());
        }

        widgets.forEach(data => {
          const template = libraryEl.querySelector(`.widget-card[data-type="${data.type}"]`);
          if (template) {
            const clone = template.cloneNode(true);
            gridEl.appendChild(clone);
            setupWidget(clone);

            // Restore specific content if applicable
            if (data.type === 'notes' && data.content) {
              clone.querySelector('.glass-textarea').value = data.content;
            }
          }
        });
      }
    } catch (e) {
      console.error("Could not load from localStorage", e);
    }

    updateGridState();
  }

  resetBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to reset your dashboard layout?")) {
      Array.from(gridEl.querySelectorAll('.widget-card')).forEach(w => w.remove());
      localStorage.removeItem('superAppLayout');
      updateGridState();
    }
  });

  // Initial load
  loadLayout();

  // Default clock tick for template in library
  setInterval(() => {
    const libraryClock = libraryEl.querySelector('.clock-display');
    if (libraryClock) updateClock(libraryClock);
  }, 1000);

  // Fetch initial data for templates in library
  const libWeather = libraryEl.querySelector('.widget-card[data-type="weather"]');
  if (libWeather) fetchWeather(libWeather);
  const libNews = libraryEl.querySelector('.widget-card[data-type="news"]');
  if (libNews) fetchNews(libNews);
  const libVerse = libraryEl.querySelector('.widget-card[data-type="verse"]');
  if (libVerse) fetchVerse(libVerse);
});
