# Salamander Home — Obsidian Homepage Design

**Date:** 2026-10-30
**Owner:** Jason
**Status:** Draft, reviewed by a builder, awaiting Jason's approval

## Intent

Jason wants a homepage note that opens when Obsidian starts and works as a
morning glance. It should tell him what day it is, what the weather is doing,
what's in the news and markets, what he meant to do today, and which bills are
coming due.

It blends three references:

1. **A Reddit Obsidian homepage**: a big date-and-weather banner, a row of
   one-click action buttons, a tasks view and a calendar.
2. **His desktop terminal panel**: market snapshot, top stories, and very
   detailed weather (hourly curve, 7-day range bars, sunrise/sunset, moon).
3. **His Glance new-tab page** (self-hosted on `voidberry`, config at
   `voidberry:/home/jason/glance/glance.yml`). **This is the main
   reference.** He loves it. The body of the homepage should look and read
   like Glance: three columns, small uppercase section labels, dense rows,
   news cards and lists, and market rows with sparklines.

Everything is styled with the **Salamander** Obsidian theme (his own theme,
`~/obsidian-salamander`). It uses sharp corners, monospace fonts and a rust,
green and ochre palette, and its colors follow the active preset.

## Agreed layout

Jason chose **the banner from mockup B on top of the body from mockup A**.
Mockup: `layout-v2.html` (see "Reference artifacts").

```
┌──────────────────────────────────────────────────────────────────────┐
│ // FRIDAY, OCTOBER 30                                    (banner)    │
│ Week 44 · day 303 · links…   ☀ 50° now · Tomorrow H63 L44 · 0% rain  │
│ [+ CAPTURE] [DAILY] [SEARCH] [BILLS] [CLIPPINGS] [GLANCE ↗]          │
├──────────────┬────────────────────────────────────┬──────────────────┤
│ WEATHER      │ TOP STORIES   (horizontal cards)   │ MONTH CALENDAR   │
│  now + hourly│                                    │                  │
│  multi-day   │ BUSINESS & MARKETS (detailed list) │ BILLS            │
│  sun / moon  │ POLITICS & ANALYSIS                │                  │
│              │ NFL & COWBOYS                      │ MACRO / CRYPTO / │
│ TODAY        │                                    │ BELLWETHERS      │
└──────────────┴────────────────────────────────────┴──────────────────┘
   small                    wide                          small
```

Column proportions are about 1 : 2.3 : 1, as in the mockup.

## Goals

- One note opens on startup and shows everything above, live.
- News, markets and weather are real, current data, refreshed automatically.
- A **Today box** is the lightweight stand-in for a task system. Jason does not
  keep a task list anywhere today and doesn't want a heavy system.
- A **bill tracker** where Jason enters bills by hand as they arrive (some by
  email, some by mail), sees what's due or late, and ticks them off when paid.
- It looks like it belongs to Salamander and to Glance.

## Non-goals

These were in the Reddit reference and were deliberately left out:

- An hour-by-hour agenda or timeline (Jason keeps no calendar of appointments).
- A Pomodoro or focus timer, habit or workout tracking, check-ins.
- An embedded AI or terminal pane.
- Glance's infrastructure widgets: server stats, service monitor, Pi-hole
  stats, Docker containers, bookmarks.
- Recurring or automatic bills, bill reminders outside Obsidian, monthly totals
  or budgeting. Jason was offered these and is fine without them.
- Changes to the Salamander theme itself.

## Anti-goals (would count as failure even if it works)

- **Slowing down Obsidian startup.** The page must draw at once from cached data
  and fetch in the background.
- **One broken feed breaking the page.** Each panel fails on its own and quietly.
- **Running untrusted HTML.** RSS content is untrusted. Obsidian is Electron with
  Node access, so feed text must **never** be inserted as HTML. Use text
  nodes or `textContent` only. (Details under Security.)
- **Locking data into the plugin.** Bills and today's tasks must stay readable,
  hand-editable markdown, so they survive if the plugin is removed.
- **A generic look.** If it looks like a default Bootstrap dashboard rather than
  Glance in Salamander colors, it has missed.

## Environment & constraints

