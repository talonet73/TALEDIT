# Correzione AI Cut / FFmpeg — 4 novembre 2026

**Verifica completata e installer pubblicato.**

[Scarica TALEDIT-Setup.exe](https://github.com/talonet73/TALEDIT/releases/download/taledit-windows-254868b1592a/TALEDIT-Setup.exe) ·
[Esecuzione Windows riuscita](https://github.com/talonet73/MyTalonet/actions/runs/41851722336).

Codice incluso: [`254868b1592a`](https://github.com/talonet73/TALEDIT/tree/254868b1592a17ccf2511e98d72668f698aa687d).

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

## Risultati effettivi

| Ambiente | Verifica | Esito |
| --- | --- | --- |
| Linux, FFmpeg 7.1.5 | Suite completa | 113/113 PASS, zero ignorati |
| Linux, FFmpeg N-128406-g1fe6854fd9-20261104 | Suite completa | 113/113 PASS, zero ignorati |
| Browser Chromium, backend con FFmpeg recente | Suite completa, inclusa scansione WAV 169,6/0,7 e Undo | 35/35 PASS |
| Windows Server 2022, FFmpeg 7.1.1 incluso | Avvio, tre riaperture, AI Cut WAV/video prima della compressione | PASS |
| Windows Server 2022, installer effettivamente installato in una cartella con spazi | Inventario SHA, runtime/modelli, AI Cut WAV/video, MP4, PNG nei Download, browser, chiusura, disinstallazione con dati preservati | PASS |
| Download GitHub | File completo, intestazioni MZ/PE, SHA256 | PASS |

Anche controllo TypeScript, compilazione Python dei test Windows e `git diff --check`
sono passati. I test non dipendono dalla presenza del vecchio parametro: usano
realmente il motore corrente che lo rifiuta.

Il file personale dello screenshot non è stato caricato: il test ne riproduce
durata e impostazione con pause/suoni misurabili. La prova Windows automatica non
equivale a una prova manuale su ogni PC o browser. Non sono state cambiate altre
funzioni dell’editor o le dipendenze incluse nell’installer.

## Installazione dell’aggiornamento

Salva il progetto e conserva la vecchia cartella. Chiudi TALEDIT e la vecchia
finestra nera, apri il file appena scaricato e premi Avanti → Installa → Fine.
Riapri dall’icona TALEDIT sul desktop. Per i progetti della precedente cartella
con gli script, segui il [recupero dei media](windows-installer.md#progetti-e-aggiornamenti).



File verificato: 664607424 byte (633.8 MiB).

```text
db8f82357f7f597ba718132b988728ddc68ad9c12c001417e7e82f4567283498  TALEDIT-Setup.exe
```
