# Changes – Depot-Kompass

All versions are **alpha** (test phase). Newest first.

## 0.64 – 18 Nov 2026 – earnings results & notification history
- **📊 Earnings result as a notification:** on the earnings day and up to 4 days after, the app checks whether the results are out and reports earnings per share against the estimate, e.g. "Results are out: EPS 2.61 · expected 2.49 · beat (+4.8 %)". Applies to holdings and watchlist values with an earnings date; own switch "Earnings result".
- **🕘 Notification history:** under ⚙️ → More → 🔔 you find every alert of the last 90 days, including dismissed ones – with time, value and text. Plus a **check log**: when Android last checked, how many values and how many alerts. Stored encrypted on the phone only, with "Delete history".
- **Check more often:** interval now from **1 hour** (previously from 6). New: **move since the last check** (e.g. from 3 %) – in addition to the move since the previous close. Honest note stays: Android decides the exact time itself.
- **Watchlist earnings in the calendar:** dates and results of watchlist values now appear in the calendar marked "Watchlist" (previously only holdings); tap to see the result.
- Not included yet: summary of the earnings call (needs a source for the transcript – being checked).

## 0.63 – 17 Nov 2026 – security update
- **Lock screen:** notifications no longer show any content on a locked phone (no names, prices or marks) – only "New notice – unlock to view".
- **Stronger passwords:** backup password now at least 14 characters, sharing a portfolio at least 12 – with letters and numbers, no repetitions. The ZIP export requires a backup password of at least 14 characters because the ZIP format derives its key only weakly.
- **Crafted files:** files over 50 MB are not read; overlong lines and fields in CSV files are truncated (a crafted file could previously freeze the app for seconds); PDFs have a total decompression limit.
- **CSV export:** text that would run as a formula in Excel/LibreOffice (=, +, -, @) is neutralised.
- **Verified:** a new automated attack test injects HTML into every field (portfolios, securities, notes, watchlist, alerts, news, AI answers, physical assets) and checks every page – foreign text never turns into HTML. Plus a test with broken and crafted files.
- New: `SECURITY.md` – how to report vulnerabilities privately.

## 0.62 – 17 Nov 2026
- **🔔 Alerts as their own tab in the watchlist** (Watchlist → “🔔 Alerts”): any number of alerts per asset, each with its own name – e.g. “buy zone”, “stop”, “target 1”, “top-up 2”. Four types: **price falls below**, **price rises above**, **zone from–to** (notifies as soon as the price enters the zone) and **move in %** since set (e.g. −10 %). Assets from the watchlist and all your own portfolios can be chosen.
- The list shows price, distance (“−4.6 % to go”) and “reached” for each alert; each can be switched on and off. Every watchlist entry and every position lists its alerts with “+ Alert for this asset”.
- Previous buy/sell marks and “alert below/above” from 0.61 are turned into named alerts automatically; the old fields are gone.
- Notification with the alert's name (“🔔 Rheinmetall – buy zone”). Android still only checks every few hours; assets without a Yahoo ticker are only checked by the app.
- **Share and paste alerts** as plain text (deliberately unencrypted, only asset, ticker, name and price marks – no amounts): “📤 Share all” or single in the alert, “📥 Paste alerts” in the tab. One line per alert, e.g. `Bitcoin | BTC-EUR | Kaufzone | zone 54.000 bis 56.000`. Missing assets are added to the watchlist automatically, duplicates are detected.
- Credits: “no Google Play services, no trackers – Google News and Gemini only on request” (previously the misleading “no Google services”).

## 0.61 – 17 Nov 2026
- **🔔 Price alerts as notifications:** buy and sell marks from the watchlist now also notify you on your phone when the price reaches them – not only the next time you open the app. New on every position: **alert below / alert above** (e.g. a stop, top-up or target mark). Prices in dollars, pounds etc. are converted to euros as in the app. Each mark notifies once and is armed again as soon as the price has left it.
- Separate switch “Price alerts (marks)” under ⚙️ → More → 🔔 Notifications. Honest note: Android only checks in the background every few hours – no second-by-second alarm like in a trading app.

## 0.60 – 17 Nov 2026
- **Notifications work again:** the new error log showed the cause – Android requires the permission "view network state" (ACCESS_NETWORK_STATE) for the background check "only with internet". It was missing; now it is declared (normal permission, no prompt, only reads "network yes/no").
- The error log recognises missing permissions as its own error code (DK-09).
- Position list: percentage, amount and "break-even" are cleanly separated again (they ran together with large fonts).

