# Correzione AI Cut / FFmpeg — 4 novembre 2026

Il caso segnalato è un WAV di 169,6 secondi con pausa da conservare di 0,7 secondi.
L'errore `Unrecognized option 'filter_complex_script'` si verifica prima della lettura
del file: riguarda il comando FFmpeg, non il tipo audio/video o il margine scelto.

Riproduzione reale con FFmpeg `N-128406-g1fe6854fd9-20261104` (build BtbN):
`-filter_complex_script` restituisce codice 8 e lo stesso errore dello screenshot.
La sintassi corrente `-/filter_complex` completa invece il comando. Con FFmpeg
7.1.5 sono accettate entrambe. Il vecchio parametro è deprecato in 7.1 e assente
nel sorgente corrente upstream.

## Modifica

`server/media.ts` usa `-/filter_complex` per leggere il grafo dal file temporaneo.
È il punto condiviso da analisi AI Cut, trascrizione, esportazione audio/video e
Screenshot. Il grafo resta su file: i sottotitoli animati e i montaggi lunghi non
vengono trasferiti sulla riga di comando, preservando il limite Windows.
Non vengono cambiati i file originali o le regole di rilevamento/taglio.

## Prove ripetibili

`tests/ffmpeg-compat.test.ts` esegue realmente:

- scansione completa di un WAV sintetico di 169,6 s con una pausa nota, margine 0,7 s;
- applicazione dei tagli con la funzione dell'app, clip contigue, durata finale circa
  3,7 s ed esportazione WAV con il segnale originale udibile;
- scansione di un MP4 con audio collegato e pausa nota, taglio ed esportazione con
  video e audio, controllando che tutti i fotogrammi conservino il colore sorgente.

Il browser ripete il caso WAV 169,6/0,7 dal pulsante AI Cut e controlla anche Undo.
`packaging/windows/ai_cut_smoke.py` prova entrambi i tipi direttamente sull'app
Windows, prima della compressione e nuovamente dopo l'installazione effettiva.
La pubblicazione dell'installer rimane subordinata al superamento dei controlli.

I risultati completi e il link dell'installer verificato vengono aggiornati al
termine dell'esecuzione. Il file personale dello screenshot non è stato caricato:
il test ne riproduce durata e impostazione con pause/suoni misurabili.
