# nakazmusic

A music player for Windows that gathers your Spotify, SoundCloud and YouTube Music likes in one window. It has synced lyrics, a mini player, a sleep timer, library backups and a lot of ways to change how it looks.

Русская версия: [README.ru.md](README.ru.md)

Source and releases: https://github.com/nakazueq/nakazmusic

Formerly named Sonara. Your settings, library and backups carry over automatically.

## Requirements

- Windows 10 or 11 (it uses the WebView2 runtime that comes with current Windows; if it is missing, nakazmusic opens in your browser instead).
- **Spotify tracks need Spotify Premium and the Spotify desktop app.** Without Premium you can still connect your account and see your likes, and nakazmusic plays those tracks from YouTube or SoundCloud when it finds them.
- YouTube Music needs `yt-dlp` (one button in **Settings → Accounts** downloads it); it works best with Node.js or Deno installed.
- SoundCloud and music files from your PC need nothing extra.

## Sources

- **Spotify.** Playback of Spotify tracks requires Spotify Premium and the Spotify desktop app. After you connect, nakazmusic checks the account type. With a free account it shows a yellow note, never tries to control the Spotify app, and plays each Spotify track from YouTube or SoundCloud if it finds the same track there (you get a short notice once per session). With Premium, tracks play through the Spotify desktop app; if the app isn't installed or doesn't start, nakazmusic tells you so instead of showing an error.
- **SoundCloud.** Your public likes, by username. Some tracks only offer a preview.
- **YouTube Music.** Public playlists by link, and your likes through your Brave sign-in; audio comes through yt-dlp.
- **This PC.** Folders with mp3, wav, flac, m4a and ogg files.

## Settings

Open **Settings** (bottom of the sidebar). The main places:

- **Appearance**: **Language**, light/dark mode, accent color, background, and **Fine tuning…** for layouts, blocks, colors from the cover, gradients, themes and custom CSS.
- **Accounts**: connect Spotify, SoundCloud and YouTube Music, add folders with music from your PC, and set up Discord status.
- **Keys**: hotkeys for the player window, and the global media keys.
- **Backups**: save and restore your library, export playlists to M3U.
- **About**: update checks and where the log file lives.

### Language

nakazmusic speaks English and Russian. On first launch it follows the language of Windows: Russian if your system is Russian (Ukrainian and Belarusian also count), English otherwise. To change it, go to **Settings → Appearance → Language**. The change applies at once, with no restart: the interface, the tray menu and the messages from the program all switch. Your choice is remembered.

## Build, test, release

```
npm install
npm test          # automated checks of the important parts
build.bat         # builds nakazmusic.exe into the folder above
release.bat       # builds nakazmusic.exe and packs ..\release\nakazmusic-<version>-win-x64.zip
```

To publish a release on GitHub, upload the zip to a new release tagged `v<version>` (for example `v3.6.1`). The app learns about new versions from `https://api.github.com/repos/nakazueq/nakazmusic/releases/latest`. The `UPDATE_REPO` constant lives in one place, at the start of the "update check" block in `server.js`.

All text shown to the user lives in `public/locales/ru.js` and `public/locales/en.js`. `npm test` checks that both dictionaries have exactly the same keys and that no Russian text is hard-coded in the code. To add a language, add a dictionary file, register it in `public/locales/core.js` and add a button to the language switch.

## If your antivirus complains

nakazmusic isn't signed with a code-signing certificate, and antivirus programs sometimes flag `pkg`-built Node.js apps and small unsigned executables. These are false positives, but here is exactly what could trigger them, and what to do:

| What | Why it's there | Risk |
| --- | --- | --- |
| `nakazmusic.exe` (Node.js packed with pkg) | the app itself | Unsigned pkg builds are sometimes flagged by Defender, Kaspersky and Avast. |
| `%LOCALAPPDATA%\MyPlayer\mkhelper.exe` | global media keys (RegisterHotKey); 6 KB, no network access | Low: a plain unsigned exe with a description and version. This used to be a hidden PowerShell using `-EncodedCommand` and `Add-Type`, which looks far more suspicious. PowerShell is now only a fallback if `mkhelper.exe` fails to start. |
| `%LOCALAPPDATA%\MyPlayer\splash.exe` | the small start-up screen shown while the window is being created; 8 KB, no network access | Low: a plain unsigned exe with a description and version. If it is blocked, the player simply starts without the start-up screen. |
| `yt-dlp.exe` (downloaded by a button in the settings) | YouTube Music | Downloaded from the official GitHub release and checked against its SHA-256. |
| Icon and version info patched into the exe | the app icon and file properties | Harmless by itself, but patching resources in an unsigned file can lower its reputation. |

If the antivirus gets in the way, add these to its exclusions:

- the folder that contains `nakazmusic.exe`;
- `%LOCALAPPDATA%\MyPlayer` (settings, log, `mkhelper.exe`, `splash.exe`, `yt-dlp.exe`).

If you don't need media keys, turn them off in **Settings → Keys**: the helper then doesn't start at all.

If the file is blocked before it even runs, the real fix is code signing (an Authenticode certificate) plus a false-positive report to Microsoft: https://www.microsoft.com/en-us/wdsi/filesubmission

## Privacy

What the program does with your data, plainly:

- **No telemetry.** No usage statistics, no crash reports, no analytics. What you listen to stays on your computer (the listening history is the `plays.jsonl` file next to your settings).
- **Update check:** once a day it makes a single request to GitHub for the latest release number. The request carries only the app name and version. Nothing is downloaded or installed. You can turn it off in **About**.
- **The local server** listens on `127.0.0.1` only. Other computers can't reach it, and neither can other websites open in your browser (the address and origin of every request are checked).
- **Brave cookies** are read only if you turn that on yourself for YouTube Music: either by signing in through Brave when you connect a private playlist or your likes, or with the switch "Try Brave cookies if a video won't play" (off by default). yt-dlp does the reading; the program never stores the cookies, sends them anywhere or writes them to the log. Without that option your browser is not touched.
- **Settings, Spotify tokens and keys** stay with you: `%LOCALAPPDATA%\MyPlayer` (settings, log, cache) and `Documents\nakazmusic` (library backups, themes, M3U). Tokens and cookies never end up in the log, which is capped at about 1 MB.
- **Where the program does connect**, when you use the matching feature: Spotify, SoundCloud and YouTube (your likes and the audio); LRCLIB, Genius, NetEase and lyrics.ovh (track titles and artists, to look up lyrics); the cover-art servers of those services; and GitHub (the update check and, only when you press the button, downloading yt-dlp, verified by SHA-256). Discord receives the title and artist of the playing track only if you turned Discord on in the settings and entered an Application ID.
- A library backup holds no passwords or tokens: only titles, artists, links and the list of connected sources.
