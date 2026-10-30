# Changelog

## 3.6.1

### Fixed
- **No more empty white window on start.** Creating the WebView2 window can take from several seconds up to half a minute on a cold start (the whole program is busy during that time, which is also why the window used to stay white). Now:
  - a tiny separate start-up screen (`splash.exe`: logo, "Starting…" / "Запускаю…" and a spinner) appears within a fraction of a second and closes as soon as the player window is ready;
  - the player window stays hidden until it already contains a dark placeholder page that needs no server, polls the server every 300 ms and switches to the interface the moment the server answers;
  - the interface page itself starts with the same logo screen until it is built, and its web font no longer blocks the first paint if the network is slow.
- Media keys helper, Discord status and the update check now start a few seconds *after* the interface has appeared instead of competing with the window for CPU during start-up.

### Added
- **Clear Spotify Premium handling.** The Spotify card now says up front that playback needs Spotify Premium and the desktop app. After sign-in the account type is checked; a free account gets a yellow note, the Spotify app is never driven (no more "no active device" errors), and each Spotify track plays from YouTube or SoundCloud when the same track is found there, with a single notice per session. The search chip for Spotify explains "Playback needs Premium". With Premium, a missing or unstarted Spotify app now produces a plain explanation instead of an error. The README has new Requirements and Sources sections.
- Start-up timing marks in the log (a line starting with `boot`) to see where start-up time goes.

### Notes
- The time WebView2 itself needs to create the window is outside the program's control; on a heavily loaded PC it can still be several seconds, but the start-up screen is visible during it.

## 3.6.0

### Added
- **Two interface languages: English and Russian.** The language follows Windows on first launch (Russian for Russian, Ukrainian and Belarusian systems, English otherwise) and can be changed in Settings → Appearance → Language. The switch applies immediately, without a restart, and is remembered. It covers the interface, the mini player, the tray menu, the Discord status text and the messages and errors from the program itself.
- Correct plural forms and number, date and time formats for each language.
- Tests that keep the dictionaries in step: both languages must have the same keys, with no empty values, matching placeholders and plural forms, and no Russian text hard-coded in the code.

### Changed
- All user-facing text moved out of the code into `public/locales/ru.js` and `public/locales/en.js`.
- The program's own log lines are now always written in English, so the log can be read and shared whatever language the interface uses.
- README is now in English with a Russian version in `README.ru.md`; the release archive contains both.
- Build scripts print their messages in English.
- A small watchdog process (the same Sonara.exe, visible for up to 25 seconds after launch) restarts the player if its window never opens, even when the whole program is stuck and cannot check on itself. It restarts at most twice.

### Notes
- The window title of the main window is just "Sonara"; the mini player title follows the language the next time the mini player is opened.

## 3.5.0

### Added
- Library backup: likes and playlists of all sources in one JSON file, weekly automatic backups (the last 5 are kept), restore with strict file validation, playlists export to M3U.
- Update check once a day against the latest GitHub release (can be turned off); it only offers to open the release page and never downloads anything.
- Sleep timer: 15, 30, 45 and 60 minutes, custom minutes, until the end of the track, a fade-out over the last 30 seconds and a pause that leaves the player open. It also pauses Spotify through its app.
- Hotkeys with remapping, and global media keys that work with the window minimized or in the tray.
- YouTube Music as a source (through yt-dlp), global search across sources, gradient backgrounds including a gradient from the cover, themes with import and export, and custom CSS.

### Changed
- Global media keys now use a small native helper (`mkhelper.exe`) instead of a hidden PowerShell, which antivirus programs dislike. PowerShell remains only as a fallback.
- The local server rejects requests with a foreign `Host` and cross-site requests; settings are written atomically; the log is rotated while the program runs and no longer contains tokens or cookies.
- A window that fails to appear within 10 seconds is restarted automatically.
