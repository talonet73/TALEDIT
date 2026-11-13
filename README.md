<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5aae0165-440a-49b9-af33-6d894059cf7a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## App desktop Windows

TALedit può essere installato su Windows 10/11 a 64 bit. L'avvio dal menu Start
o dal collegamento sul desktop apre una finestra dedicata, senza aprire il browser.
Il server locale viene avviato e arrestato automaticamente insieme all'app; non serve
installare Node.js sul PC. FFmpeg è incluso per le esportazioni.
I media importati e le esportazioni vengono salvati in `%APPDATA%/TALedit/media_downloads`.

### Scaricare l'installer

Su GitHub aprire **Actions → Windows installer**, scegliere una build riuscita e
scaricare l'artefatto **TALedit-Windows-Installer**. Estrarre lo ZIP ed eseguire
`TALedit-Setup-1.0.0.exe`. L'installazione crea i collegamenti nel menu Start e sul desktop.
L'installer non è firmato con un certificato di firma del codice.

### Sviluppo e compilazione

- `npm ci`: installa le dipendenze.
- `npm run desktop`: compila e apre la finestra desktop.
- `npm run dist:win`: genera l'installer nella cartella `release` (eseguire su Windows).
- `npm run icons`: rigenera PNG e ICO multirisoluzione da `logo_TALedit.png`.

La workflow `.github/workflows/windows.yml` compila l'installer ad ogni push su `main`
e può essere avviata manualmente da GitHub Actions. Il logo è incluso localmente
nell'interfaccia, nell'eseguibile, nell'installer e nei collegamenti Windows.
