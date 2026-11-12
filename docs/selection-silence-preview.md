# Unione selettiva, silenzio digitale, anteprime e zoom

## Unire i mattoncini scelti

Seleziona con Ctrl+clic/Shift+clic oppure disegna un rettangolo col mouse.
Il clic destro mantiene la selezione. Premi **Unisci mattoncini selezionati** nel
menu oppure **Unisci selezionati** nella barra della timeline. Sono uniti soltanto
i pezzi scelti, senza aggiungere automaticamente le controparti collegate.

L'unione produce un mattoncino composto per ogni pista con almeno due pezzi scelti.
Non riconverte i sorgenti. Conserva tempi, vuoti, tagli, effetti e audio interni;
spostamento, trim, velocità, volume e dissolvenze del composto vengono applicati
al contenuto. Se un pezzo non selezionato è interposto sulla stessa pista, l'app
chiede di includerlo o scegliere un altro intervallo, evitando sovrapposizioni.
Indietro annulla e il progetto TAL conserva i componenti. Il comando **Collega
video e audio** rimane distinto dall'unione di più pezzi.

La selezione solo audio disattiva il suono incorporato delle controparti video:
non deve raddoppiare la voce. La selezione solo video lascia intatti i mattoncini
audio. Quando vengono unite entrambe le serie di coppie originali, le due unioni
restano collegate se iniziano e finiscono insieme.

## AI Cut: Automatico a volume zero

La casella **Automatico · taglia i tratti a volume zero** disabilita il margine
manuale e rimuove silenzi digitali di almeno 30 ms, conservando 5 ms ai bordi.
La misura avviene sul mix di analisi in virgola mobile, a una soglia sotto il
singolo campione PCM16 non nullo. Una voce a basso volume non va confusa con zero.
Non richiede Whisper; le opzioni esitazioni/ripetizioni restano separate.
Il mix è indipendente da Mute e volume di ascolto. I tagli restano annullabili.

## MOV e riparazione dell'anteprima

La scheda del file offre **Ripara anteprima** anche quando il browser non mostra
errori. Ricrea una copia VP8/Opus WebM, stereo 48 kHz, senza cambiare il sorgente.
Riutilizza il precedente MP4 a bassa risoluzione quando ha immagini e audio utili.
Se la copia è nera/silenziosa e il sorgente contiene segnale, riparte dal sorgente
conservato sul server: non serve ricaricare il file originale dal browser.

Prima di segnare pronta una nuova anteprima, il server verifica presenza dei flussi
e decodifica effettivamente un fotogramma e un campione audio. Le prove campionate
non certificano ogni fotogramma del file personale, che non è disponibile qui.

Il Player ricarica entrambi i decoder con una revisione URL nuova dopo la riparazione,
per evitare il riutilizzo dei dati della precedente anteprima. **Diagnostica**
scarica un JSON con versione installata, browser, codec originali e copie generate,
stato del decoder e dimensioni realmente lette; non invia automaticamente il file.
La nuova importazione normalizza l'audio delle anteprime a stereo 48 kHz e sceglie
il flusso video effettivo, evitando eventuali copertine allegate.

## Ctrl e rotella

Un solo gestore controlla lo zoom nella timeline, anche con il pulsante destro
premuto o il menu contestuale aperto. Il menu viene chiuso e la pagina non viene
ingrandita dal browser. Rimane l'ancoraggio sotto il puntatore e lo zoom verticale.
Il gestore precedente duplicato, che limitava il valore a 60, è stato rimosso.

## Verifiche

- Unit test: scelta esatta di video/audio/entrambi, offset, trim, velocità e fade.
- API con FFmpeg reale: confronto fotogrammi e RMS prima/dopo l'unione, assenza di
  raddoppio audio, esportazione di fade del composto, rilevamento del solo zero.
- Riparazione: cache MP4 deliberatamente nera e silenziosa, ricostruzione dal
  sorgente, codec VP8/Opus verificati, HTTP Range e sorgente invariato.
- Browser: rettangolo di selezione, Ctrl+clic, menu contestuale, unione/Undo,
  salvataggio/riapertura TAL, Ctrl+rotella con tasto destro, flag AI Cut.
- Browser: risposta AVC deliberatamente non decodificabile, riparazione WebM,
  fotogramma visibile e PCM reale del Player, download diagnostico.

I nuovi casi API vengono eseguiti su Windows prima della compressione. I casi
browser entrano nei controlli dell'app effettivamente installata in Chrome ed Edge,
insieme alle verifiche HEVC 4K e del filmato lungo. La pubblicazione è bloccata
in caso di fallimento; i risultati Windows vanno letti nella relativa esecuzione.