| Thing | Value |
|---|---|
| Obsidian | 1.14.5 (Arch package), Linux desktop |
| Vault | `/home/jason/Documents/Obsidian Vault` (synced with Obsidian LiveSync to a CouchDB on voidberry; also Remotely Save installed) |
| Theme | Salamander 2.0.0 (`~/obsidian-salamander`), presets via Style Settings |
| Homepage plugin | `homepage` 4.6.0, currently opens `notepad..md` on startup, "Replace all open notes" |
| Calendar plugin | `calendar` 1.5.10 (Liam Cain), installed and enabled |
| Daily notes (core) | format `YYYY.MM.DD`, folder `DAILY`, template `Templates/Daily Note`. **Neither the folder nor the template exists yet.** |
| Also installed & enabled | Omnisearch (used by the Search button), Iconic, Icon Folder, File Color, Colored Tags, PDF++, Editing Toolbar, File Order, View Mode by Frontmatter, Claude Sidebar |
| Not installed | Dataview, Tasks, and any templating plugin |
| Existing snippet | `.obsidian/snippets/dashboard.css` (enabled, `.db-*` classes, an earlier attempt at this). Unused by this design and left alone. |
| Node | v26, npm 12 |
| Location | Roanoke, Virginia, US (≈ 37.27, -79.94), imperial units |

The vault also runs on Jason's phone through LiveSync, presumably.
**Desktop is the target**, but the page must not throw errors on mobile. Under
about 900px wide it should collapse to a single column.

## How it gets built (decided: Claude's call, Jason approved)

- **A custom Obsidian plugin**, id `salamander-home`, written in TypeScript
  with the standard esbuild plugin template. Its own repo at
  `~/obsidian-salamander-home`, separate from the theme repo so the theme stays
  valid for the community theme listing.
- The plugin registers a **markdown code-block processor**, `salamander-home`.
  The homepage is a normal note (`Home.md` at the vault root) whose body is just
  that code block. In Jason's vault, the existing **Homepage plugin is
  repointed** from `notepad..md` to `Home.md` as the final install step.
  `notepad..md` is not modified.
- **Data comes straight from the sources**, not through Glance (Glance has no
  data API, and embedding its page would mean Glance's layout and needing
  Tailscale). All HTTP goes through Obsidian's `requestUrl`, which avoids CORS.
- **Styling ships in the plugin's `styles.css`** and uses Salamander's custom
  properties, each with a fallback to a standard Obsidian variable, so it
  follows Salamander's presets and still looks reasonable under other themes.
  For example: `var(--salamander-secondary, var(--color-green))`.
- Class prefix `sh-` to avoid clashing with the existing `.db-*` snippet.

## Built as a community plugin (decided: Jason)

Jason wants it built **as if it will be submitted to the Obsidian community
plugin list** ("someone may enjoy it"). His own setup is just one user's
configuration. Concretely:

- **No personal values in code.** Roanoke, his feeds and tickers, the Glance
  address, `DAILY/` and his button list live only in *his* `Home Config.md`.
  Shipped defaults are neutral:
  - a few widely known example feeds (for example BBC World and Hacker News)
  - a few index tickers (for example `^GSPC`, `^DJI`, `BTC-USD`)
  - **no weather location**: the weather panel shows a "set your location" hint
    until one is configured
  - buttons limited to built-ins and core commands: Capture, Daily, core Search, Bills.
- **Weather location** is set by place name, geocoded once through the
  Open-Meteo geocoding API, or by lat/lon. Units are configurable
  (imperial/metric), and the 12/24-hour clock follows the system locale.
- **Daily-note paths come from Obsidian's own Daily Notes settings** (folder,
  format, template) rather than being hardcoded, so any vault works. If the core
  Daily Notes plugin is off, the Today box and calendar dots explain that
  instead of guessing.
- **No files appear without being asked for.** A command, "Salamander Home:
  Create homepage", creates `Home.md`, `Home Config.md` (with the defaults) and
  `Bills.md` when asked. The paths of the config and bills notes are plugin
  settings, with those defaults. Pointing a homepage plugin at `Home.md` stays
  the user's choice. The README explains how to do it with the Homepage plugin.
- **The Salamander theme is optional.** It looks best under Salamander and must
  look fine under the default theme (already required by the variable
  fallbacks above).
- **Submission hygiene:**
  - `manifest.json` with `isDesktopOnly: false`, `versions.json`, and an MIT license.
  - Passes `eslint-plugin-obsidianmd`.
  - A GitHub Actions release workflow that attaches `main.js`, `manifest.json` and `styles.css`.
  - A README with screenshots that **discloses the network use**, as the
    community guidelines require: which hosts it contacts and why, with no
    telemetry.
