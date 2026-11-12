# Verifica del Player dopo la conversione MOV

## Difetto riprodotto e correzione

La preparazione del fotogramma aspettava solo `loadeddata`. Dopo una ricerca quel
segnale può essere già stato emesso: il decoder completa con `seeked`/`canplay`.
La prova con una ripresa lunga e colori diversi ai vari tempi falliva: a 60,5 s
il cursore era al punto richiesto ma il Player mostrava ancora il colore prima
della ricerca. La stessa prova passa ascoltando tutti i segnali di disponibilità
e controllando nuovamente lo stato del decoder.

Gli errori dei media vengono ora mostrati nel Player con il nome del file e il
codice del browser. Un errore di lettura/decodifica non resta soltanto un riquadro
nero. Questo miglioramento non equivale a identificare ogni possibile causa del
file personale segnalato, che non è disponibile nell'ambiente di test.

## Prove funzionali

`tests/browser/preview-av.spec.ts` esegue importazione vera, attesa dell'anteprima,
inserimento nella timeline, controllo dei pixel del canvas e misura del PCM
realmente decodificato dal media element e passato al master Web Audio. La misura
non usa un oscillatore nel Player o un audio sostitutivo. Ogni caso riparte da
una timeline vuota per evitare che il segnale di un caso precedente falsi l'esito.

- MOV con PCM stereo 48 kHz, 8 canali 48 kHz, stereo 96 e 192 kHz.
- MOV lungo circa 73 minuti, con colori diversi all'inizio, a 1, 30 e 73 minuti.
  Verificati i pixel corretti e l'audio dopo pausa, ricerca e ripresa.
- HEVC/H.265 `hvc1`, 3840×2160, 59,58816 fps, BT.709, AAC stereo 48 kHz;
  provati sia 8 sia 10 bit, trascinando il file dallo stage sulla pista video.
- Risposta media volutamente non decodificabile: il Player deve mostrare l'errore.

La ripresa lunga è sintetica a bassa risoluzione; i casi HEVC 4K durano quattro
secondi. Durata lunga e caratteristiche 4K sono verificate separatamente. Non
sono stati elaborati tutti i fotogrammi del file personale da 28 GB e non viene
asserita una prova fisica degli altoparlanti del PC dell'utente.

Prima della correzione: 6 casi passati, ricerca sul filmato lungo fallita.
Dopo la correzione: tutti e sette i casi audio/video passati in Chromium Linux;
passato anche il caso aggiuntivo di errore del decoder. Passate le regressioni
importazione/preview/taglio/Undo/export, MOV ProRes/FLAC e annullamento/ripresa.

## Blocco della pubblicazione Windows

`packaging/windows/smoke.py` avvia ora queste prove contro l'app realmente
installata, con FFmpeg privato dell'installer, usando `playwright.installed.config.ts`.
Sono richiesti Google Chrome ed Edge. La pubblicazione non procede se questi controlli
falliscono. Rapporti, trace e schermate dei fallimenti vengono conservati da
GitHub Actions. Il controllo precedente del browser verificava principalmente
l'apertura dei pannelli, non il segnale audio del Player.

```sh
npm run lint
npx playwright test tests/browser/preview-av.spec.ts
```

Per riusare una fixture lunga già generata si può indicare `LONG_MOV_FIXTURE`;
questa deve contenere i quattro segmenti rosso/blu/verde/giallo documentati nel test.
