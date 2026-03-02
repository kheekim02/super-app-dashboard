document.addEventListener('DOMContentLoaded', () => {
  const libraryEl = document.getElementById('widget-library');
  const gridEl = document.getElementById('dashboard-grid');
  const resetBtn = document.getElementById('reset-btn');

  const quotes = [
    "Stay curious.",
    "The best way to predict the future is to invent it.",
    "Simplicity is the ultimate sophistication.",
    "Make it work, make it right, make it fast.",
    "Design is not just what it looks like and feels like. Design is how it works.",
    "Code is poetry.",
    "Everything should be made as simple as possible, but not simpler."
  ];

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
    } else if (type === 'quote') {
      const quoteDisplay = widget.querySelector('.quote-display');
      if (quoteDisplay && quoteDisplay.textContent === '"Stay curious."') {
        quoteDisplay.textContent = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;
      }
    } else if (type === 'notes') {
      const textarea = widget.querySelector('.glass-textarea');
      if (textarea) {
        textarea.addEventListener('input', saveLayout); // Save content on type
      }
    } else if (type === 'news') {
      const newsItems = widget.querySelectorAll('.news-item');
      // Titles are now direct links to Google Search, no JS toggle needed.
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
      } else if (type === 'quote') {
        content = widget.querySelector('.quote-display').textContent;
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
            } else if (data.type === 'quote' && data.content) {
              clone.querySelector('.quote-display').textContent = data.content;
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
});