- **Jason's own install is the last step**: copy his feeds and tickers from
  `glance.yml` into his `Home Config.md`, set Roanoke, add his Glance and
  Clippings buttons, and repoint his Homepage plugin. This happens only with his
  go-ahead.

## Data sources

| Panel | Source | Notes |
|---|---|---|
| News | The RSS URLs in Jason's `glance.yml`, four groups: **Top Stories** (horizontal cards, 16 items), **Business & Markets**, **Politics & Analysis**, **NFL & Cowboys** (detailed lists). Per-feed limits as in Glance. | Parse with `DOMParser`. Handle RSS 2.0 and Atom. Merge each group's feeds and sort newest first. Thumbnail from `media:content`, `media:thumbnail`, `enclosure`, or the first `<img>` in the description (URL only, never the HTML). Fall back to the striped placeholder seen in the mockup. Google News feeds have no images, which is expected. |
| Markets | Yahoo Finance chart endpoint (`query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1mo&interval=1d`), the same one Glance uses. Groups: **Macro**, **Crypto**, **Bellwethers** with the symbols and display names from `glance.yml`. | Each row: symbol, name, 1-month sparkline, % change (green or red), price, as in Glance. |
| Weather | Open-Meteo forecast API (no key), `temperature_unit=fahrenheit`, `timezone=auto`. AQI from the Open-Meteo air-quality API (`us_aqi`). | Now: condition, temp, feels-like, AQI. Hourly temperature bars for today with the current hour highlighted. 7-day low/high range bars plus precipitation chance. Sunrise, sunset and day length. Moon phase and illumination **calculated locally** (no API). Banner line: "☀ 50° now · Tomorrow H63 L44 · 0% rain". |
| Today | The vault: today's daily note (path from the core Daily Notes settings) | See "Today box". |
| Bills | The vault: `Bills.md` | See "Bills". |
| Calendar | The vault: daily-note filenames plus bill due dates | See "Calendar". |

**Feed and ticker config lives in a vault note**, `Home Config.md`, as one
fenced `yaml` block. The builder copies it once from `glance.yml` (RSS groups and
market groups only). It also holds the weather location and the button list.
The plugin re-reads it when the note changes. If the YAML is invalid, keep the
last good config and show a one-line error at the top of the page.

## Caching & refresh

- Every remote result is cached in memory and **saved per device with
  `app.saveLocalStorage` / `app.loadLocalStorage`**, so the page draws
  immediately from the last data on startup or when reopened, then refreshes
  in the background. *(Claude's call. The cache deliberately stays out of
  `data.json`, which sits under `.obsidian/plugins/` and may be synced by
  LiveSync or Remotely Save. Rewriting a synced file every few minutes would
  cause constant sync traffic and conflicts between devices.)* `data.json`
  holds nothing that changes often.
- Refresh intervals: news 15 min (20 min for Politics and NFL, as in Glance),
  markets 5 min, weather 15 min. Refresh only while the homepage is open.
- Stale data is shown with a small, faint "updated 2h ago". A failed panel keeps
  its last data and adds a faint "offline". With no data at all, it shows one
  muted line. No modal dialogs or toasts.

## Banner

- `// FRIDAY, OCTOBER 30`: weekday in normal text, month and day in the accent
  color. Uppercase, heading font.