## 0.59 – 17 Nov 2026
- **Note from −35 %:** from about −35 % it takes more than +54 % to get back to zero. The break-even card then explains that some people close the position and reopen if needed to limit the loss – with a note on offsetting losses. No recommendation.
- **Credits: new section "💡 Inspiration"** – thanks to r/mauerstrassenwetten and Claude (Anthropic) as source of inspiration and coding helper.
- **🐞 Error log** (More → Error log): collects technical errors – notifications, crashes, script errors, error messages –, groups identical errors, shows error codes (DK-01 … DK-99) with known causes and sends them by e-mail on request – you see the mail first. Runs fully locally, no amounts (numbers are replaced by #), stays on your phone until you share it.
- **Notifications after "Refresh":** the background check was re-registered with Android on every save – Android limits that. Now only when something changes; a rejection by Android is detected and logged.
- **Desktop version (Docker):** now shows the same version number as the app automatically; step-by-step guide for Windows and macOS.

## 0.58 – 17 Nov 2026
- **German tax dates in the calendar** (no guarantee, can be switched off in settings): advance lump sum in early January, tax return deadline 31 July, check tax exemption order 1 Dec, request loss certificate by 15 Dec.
- **Note for large losses:** from −50 % the break-even card explains that realised losses can be offset against gains for tax purposes – calculation and note only, no recommendation.
- **Notifications:** if setup fails, the app now shows the reason. A damaged key in Android's key store is recreated automatically. New button "Open Android settings" if the phone blocks notifications, and a note if the background check is not scheduled.

## 0.57 – 17 Nov 2026
- **Leverage calculator shows the real knock-out:** at 10× the liquidation is not 10 % away but closer because of maintenance margin and fees (about 7.6–7.7 % on Kraken Futures). The calculator deducts both and shows "−7.59 % instead of −10 %". Profit and loss at stop and target are now after fees.
- **Choose your broker:** Kraken Futures (EU), Hyperliquid, knock-out certificate (Trade Republic, Scalable, Smartbroker …) or custom values for maintenance margin and fee. Warning if a leverage would eat the whole stake right away.

## 0.56 – 17 Nov 2026
- The average-down calculator is now called **"Buy in tranches"** – for a relaxed average price. All texts, buttons and explanations adjusted.

## 0.55 – 17 Nov 2026
- **Break-even always visible:** every position in the list shows "to break-even +X %" (in the red) or "buffer −X %" (in profit), after fees. Inside the position: its own figure plus a worked example – what it takes to get back to zero (with target price), or what a 20 % pullback means for you – and the table "loss and required rise" (−50 % needs +100 %). Only arithmetic, no recommendation.
- **Better search:** ISIN and WKN are now resolved via Onvista and end up at the Xetra or Frankfurt listing in euros – previously often London/Milan in dollars or pounds. Xetra-Gold, iShares Core DAX, ETCs (via Stuttgart) and stocks by WKN are now found. The watchlist results show the euro listing first; wrong hits by WKN on foreign exchanges are excluded. Tested with 53 real ETFs, ETCs and stocks.
- **Crypto without a euro pair** (e.g. NEAR, HYPE, SUI) now gets a price via the dollar listing, converted to euros.

## 0.54 – 16 Nov 2026
- English: percentages in the calculator charts without a stray dot ("+100 %" instead of "+100. %").
- Store images and store texts brought up to date.

## 0.53 – 16 Nov 2026
- **Update button at the top:** "Update prices & data" now sits as 🔄 next to the settings button (⚙️) – reachable from every page. The button under Import stays.
- **Dollar in the calculators:** position size, average-down and take-profit can be switched to dollars. With the rate "1 € = … $" (remembered on "update prices" or entered by hand) the main figures are also shown in euros.
- **In short:** a fold-out explanation in each of the four calculators, a legend on the notes page and an explanation of buy and sell marks in the watchlist.

## 0.52 – 16 Nov 2026
- **Save calculator plans as notes:** position size, average-down and take-profit now have "save as note (with chart)". The note shows chart and figures and can be reopened with "open and edit in calculator".
- Position size and take profit show a chart with marks (entry, stop, target, or cost basis and selling steps).
- **Key status light:** after saving an API key the app checks it – 🟢 valid, 🔴 invalid or wrong row, 🟡 cannot be checked. Swapped keys are recognised by their format even without internet.

## 0.51 – 16 Nov 2026
- **Take profit by amount:** instead of a percentage you enter how many euros you want to take out. The calculator shows the number of units, the profit in it and what keeps running. Button "use cost basis as amount"; for stocks also the figure for whole units. Share in % is still possible.

## 0.50 – 16 Nov 2026
- **Position size calculator:** entry, stop and maximum loss (in € or % of capital) give the number of units and the position size. Table "same risk, different stop distance", reward-to-risk ratio, long/short, hint on the typical weekly move.
- **Take-profit calculator:** sell only a part, in up to four steps – proceeds and profit per step, rest, "cost basis back" and down to which price the rest is covered.
- **Average-down calculator:** new cost basis for a fixed budget, budget needed for a target cost basis, exit scenarios with break-even, "take out the cost basis" with a runner. Optional fees, warning for a disproportionately large top-up. Pure what-if – the saved position is never changed.

## 0.49 – 15 Nov 2026
- **Screenshot import for all brokers:** order screenshots from Scalable Capital, Smartbroker+, Revolut, Kraken, Bitvavo, OKX and others are recognised (buy/sell, name, ISIN, quantity, price, fee, amount, date) – offline, with a cross-check. Trade Republic as before.
- **Securities statements as PDF** (one statement per buy/sell): Scalable Capital (incl. savings plans), Smartbroker+ / DAB BNP Paribas (with taxes), Trade Republic, Revolut and older Baader Bank statements – go into the right portfolio, cross-checked against the final amount.
- More robust text recognition: "O" instead of "0" in ISINs is corrected via the check digit, English numbers like "€60,000.00" are read correctly.

## 0.48 – 15 Nov 2026
- **Credits & support** as its own page (⚙️ → More, below "Report a bug") instead of in the middle of "About the app".
- Analyst firm ratings shown in German in the German version (e.g. "Übergewichten" instead of "Overweight").

## 0.47 – 15 Nov 2026
- **Analysts:** new card in a security's detail view with average price target, median, range, distance to the current price, number of analysts, consensus and buy/hold/sell distribution – plus the latest ratings by analyst firms with old and new price target (source Yahoo Finance, loaded with "Update prices & data").
- **AI:** new question "Analysts & price targets"; analyst data is included in all single-security questions.
- **Backups are now called `.dksafe`.** Older backups are recognised by their content and can still be restored.
- **New signing key** (publisher "Depot-Kompass"): the app has to be reinstalled once – create a backup first, uninstall the old app, install the new one, restore the backup.
- Internal names unified; "About the app" only names Depot-Kompass.
- **Share a portfolio encrypted** (✏️ Edit portfolio → 🔐): a single portfolio as `.dksafe` with its own password – via the share menu or saved as a file. Included: securities, transactions, cash; no notes, originals or keys.
- **Import a shared portfolio:** it is added as a new (observed) portfolio or deliberately replaces an existing one – all other data stays unchanged.
- **"Share → Depot-Kompass":** send backups, screenshots, PDFs and CSV files from any app straight to Depot-Kompass – they go into the normal import (with an active PIN only after unlocking).

## 0.46 – 15 Nov 2026
- **AI as a chat:** a real conversation with answer window and **follow-up questions**; conversations stay encrypted on the phone (history, at most 30, deletable one by one), can be saved as a note.
- **Four AI providers with your own key:** OpenRouter (free models too), **Anthropic (Claude)**, **OpenAI (ChatGPT)**, **Google (Gemini)** – model list per provider. A Claude/ChatGPT subscription cannot be connected, only API keys.
- **"Examples" tab** with ready-made questions, e.g. "Analyse earnings" ("The Nvidia earnings are out – analyse them fully"), "Opportunities & risks of a security", "Put headlines in context", plus quick questions.
- **Earnings in the AI:** single-security questions include public quarterly figures (EPS vs. estimate, revenue and profit per quarter, P/E, dates, headlines).
- **New master prompt:** a personal stock analyst who takes a clear, reasoned position (scenarios, opportunities, risks) instead of dodging – the decision stays with you.
- **Positions:** notice when prices are missing or older than 24 hours, with "Allow internet" and "API keys" buttons.
- **Donation addresses** (Bitcoin, Monero, Ethereum, Solana, Tron, Stellar, Hyperliquid) with copy button and "only send on the network named".
- Backup note no longer names a specific password manager.
- **Notifications** (⚙️ → More → 🔔, off by default, internet only): strong price moves (threshold selectable), earnings today/tomorrow, new headlines. Android checks every few hours in the background – no server, no Google services; the list of securities is stored encrypted on the phone. New permission: notifications.
- **English:** numbers and dates in English format (1,234.56 € · 15/11/2026); the AI preview, instruction and master prompt are in English.
- **Desktop version (alpha)** for Linux, Windows and macOS via Docker: the same interface in the browser, local at 127.0.0.1, encrypted, `.dksafe` interchangeable.
- **Test data folder** to try the app without your own broker (6 brokers, 2 years, all invented).
- Note "Community server on Discord – coming soon".

## 0.45 – 14 Nov 2026
- **New name: Depot-Kompass.**
- **New package name `app.depotkompass`:** the app has to be reinstalled once. Create a `.dksafe` backup or the ZIP export in the old version first and restore it in the new app – old backups and exports are still recognised.
- **Credits:** all open-source components used (Tesseract OCR, Apache-2.0) and data sources (Yahoo Finance, Onvista, Google News, OpenRouter).
- **Support:** section for anonymous donations with a copy button (addresses follow with the release).
- English translation for credits and support.
- License: GPL-3.0 – the code becomes open source.
- Security review before publishing: no keys, passwords or keystores in the code or history; ignore list (.gitignore) extended.
- Preparation for F-Droid and IzzyOnDroid: store texts, icon and screenshots in German and English; no Google or Play services.
- README in German and English.

## 0.44 – 13 Nov 2026
- **Keep originals:** every imported file (CSV, PDF, screenshot) stays in the app (encrypted with the app PIN); "Re-import from original".
- **Export everything as an encrypted ZIP** (AES-256, backup password): data + all originals sorted by portfolio – open on a PC with 7-Zip; restore in the app.

## 0.43 – 13 Nov 2026
- Long/short detected for certificates (name, screenshot, Onvista) and selectable in the position.
- Calendar: tap earnings → result per share (actual/expected, surprise) with "Update"; past dates stay visible.
- Bug fixed: certificates turned into "stock" when editing the position.

## 0.42 – 13 Nov 2026
- **Read screenshots:** choose a screenshot of an executed Trade Republic order (buy/sell) – text recognition runs entirely on the phone, without internet. Cross-check quantity × price ± costs = total.
- The full export later replaces the screenshot bookings automatically (no duplicates).
- **Certificates, warrants, bonds:** enter by hand with ISIN or WKN; "Update prices & data" fetches their price from Onvista.

## 0.41 – 13 Nov 2026
- Language only under ⚙️ → Settings (German by default).
- Import buttons are called "CSV or PDF file".
- **Manage imports:** ⚙️ → Bookings → Imports: move a whole import to another portfolio or undo it; move single bookings.

## 0.40 – 13 Nov 2026
- Introduction and PIN screen in English too.
- Privacy page: note about the mail button.

## 0.39 – 12 Nov 2026
- Switching back from English to German fixed (bottom bar stayed English).

## 0.38 – 11 Nov 2026
- **English** as second language (all pages, messages, prompts; the AI answers in the matching language).
- **Calendar:** buys 🛒 and sells 🏷️ per day and security, can be switched off.
- Calendar: no upcoming ex-dates for securities no longer held.
- **Fingerprint removed** – private financial data only with PIN (it caused a crash during setup).

## 0.37 – 11 Nov 2026
- ✨ AI as its own button in the bottom bar.
- Contact address and "Report a bug" by mail; "alpha" label.
- Bottom bar shortened cleanly with large font.

## 0.36 – 11 Nov 2026
- The AI only receives name, type, entry price and long/short (shares in % only on request).
- New vector logo, sharp at any size.

## 0.35 – 11 Nov 2026
- **AI questions about the portfolio:** portfolio check, positions in the red, take profits?, sell a position and rebalance, own question – preview of the text sent.
- **Switch portfolio/person** on overview, positions, calendar and AI: ‹ › or swipe.
- "About the app" with credits.

## 0.32 – 0.34 – 11 Nov 2026
- **PDF import** for statements from Trade Republic, Revolut, Smartbroker+, Scalable, Sparkasse and other banks; Kraken (account statement, monthly statement, ledger, holdings, purchase receipt).
- **Cross-check** in the preview: does the balance match the statement?
- Duplicate bookings from different exports are detected.

## 0.31 – 11 Nov 2026
- First PDF import (own reader, offline, no third-party library): Kraken account statement and PDF tables.

## 0.30 – 8 Nov 2026
- Full run: every button on every page tested automatically, calendar test.
- Calendar and "Upcoming" respect the person selection.

## 0.28 – 0.29 – 8 Nov 2026
- **Leverage and position-size calculator** with chart (entry, knock-out, stop, target), can be saved as a note.

## 0.24 – 0.27 – 8 Nov 2026
- Chart appears for every portfolio type; periods 1W to All.
- Kraken app "Activities"; transfers (e.g. challenges) as a loss.
- **Any CSV** via "Map columns", including account statements.
- **People/household**, **tax overview**, starting holdings calculated backwards.

## 0.16 – 0.23 – 7 Nov 2026
- Encryption with app PIN, encrypted backup `.dksafe`, internet can be switched off.
- Physical assets, settings (design, hide amounts), own news sources.
- Overview across all portfolios with value history.

## 0.1 – 0.15 – 7 Nov 2026
- Import Trade Republic, Scalable, Smartbroker+, Kraken, Bitvavo, OKX, holdings list.
- Several portfolios, cash, calendar (dividends, ex-dates, earnings, holding periods), positions, heatmap, watchlist, notes, news.
