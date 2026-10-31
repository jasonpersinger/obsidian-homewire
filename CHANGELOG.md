# Changelog

## 0.5.1

- Bills typed by hand: the amount is now recognised without a `$` sign (`Gas · 40 · due …`) or with a space after it (`$ 40`).
- Bills with impossible due dates (like `2026-13-45`) are skipped instead of showing "Invalid Date".
- Checkboxes inside code blocks and frontmatter no longer show up in Today or Bills.
- Release notes now come from this changelog.

## 0.5.0

- **Radio.** Play an internet radio station from the left column. AzuraCast stations show album art, artist and title, a progress bar, what's up next, the listener count and a LIVE badge; any other stream gets a play button. Music keeps playing while you open other notes.
- Volume slider and mute, remembered per device. (Hidden on iPhone and iPad, where iOS only allows the hardware buttons.)

## 0.4.1

- New [setup guide](docs/configuration.md): finding feeds, the Google News trick, market symbols, weather, buttons and command IDs, ready-made setups and troubleshooting.
- Buttons that point at a folder now show it in the file explorer; buttons pointing at a missing note show a notice instead of creating an empty one.

## 0.4.0

- **The wire.** A rotating one-line headline ticker in the middle of the banner, drawing from all your news groups. Hover to pause, click to read.
- A faint summary line under it: open tasks · next bill · sunset.

## 0.3.0

- Large clock and US market session in the banner (pre-market, open, after hours, closed), with NYSE holidays and early closes.
- The calendar keeps the month you've paged to when the page redraws.

## 0.2.3

- The empty properties block above the homepage is hidden in editing mode too.

## 0.2.2

- Clippings are read from their folder only, not by listing the whole vault.
- Releases carry build provenance attestations and release notes.

## 0.2.1

- Clearer plugin description.

## 0.2.0

- Fear & Greed gauge in the banner (optional).
- Recent clippings panel for Obsidian Web Clipper saves.

## 0.1.0

- First release: date and weather banner, buttons, news, markets, detailed weather, Today box, bills and calendar.
