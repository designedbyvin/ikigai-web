# Ikigai

**生き甲斐: a reason for being.** A cozy personal journal that asks how you feel, helps you tell the story of your day, and keeps every page in your own browser.

No account, no server, no cloud. Your pages are stored in your browser's IndexedDB and never leave your device.

## Features

- **Write:** handwriting-style text, a mood check-in, writing prompts that follow your mood, story starters, a highlight of the day, and scene details (where, who with, weather)
- **Autosave:** saves as you type
- **Word milestones:** small messages at 100, 250, 500, 1,000 and 2,000 words
- **Calendar:** a month view with mood dots, a year-in-moods view, monthly and yearly recaps, and a streak that forgives one missed day
- **Past days are read-only:** you can read or delete them, but not edit them
- **Pages:** every entry, grouped by month and searchable
- **Import and export:** a `.json` backup you can import later, or a readable `.md` file

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page structure |
| `style.css` | All styling (colors live in `:root` at the top) |
| `app.js` | All behavior: storage, views, import and export |
| `favicon.svg` | Browser tab icon |

No build step and no dependencies. The only external requests are the Poppins and Caveat fonts from Google Fonts.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Deploy to GitHub Pages

1. Create a repository and push these files to the `main` branch, in the root folder.
2. Go to **Settings → Pages**, set **Source** to *Deploy from a branch*, and pick `main` / `root`.
3. For a custom subdomain, add a `CNAME` file containing your domain (for example `ikigai.yourdomain.com`), then add a CNAME DNS record pointing to `<username>.github.io`.

## About your data

- Entries belong to the browser and the address you use. Pages written on one domain won't appear on another, or in a different browser or device.
- Clearing site data for the domain deletes your pages. Export a backup now and then.
- Private or incognito windows may block storage. The app shows a notice when that happens.

## Credits

Designed and built by Melvin Lomboy.
