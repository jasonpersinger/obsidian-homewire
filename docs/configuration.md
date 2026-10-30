# Setting up Homewire

This guide walks through everything you can change on your Homewire page: news feeds, market tickers, weather, buttons and the banner. You don't need to know how to code. You'll be editing one note, and every example below has been tested.

- [How the config note works](#how-the-config-note-works)
- [News feeds](#news-feeds)
- [Markets](#markets)
- [Weather](#weather)
- [Buttons](#buttons)
- [Banner](#banner)
- [Recent clippings](#recent-clippings)
- [Ready-made setups](#ready-made-setups)
- [Troubleshooting](#troubleshooting)

---

## How the config note works

Everything lives in one note, **`Home Config.md`** (you can rename it in **Settings → Homewire**). If you don't have it yet, run the command **Homewire: Create homepage**.

Inside the note is a block that starts with ` ```yaml ` and ends with ` ``` `. Homewire only reads what's inside that block. You can write anything you like above or below it.

**When you save, the page updates.** No reload needed.

### Five YAML rules that prevent most problems

YAML is the format the settings are written in. It's picky about a few things:

1. **Indentation matters, and it must be spaces, not tabs.** Things that belong together line up. A setting that belongs to `weather:` is indented under it:
   ```yaml
   weather:
     units: imperial
   ```
2. **List items start with a dash** (`- `), lined up with each other.
3. **Put quotes around anything with special characters**, especially `^`, `:`, `#`, `{`, `[`, `&`, `*`, `!` or `?`. URLs and market symbols are the usual suspects:
   ```yaml
   - { symbol: "^GSPC", name: S&P 500 }
   - { title: AP, url: "https://news.google.com/rss/search?q=site:apnews.com" }
   ```
   When in doubt, quote it. Quotes never hurt.
4. **`#` starts a comment.** Everything after it on that line is ignored, which is handy for notes to yourself (and for switching something off without deleting it).
5. **Short and long forms mean the same thing.** These two are identical:
   ```yaml
   - { title: BBC World, url: "https://feeds.bbci.co.uk/news/world/rss.xml" }

   - title: BBC World
     url: "https://feeds.bbci.co.uk/news/world/rss.xml"
   ```

If you make a mistake, Homewire **keeps using your last working config** and shows a one-line error at the top of the page, naming the setting that's wrong (for example `Config: news[0].feeds[1].url must be a non-empty string`). The numbers count from zero: `news[0]` is your first news group, `feeds[1]` is its second feed.

---

## News feeds

News is organized into **groups**. Each group is one section on the page (like "Top Stories" or "Business & Markets") and can pull from several feeds at once. Homewire mixes a group's feeds together and shows the newest stories first.

```yaml
news:
  - title: Top Stories          # the section heading on the page
    style: cards                # cards (with pictures) or list (default: list)
    limit: 12                   # most stories to show in this group (default: 14)
    collapseAfter: 6            # show this many, hide the rest behind "Show more" (default: 6)
    cacheMinutes: 15            # how often to check for new stories (default: 15, minimum 1)
    feeds:
      - { title: BBC World, url: "https://feeds.bbci.co.uk/news/world/rss.xml", limit: 6 }
      - { title: NPR, url: "https://feeds.npr.org/1001/rss.xml", limit: 6 }
```

Each feed has:

- **`title`**: the source name shown next to each story ("12m · BBC World"). Call it anything.
- **`url`**: the feed's address (see below for how to find it).
- **`limit`** (optional): the most stories to take from *this* feed.

### How the two limits work together

Each feed contributes up to its own `limit` stories. Then the group mixes them, newest first, and keeps up to the group's `limit`.

In the example above, BBC and NPR give up to 6 stories each, the group keeps the newest 12, and the page shows 6 with "Show 6 more" underneath. Per-feed limits stop one busy source from crowding out the others. Leave them out and every feed can contribute up to the group's `limit`.

### Cards or list?

- **`cards`** shows stories as a row of picture cards you can scroll sideways. Use it for feeds that include images (BBC, NYT, NPR, The Verge, Ars Technica). Stories without a picture get a plain striped placeholder.
- **`list`** shows a headline, source, age and a two-line summary. Use it for feeds without images (Hacker News, ESPN, anything from Google News), or whenever you want to scan quickly.

### Finding a site's feed

Most news sites have an RSS or Atom feed even if they don't advertise it. Either format works. Ways to find one:

1. **Look for the feed icon** (an orange square with radio waves) or a link labeled "RSS" or "Feeds", usually in the site's footer.
2. **Try common addresses** by adding these to the site's main address: `/feed`, `/rss`, `/rss.xml`, `/feed.xml`, `/index.xml`, `/atom.xml`. If your browser shows a page of code-like text starting with `<rss` or `<feed`, that's it.
3. **Search the page's source.** In your browser, choose "View page source" and search for `rss` or `atom`. Feed links often appear in the first few lines.
4. **Search the web** for "*site name* RSS feed".

Some sources have feeds in a predictable spot:

| Source | Feed address |
|---|---|
| A subreddit | `https://www.reddit.com/r/SUBREDDIT/.rss` |
| A YouTube channel | `https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID` (the ID starts with `UC`, and appears in the channel's page source as `channel_id`) |
| A WordPress site | usually `https://example.com/feed` |
| A Substack newsletter | `https://NAME.substack.com/feed` |

### Sites with no feed: the Google News trick

Some big outlets (AP, Reuters, WSJ) have dropped their public feeds. Google News can build one for you from a search:

```
https://news.google.com/rss/search?q=SEARCH&hl=en-US&gl=US&ceid=US:en
```

Replace `SEARCH` with what you want, using `+` instead of spaces:

| You want | `q=` part |
|---|---|
| Everything from one site, last day | `site:apnews.com+when:1d` |
| An exact phrase, last 2 days | `%22Dallas+Cowboys%22+when:2d` (`%22` is a quote mark) |
| A topic from one site | `site:reuters.com+electric+vehicles` |
| Either of two words | `bitcoin+OR+ethereum` |

`when:1d` keeps it to the last day (`when:7d` for a week). Without it you'll get older stories too.

Ready-to-use examples:

```yaml
- { title: AP, url: "https://news.google.com/rss/search?q=site:apnews.com+when:1d&hl=en-US&gl=US&ceid=US:en", limit: 4 }
- { title: Reuters, url: "https://news.google.com/rss/search?q=site:reuters.com+when:1d&hl=en-US&gl=US&ceid=US:en", limit: 4 }
- { title: Cowboys, url: "https://news.google.com/rss/search?q=%22Dallas+Cowboys%22+when:2d&hl=en-US&gl=US&ceid=US:en", limit: 4 }
```

Google News feeds return up to 100 results each, so **always give them a `limit`**. They also have no pictures, so they look best in a `list` group.

### Tested feeds

All of these were checked to work with Homewire:

| Source | URL | Pictures |
|---|---|---|
| BBC World | `https://feeds.bbci.co.uk/news/world/rss.xml` | yes |
| New York Times | `https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml` | yes |
| NPR News | `https://feeds.npr.org/1001/rss.xml` | yes |
| The Verge | `https://www.theverge.com/rss/index.xml` | yes |
| Ars Technica | `https://feeds.arstechnica.com/arstechnica/index` | yes |
| MarketWatch | `https://feeds.content.dowjones.io/public/rss/mw_topstories` | yes |
| Bloomberg Markets | `https://www.bloomberg.com/feeds/markets/news.rss` | no |
| Hacker News | `https://hnrss.org/frontpage` | no |
| ESPN NFL | `https://www.espn.com/espn/rss/nfl/news` | no |
| r/ObsidianMD | `https://www.reddit.com/r/ObsidianMD/.rss` | some |

---

## Markets

Market panels work like news groups: each group is a section with a list of symbols.

```yaml
markets:
  - title: Macro
    collapseAfter: 6            # show this many rows, the rest behind "Show more" (default: 6)
    markets:
      - { symbol: "^GSPC", name: S&P 500 }
      - { symbol: "^DJI", name: Dow }
      - { symbol: "GC=F", name: Gold }
  - title: Crypto
    markets:
      - { symbol: BTC-USD, name: Bitcoin }
```

- **`symbol`** is the ticker exactly as Yahoo Finance writes it (see below).
- **`name`** is the friendly label shown under the symbol. Call it anything.

Each row shows a one-month sparkline, the latest price, and the change since the previous trading day's close (green up, red down). Prices refresh every 5 minutes while the page is open.

### Symbol formats

Homewire uses Yahoo Finance symbols, which follow these patterns:

| Kind | Format | Examples |
|---|---|---|
| US stocks and ETFs | plain ticker | `AAPL`, `MSFT`, `SPY`, `QQQ` |
| Indexes | starts with `^` | `^GSPC` (S&P 500), `^DJI` (Dow), `^IXIC` (Nasdaq), `^RUT` (Russell 2000), `^VIX` (volatility) |
| Treasury yields | starts with `^` | `^TNX` (10-year), `^FVX` (5-year), `^TYX` (30-year) |
| Futures and commodities | ends with `=F` | `GC=F` (gold), `CL=F` (crude oil), `SI=F` (silver) |
| Crypto | coin `-` currency | `BTC-USD`, `ETH-USD` |
| Currencies | pair ends with `=X` | `EURUSD=X`, `GBPUSD=X`, `JPY=X` |
| Stocks on other exchanges | ticker `.` exchange | `SHOP.TO` (Toronto), `VOD.L` (London) |

**Always put quotes around symbols with `^` or `=`**, like `"^GSPC"` and `"GC=F"`.

Prices are shown in the market's own currency. London stocks are quoted in **pence**, so `VOD.L` showing `119.10` means £1.19.

### Finding a symbol

Go to [finance.yahoo.com](https://finance.yahoo.com), search for the company, index or coin, and use the symbol shown next to its name (it's also in the page's web address). If Homewire shows **`—`** for a row, Yahoo didn't recognize the symbol. Double-check the spelling and the suffix.

---

## Weather

```yaml
weather:
  units: imperial              # imperial (°F) or metric (°C)
  place: Paris, France         # a place name, looked up once
  # lat: 48.8566               # or exact coordinates (both needed)
  # lon: 2.3522
```

You can give a **place name** or **coordinates**. If you give both, coordinates win.

### Place names

Homewire looks the name up once and remembers the result. Write it as **town, then the full state, region or country**:

- ✅ `Springfield, Illinois`, `Paris, France`, `Portland, Oregon, US`
- ⚠️ `Springfield, IL`: state abbreviations aren't matched, so this quietly picks the first Springfield in the list (which is in Missouri)
- ⚠️ `Springfield` on its own: same thing, you get whichever Springfield comes first

The weather panel's heading shows the place it actually found ("Weather · Springfield, Illinois"), so check it after setting a place. If it's wrong, use coordinates.

### Coordinates

Coordinates are exact and never ambiguous. To get yours, right-click your location in Google Maps (or long-press on a phone) and the first item in the menu is the latitude and longitude, like `37.2694, -79.9548`. The first number is `lat` and the second is `lon`. West longitudes and south latitudes are negative.

---

## Buttons

Buttons appear under the date in the banner. Each needs a **label** and **one action**:

```yaml
buttons:
  - label: "+ Capture"
    primary: true                              # optional: highlights it in the accent colour
    icon: plus                                 # optional: any icon name from lucide.dev
    action: { builtin: add-today }
  - label: Notepad
    action: { file: "Notepad.md" }
  - label: Search
    action: { command: "global-search:open" }
  - label: Weather.gov
    action: { url: "https://www.weather.gov" }
```

### The four kinds of action

| Action | What it does | Example |
|---|---|---|
| `{ builtin: add-today }` | Pops up a box to add a task to today's daily note | |
| `{ builtin: add-bill }` | Pops up the add-bill form | |
| `{ builtin: open-daily }` | Opens today's daily note (creating it if needed) | |
| `{ file: "…" }` | Opens a note, or shows a folder in the file explorer | `"Notepad.md"`, `"Projects/Plan.md"`, `"Clippings"` |
| `{ url: "…" }` | Opens a web page in your browser (`http` or `https` only) | `"https://www.weather.gov"` |
| `{ command: "…" }` | Runs any Obsidian command, by its ID | `"graph:open"` |

**File buttons** use the note's path inside your vault, with folders separated by `/`. The `.md` can be left off. A name that matches a folder shows that folder in the file explorer. If nothing matches, Homewire tells you instead of creating a new note.

### Finding a command ID

Obsidian doesn't show command IDs anywhere in its settings. Some useful ones:

| Command | ID |
|---|---|
| Search the vault | `global-search:open` |
| Quick switcher (jump to a note) | `switcher:open` |
| Open the graph view | `graph:open` |
| Command palette | `command-palette:open` |
| Open settings | `app:open-settings` |
| New tab | `workspace:new-tab` |
| Open today's daily note | `daily-notes` |
| Omnisearch (if installed) | `omnisearch:show-modal` |

To find any other ID, on desktop:

1. Press **Ctrl+Shift+I** (**Cmd+Option+I** on a Mac) to open the developer tools, and click the **Console** tab.
2. Paste this and press Enter, changing `search` to a word from the command you want:
   ```js
   Object.keys(app.commands.commands).filter(id => id.includes("search"))
   ```
3. Copy the ID you want (without the quotes) into your config.

Command IDs from community plugins start with the plugin's ID, like `omnisearch:…`. If a button's command doesn't exist (for example, because the plugin was uninstalled), Homewire shows "Command not found". Search buttons fall back to Obsidian's built-in search.

---

## Banner

The banner's extras can each be switched on or off:

```yaml
banner:
  clock: true            # large clock (default: on)
  marketSession: true    # US market status: pre-market / open / after hours / closed (default: on)
  wire: true             # rotating headline from all your news groups (default: on)
  summary: true          # one line: open tasks · next bill · sunset (default: on)
  fearGreed: false       # CNN Fear & Greed index (default: off)
```

- **Market session** is always worked out in New York time, so it's right wherever you live. It knows the NYSE holidays and the 1pm early closes.
- **The wire** rotates through the 20 newest stories across all your news groups every 8 seconds. Hover to pause it, and click a headline to open it.
- **Fear & Greed** comes from an unofficial CNN source, which is why it's off by default. If CNN changes it, the gauge shows "unavailable" and the rest of the page carries on.

---

## Recent clippings

Shows the newest notes saved by [Obsidian Web Clipper](https://obsidian.md/clipper).

```yaml
clippings:
  folder: Clippings      # Web Clipper's default folder
  limit: 5
```

If you've set Web Clipper to save somewhere else, put that folder here. To hide the panel completely, write `clippings: false`.

---

## Ready-made setups

Paste any of these in place of your `news:` section (or add the groups to it). Every feed was tested.

### World news

```yaml
news:
  - title: Top Stories
    style: cards
    limit: 12
    feeds:
      - { title: BBC World, url: "https://feeds.bbci.co.uk/news/world/rss.xml", limit: 4 }
      - { title: NYT, url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", limit: 4 }
      - { title: NPR, url: "https://feeds.npr.org/1001/rss.xml", limit: 4 }
  - title: Wires
    limit: 12
    feeds:
      - { title: AP, url: "https://news.google.com/rss/search?q=site:apnews.com+when:1d&hl=en-US&gl=US&ceid=US:en", limit: 6 }
      - { title: Reuters, url: "https://news.google.com/rss/search?q=site:reuters.com+when:1d&hl=en-US&gl=US&ceid=US:en", limit: 6 }
```

### Tech

```yaml
news:
  - title: Tech
    style: cards
    limit: 10
    feeds:
      - { title: The Verge, url: "https://www.theverge.com/rss/index.xml", limit: 5 }
      - { title: Ars Technica, url: "https://feeds.arstechnica.com/arstechnica/index", limit: 5 }
  - title: Hacker News
    limit: 10
    feeds:
      - { title: HN, url: "https://hnrss.org/frontpage" }
```

### Finance

```yaml
news:
  - title: Markets
    limit: 12
    feeds:
      - { title: MarketWatch, url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", limit: 6 }
      - { title: Bloomberg, url: "https://www.bloomberg.com/feeds/markets/news.rss", limit: 6 }

markets:
  - title: Indexes
    markets:
      - { symbol: "^GSPC", name: S&P 500 }
      - { symbol: "^DJI", name: Dow }
      - { symbol: "^IXIC", name: Nasdaq }
      - { symbol: "^VIX", name: VIX }
      - { symbol: "^TNX", name: 10Y Yield }
  - title: Commodities & FX
    markets:
      - { symbol: "GC=F", name: Gold }
      - { symbol: "CL=F", name: Crude Oil }
      - { symbol: "EURUSD=X", name: EUR/USD }
  - title: Crypto
    markets:
      - { symbol: BTC-USD, name: Bitcoin }
      - { symbol: ETH-USD, name: Ethereum }
```

### Sports (NFL example)

```yaml
news:
  - title: NFL
    limit: 12
    cacheMinutes: 20
    feeds:
      - { title: ESPN, url: "https://www.espn.com/espn/rss/nfl/news", limit: 6 }
      - { title: Cowboys, url: "https://news.google.com/rss/search?q=%22Dallas+Cowboys%22+when:2d&hl=en-US&gl=US&ceid=US:en", limit: 6 }
```

Swap "Dallas Cowboys" for your team.

---

## Troubleshooting

**A news group says "offline".** The last check failed, so Homewire is showing what it had before. It tries again on its own. Common causes: no internet, or the site briefly blocking requests.

**A news group says "unavailable (HTTP 403)" or "(HTTP 404)".** Every feed in that group failed and there's nothing saved to show. 404 usually means the feed address is wrong or has moved. 403 means the site refuses non-browser requests (try the Google News trick for that site instead). Open the URL in your browser: if you see a normal web page instead of code-like text, it isn't a feed.

**A group shows fewer stories than expected.** Check the per-feed `limit`s, and whether one feed failed (the others still show).

**A market row shows `—`.** Yahoo didn't recognize that symbol. Check it on finance.yahoo.com.

**The weather is for the wrong town.** Use the full state or country name (`Springfield, Illinois`), or switch to coordinates.

**A red or grey line at the top of the page starts with "Config:".** There's a mistake in the YAML. The message names the setting, and the page keeps working with your last good config. The usual causes are tabs instead of spaces, a missing space after a dash or colon, or a URL or `^` symbol without quotes.

**I changed a feed and nothing happened.** Make sure the note saved. Changes to a group's feeds take effect right away, but if only the timing changed, run **Homewire: Refresh homepage** to fetch immediately.

**Something else.** Open an issue at [github.com/jasonpersinger/obsidian-homewire/issues](https://github.com/jasonpersinger/obsidian-homewire/issues) and include the error line from the top of the page, if there is one.
