# SmartHome V2 — Calendar Month View
**Version:** 0.1.0

Vite + Tailwind smart home web application. Top half consits of a tabbed view which will allow you to access smarthome features, slideshow or music. More to be added later. The bottom half is a calendar tha connects to google calendar.

---

## Features
- Month view calendar
- Image Slideshow
- Music Integration 
- Pure client-side (no backend)

---

## Prerequisites
- Node 18+ (or 20+)  
- Vite (vanilla JS)  
- Tailwind (CDN or Tailwind v4)  
- Google Cloud project

---

## 1) Enable API
Google Cloud Console → **APIs & Services → Library** → enable **Google Calendar API**.

---

## 2) Create OAuth Client (Web)
Google Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID**  
- **Application type:** Web application  
- **Authorized JavaScript origins** *(no trailing slash)* — add what you actually open:
  - `http://ip:5000`
- **Redirect URIs:** *Not needed* for GIS **token** flow

If the **OAuth consent screen** is **Testing**, add your Google account under **Test users**.  
Copy the **Client ID** (ends with `.apps.googleusercontent.com`) into the .env file.

## 3) Create .env File
- create a file called ".env" in the root folder
- add the following to the file
```
VITE_GOOGLE_CLIENT_ID=something.apps.googleusercontent.com
VITE_GOOGLE_LOGIN_EMAIL=name@mail.com
```
- Add your google calendar email and you client ID from step 2