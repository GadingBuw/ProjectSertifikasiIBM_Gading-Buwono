# Student Task Manager — Documentation

## Project Overview

A fully client-side academic task manager for Sistem Informasi students.
Built with vanilla HTML, CSS, and JavaScript — no build tools or external dependencies.

---

## File Structure

```
ProjectSertifikasiIBM_GadingBuwono/
├── index.html      — Application shell & all views
├── style.css       — Full CSS (variables, layout, components)
├── script.js       — Application logic, data management, rendering
└── tasks.json      — Initial dummy dataset (30 academic tasks)
```

---

## Dataset Structure (`tasks.json`)

### Top-Level Shape

```json
{
  "metadata": { ... },
  "tasks": [ ... ]
}
```

### Task Object Schema

| Field         | Type    | Values / Format                        | Notes                                      |
|---------------|---------|----------------------------------------|--------------------------------------------|
| `id`          | string  | `"TASK-001"` … `"TASK-030"`            | Must be unique                             |
| `title`       | string  | Free text                              | Required                                   |
| `course`      | string  | See course list below                  | Required                                   |
| `description` | string  | Free text                              | Required                                   |
| `due_date`    | string  | `"YYYY-MM-DD"`                         | Required, ISO 8601 date                    |
| `priority`    | string  | `"Low"` \| `"Medium"` \| `"High"`      | Required                                   |
| `status`      | string  | `"To Do"` \| `"In Progress"` \| `"Completed"` | Required                          |
| `progress`    | integer | `0` – `100`                            | Must match status (see consistency rules) |
| `created_at`  | string  | `"YYYY-MM-DD"`                         | Required                                   |

### Data Consistency Rules

| Status        | Required `progress` value |
|---------------|---------------------------|
| `Completed`   | exactly `100`             |
| `To Do`       | exactly `0`               |
| `In Progress` | `1` – `99` (inclusive)    |

These rules are also enforced in `script.js` during form submission — the UI
automatically corrects edge cases (e.g. setting progress=100 on an In Progress
task clamps it to 99).

### Dataset Distribution (30 tasks)

| Status       | Count | % |
|--------------|-------|---|
| Completed    | 6     | 20% |
| In Progress  | 10    | 33% |
| To Do        | 14    | 47% |

| Priority | Count |
|----------|-------|
| High     | 13    |
| Medium   | 10    |
| Low      | 4+    |

### Courses Used

- Basis Data
- Pemrograman Web
- Rekayasa Perangkat Lunak
- Analisis dan Perancangan Sistem Informasi
- Interaksi Manusia dan Komputer
- Manajemen Proyek Sistem Informasi
- Data Mining
- Sistem Informasi Manajemen

---

## LocalStorage Integration

### Key

```
stm_tasks_v1
```

### Initialization Flow

```
Page Load
    │
    ▼
Is "stm_tasks_v1" in LocalStorage?
    │
    ├── YES → Parse JSON → load into memory → render
    │
    └── NO  → fetch("tasks.json")
                  │
                  ▼
              Parse tasks array → write to LocalStorage → render
```

**Important:** `tasks.json` is only read **once** — on the very first visit.
Subsequent page loads always use LocalStorage. This means the user's edits,
additions, and deletions persist across browser refreshes.

### Reset to Defaults

To reload the original dummy data, run in the browser DevTools console:

```js
localStorage.removeItem('stm_tasks_v1');
location.reload();
```

---

## Application Features

### Dashboard
- 5 stat cards: Total | Selesai | In Progress | To Do | Terlambat
- Upcoming tasks list (next 5 by deadline)
- Overdue tasks list
- Per-course average progress bars

### Task List
- Full CRUD: add, edit, delete
- Filters: status / priority / course / sort order
- Global search (title, course, description)
- Progress bar + overdue indicators per row

### Calendar
- Monthly view with navigation
- Per-day task dots (colour-coded by priority / completion / overdue)
- Click any day to see tasks due on that date

### Analytics
- Donut charts: status distribution, priority distribution
- Bar chart: task count per course
- Summary grid: completion rate, avg progress, overdue count, active high-priority, courses, total

---

## Running the Application

Since `script.js` uses `fetch()` to load `tasks.json`, the files must be served
over HTTP (not opened as `file://`). Use any local server:

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code
# Install "Live Server" extension → Right-click index.html → "Open with Live Server"
```

Then open `http://localhost:8080` in your browser.

---

## Technical Notes

- **No external dependencies** — pure HTML/CSS/JS, zero npm packages.
- **Responsive** — adapts to desktop (1200px+), tablet (900px), and mobile (640px).
- **XSS-safe** — all user-supplied content is HTML-escaped via `escHtml()` before
  being inserted into the DOM.
- **SVG charts** — donut charts are rendered with inline `<circle>` elements using
  `stroke-dasharray`; no canvas or third-party charting library needed.