- Sub-line: `Week 44 · day 303 ·` then links (today's daily note, Clippings),
  then the weather summary line.
- **Buttons**, from `Home Config.md`. Each button is `{label, icon?, action}`,
  and an action is one of: run an Obsidian command by id, open a vault file,
  open a URL, or a built-in (`add-bill`, `add-today`). The shipped defaults are
  in "Built as a community plugin". **Jason's own set**, which goes in his
  `Home Config.md`:
  - **+ Capture**: built-in `add-today` (quick prompt that appends a task to today's note). Styled as the primary button.
  - **Daily**: open or create today's daily note.
  - **Search**: Omnisearch's vault search command. If a configured command id
    doesn't exist (for example, the plugin was later removed), fall back to core
    search for Search and show a faint "command not found" note for anything
    else.
  - **Bills**: built-in `add-bill`.
  - **Clippings**: open the `Clippings` folder in the file explorer.
  - **Glance ↗**: open `http://100.119.142.70:3000` in the browser.

## Today box

- Daily notes are found through the core Daily Notes settings. For Jason that
  means `DAILY/YYYY.MM.DD.md`.
- Shows unchecked `- [ ]` items from **today's daily note**, plus unchecked items
  from the **previous 7 days' daily notes**, dimmed and labeled with their date,
  so a forgotten item doesn't silently vanish overnight. *(Claude's call.)*
- Ticking an item on the homepage changes `- [ ]` to `- [x]` in the source note,
  using `app.vault.process` so it can't clobber an edit LiveSync makes at the
  same moment.
- "+ add" (and the **Capture** button) opens a one-line prompt and appends
  `- [ ] text` to today's note. If the note doesn't exist, create it at the
  configured daily-note path (creating the folder if needed), using the
  configured template if that file exists, otherwise an empty note. Jason's
  configured template, `Templates/Daily Note`, doesn't exist yet.

## Bills

- **Storage:** `Bills.md` at the vault root, one bill per line:
  `- [ ] Electric · $142.18 · due 2026-11-03`
  The amount is optional (`- [ ] Rent · due 2026-11-01`). Ticked (`- [x]`) means
  paid. Paid lines stay in the file as history. Lines that don't parse are
  ignored on the homepage but never deleted.
- **Adding:** the **Bills** button opens a small modal with name, amount
  (optional) and due date, which appends a correctly formatted line. Jason can
  also type into the note directly.
- **Panel:** unpaid bills sorted by due date. **Red** with "Nd late" if
  overdue, **ochre** if due within 3 days, plain otherwise. Ticking a bill on
  the panel marks it paid in `Bills.md` (same `vault.process` rule) and
  removes it from the panel. Clicking a bill's name opens `Bills.md`.

## Calendar

- A month grid in the right column with prev/next arrows, Glance-style.
- Today is filled with the accent color. Days that have a daily note get a small
  dot. Days with an unpaid bill due get an ochre underline.
- Clicking a day opens that day's daily note. If it doesn't exist, ask before
  creating it, matching the Calendar plugin's `shouldConfirmBeforeCreate: true`.
- Week start follows the system locale, matching the Calendar plugin.

## Security

- **All feed-supplied strings** (titles, descriptions, source names) go
  into the DOM as **text only** (`createEl(..., { text })` or `textContent`).
  Never use `innerHTML`, `insertAdjacentHTML`, or `MarkdownRenderer` on feed
  content. Descriptions are reduced to plain text by parsing in a detached
  `DOMParser` document and reading `textContent`, then truncated.
- Article links open in the system browser and only allow `http:` and `https:`
  URLs. Image `src` likewise only allows `http:` and `https:`.
- No API keys or secrets are needed or stored. Nothing is sent anywhere except
  the GET requests to the sources above, plus **image loads for news
  thumbnails**, which come from whatever host each feed points to. That is
  accepted: the cards are meant to show images.
- **Getting the feed list:** the builder needs ssh access to `voidberry` to copy
  the `rss` and `markets` sections of `glance.yml` into `Home Config.md`. That
  is a scheduled step, and none of the rest of that file is copied.

## Left to the builder

- Internal module structure, how the plugin's code is organised, and test tooling.
  Pure logic (bill-line parsing, task extraction, RSS and Atom parsing, moon
  phase, date maths) should be unit-tested. Rendering is checked by hand.
- Exact pixel sizes, spacing and icons (Obsidian's Lucide icons are fine).
  Match the density of `layout-v2.html`.
- Collapse thresholds per news group (the Glance values are a good start).
- How to do manual testing. **Use a throwaway test vault, not Jason's real
  vault**, until the final install step. Installing into the real vault and
  repointing the Homepage plugin is the last step and needs Jason's go-ahead.

## Reference artifacts

- Mockups in `docs/superpowers/specs/mockups/`: `layout.html` (options A and B)
  and `layout-v2.html` (**the agreed combination**). These are HTML fragments
  that rely on the brainstorm server's frame. Their inline `.sal` styles hold
  the intended look.
- Glance config: `ssh voidberry cat /home/jason/glance/glance.yml`
  (contains a Pi-hole password, so copy only the `rss` and `markets` sections).
- Salamander tokens: `~/obsidian-salamander/theme.css`. Key variables:
  `--color-accent`, `--color-accent-1`, `--salamander-secondary`,
  `--salamander-tertiary`, `--salamander-success`, `--salamander-danger`,
  `--color-base-00…100`, `--salamander-glow`.
