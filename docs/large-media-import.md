# Importazione di originali grandi e formati audio/video

Importa nello stage dal pulsante Import. Il selettore permette di scegliere anche
MOV, MXF, MTS/TS, AVI, MKV, FLAC, AIFF e altri contenitori: FFprobe controlla il
contenuto reale invece di autorizzare solo alcune estensioni. Il supporto dipende
dai demuxer/decoder della versione FFmpeg installata. File corrotti, protetti o
codec non decodificabili non diventano automaticamente supportati.

Il caricamento scrive direttamente su disco con backpressure, senza il precedente
buffer in RAM e limite di 500 MB. Il browser invia il File senza conversione
base64/ArrayBuffer. Sono visibili nome, percentuale di trasferimento e fase di
analisi. Dopo l’analisi il file appare subito nello stage. L’anteprima viene
preparata in background: nella scheda compaiono percentuale reale, tempo residuo
stimato, annullamento e possibilità di riprovare. Annullare conserva l’originale.
Al massimo due anteprime vengono convertite contemporaneamente; le altre sono
in coda. Le anteprime usano un preset veloce, quattro thread e scartano i frame
superflui prima del ridimensionamento. Gli upload non hanno il timeout di cinque minuti del server Node.
Serve spazio per una copia dell'originale e per l'eventuale anteprima. Una
connessione interrotta richiede una nuova importazione; non c'è ripresa parziale.

I contenitori/codec non direttamente compatibili con il browser e i video oltre
1080p/30fps ricevono una copia di anteprima H.264/AAC fino a 1280×720 e 30fps,
con proporzioni conservate. Anche MOV H.264 viene preparato in MP4 per il browser.
Il lavoro può richiedere tempo su riprese lunghe. Il server conserva l'originale:
metadati, timeline, analisi, tagli ed esportazioni continuano a riferirsi a quello,
non al proxy. Le anteprime supportano le richieste HTTP Range per il seeking.
L'anteprima non cambia le impostazioni di risoluzione/frequenza dell'esportatore.

Prove ripetibili:

```sh
npm run lint
npm run build
npx tsx --test tests/large-import.test.ts
# Prova di trasferimento reale di 28 miliardi di byte (circa 28 GB liberi necessari):
LARGE_IMPORT_BYTES=28000000000 npx tsx --test tests/large-import.test.ts
```

La fixture grande contiene una breve ripresa MOV reale 3840×2160/60fps con audio,
seguita da padding. Verifica il percorso di trasferimento e la dimensione su disco,
non simula la durata o il costo di decodifica di una ripresa personale di 28 GB.
Verificati anche FLAC, MPEG-TS, file invalidi/vuoti, conservazione dell'originale,
proxy a 720p/30fps e lettura parziale HTTP. La pipeline dell'installer esegue la
prova standard sopra 500 MB su Windows prima della pubblicazione.

## Verifica in ambiente cloud

- Trasferimento sintetico reale da 28.000.000.000 byte: tre test passati, compresi
  metadati 4K/60fps, proxy e Range. Non è stato usato il filmato personale.
- Browser Chromium: importazione di MOV ProRes e FLAC nello stage, con rendering
  reale del fotogramma MOV; passato anche il flusso import/taglio/Undo/export.
- TypeScript, build Vite e bundle server Windows: passati.
- Regressione integrazione e compatibilità FFmpeg: 73/74 passati. Il caso che
  richiede parole riconosciute da Whisper resta bloccato dal modello non scaricabile
  tramite la rete cloud (403); non riguarda il trasferimento dei media.
- I risultati Windows dell'installer nuovo vanno controllati nella relativa
  esecuzione GitHub Actions; i test Linux non attestano la pubblicazione.

La regressione sull’attesa di importazione usa una ripresa reale da due minuti:
il server restituisce l’asset mentre FFmpeg sta ancora lavorando. I test verificano
progresso misurato, annullamento del processo, ripresa, limite di concorrenza e
conservazione dei file. Nel browser la scheda appare prima della conversione;
Annulla e Prepara anteprima funzionano anche dopo un tentativo nel Player.
