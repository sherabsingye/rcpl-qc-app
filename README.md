# RCPL Equipment QC & Dispatch System

**Rigsar Construction Private Limited — Equipment Maintenance Division, Phuentsholing, Bhutan**

An installable mobile web app (PWA) for the 4-stage workflow: **Job Card → QC Checklist → Dispatch → Site Handover → Tracker**. Data is stored in Firebase Firestore so the whole team sees the same jobs in real time. Works offline at remote sites.

---

## How it works

- **Mechanics** open the app on their phone, fill the Job Card, complete the QC checklist, and save.
- **Workshop Supervisor** sees every job update in real time on the Tracker tab.
- **Site team** opens the same URL and signs off the Handover when the machine arrives.
- **Offline:** if there's no internet at the site, the app still works — changes sync automatically when the phone is back on Wi-Fi or mobile data.

---

## One-time setup (≈15 minutes)

### 1. Create a free Firebase project

1. Go to https://console.firebase.google.com → **Add project**.
2. Name it `rcpl-qc` (or similar). Disable Google Analytics (not needed).
3. In the project: **Build → Firestore Database → Create database** → **Production mode** → location `asia-south1` (closest to Bhutan).
4. **Build → Authentication → Get started → Anonymous → Enable → Save**.
5. **Project Settings (⚙) → General → Your apps → Web (</>) icon** → register app name "RCPL QC" → copy the `firebaseConfig` object it shows you.

### 2. Paste the config into the app

Open `js/firebase-config.js` and replace the values under `firebaseConfig` with the ones you just copied. While you're there:

- Change `TEAM_CODE` from `"rcpl2026"` to anything your team will remember — this is the code that stops outsiders from writing data.

### 3. Publish Firestore security rules

In the Firebase Console → **Firestore → Rules**, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Click **Publish**. This means: only signed-in users (i.e. anyone with your team code) can read or write.

### 4. Deploy to Vercel (free)

Easiest path: create a GitHub repo, push this folder, then import on Vercel.

```bash
cd rcpl-qc-app
git init
git add .
git commit -m "Initial RCPL QC app"
gh repo create rcpl-qc-app --public --source=. --push
```

Then:
1. Go to https://vercel.com → **Add New → Project → Import Git Repository** → pick `rcpl-qc-app`.
2. Framework preset: **Other**. Build command: *(leave blank)*. Output: *(leave blank)*. Click **Deploy**.
3. When it finishes you'll get a URL like `https://rcpl-qc-app.vercel.app`.

*(Alternative: `npm i -g vercel && vercel --prod` from the folder.)*

### 5. Share with the team

1. Send your team the Vercel URL.
2. Give them the team code you set in step 2.
3. Tell them to open the URL on their phone and tap **Add to Home Screen** (iPhone: Share → Add to Home Screen · Android: ⋮ → Install app).
4. They sign in with their name + role + team code — once per phone.

Done. From then on, every Job Card / QC / Dispatch / Handover shows up live on everyone's Tracker.

---

## Running locally (for testing)

```bash
cd rcpl-qc-app
npx serve .
# open http://localhost:3000
```

If `js/firebase-config.js` still has `REPLACE_ME` values, the app runs in **Local mode** — the status strip will say so, and data is only saved on that device (not shared with the team). This is fine for testing the UI.

---

## The 4-stage workflow

| Stage | What's captured | Blocks next stage if… |
|---|---|---|
| **1. Job Card** | Fault, root cause, work done, pending issues, parts | Job Card No. + equipment + fleet No. are required |
| **2. QC Checklist** | 30–47 check points per equipment type, each OK / Mon / Fail | Any **Fail** → overall FAIL → dispatch blocked |
| **3. Dispatch** | Formal dispatch with pending items briefed to site | — |
| **4. Site Handover** | On-site arrival check + dual sign-off | Both signatures → Job Closed |

**Crane zero-tolerance rule:** Any `Mon` or `Fail` on wire rope / hook / LMI / load test → overall = **FAIL**. No conditional pass for crane safety items.

---

## Printing

Every tab has a **Print** button. The print CSS hides navigation and shows the form content only — clean physical record for workshop files.

---

## Folder layout

```
rcpl-qc-app/
├── index.html              ← UI (5 tabs, 8 equipment types)
├── css/app.css             ← styles + mobile breakpoints + print
├── js/
│   ├── main.js             ← wiring, tabs, toast, SW registration
│   ├── firebase-config.js  ← YOU EDIT THIS — Firebase project keys
│   ├── auth.js             ← anonymous auth + team code gate
│   ├── job-card.js         ← Job Card save / auto-gen ref
│   ├── qc.js               ← checklist scoring + crane rule
│   ├── dispatch.js         ← dispatch record
│   ├── handover.js         ← handover + signatures
│   └── tracker.js          ← live team register
├── manifest.json           ← PWA manifest
├── service-worker.js       ← offline shell cache
├── icons/                  ← app icons (yellow R on black)
├── vercel.json             ← deploy config
└── README.md
```

---

## Troubleshooting

- **"Tracker error — check connection or Firebase rules"** → Firestore rules not published yet, or Firebase config wrong. Re-check steps 2 & 3 above.
- **"Team code is incorrect"** → `TEAM_CODE` in `js/firebase-config.js` doesn't match what you told the team.
- **Can't install on iPhone** → You must open the URL in **Safari** (not Chrome on iOS) for "Add to Home Screen" to appear.
- **Changes not syncing** → check the status strip at the top — yellow = offline. Will sync when back online.

---

## Roadmap (v2)

- Photo upload on Job Cards (before / after evidence)
- PDF export per equipment type
- PM-tracker Google Sheets integration
- Role-based dashboards (manager overview)
