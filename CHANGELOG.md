# Changelog

Entwicklungsnotizen für `musikisum/educandu-plugin-mei-import`. Nicht auf
Nutzer:innen ausgerichtet, sondern als Gedächtnisstütze für künftige
Weiterentwicklung — was wurde gebaut, warum, und welche Fallstricke gab es.

## 2026-07-16/17 — Takte pro Zeile, Gehörbildungsmodus, diverse Fixes

### Takte pro Zeile (`measuresPerLine`)

Verovio hat keine native "N Takte pro Zeile"-Option (nur breitenbasiertes
Auto-Layout oder encodierte `<sb/>`/`<pb/>`-Umbrüche). Neuer Editor-Regler
(0 = Automatisch/Default, 1–16 = feste Taktanzahl), der bei aktivem Wert
selbst `<sb/>`-Elemente in die MEI-Daten injiziert:

- `src/mei-layout-utils.js` — `applyMeasuresPerLine()`, reine DOM-Funktion
  (DOMParser/XMLSerializer), entfernt vorhandene `<sb/>`/`<pb/>` und fügt
  neue nach jedem N-ten Takt ein. Zählung läuft durchgehend über
  Section-/Ending-/mdiv-Grenzen (keine Sonderbehandlung von Wiederholungen/
  Auftakten — bekannte v1-Einschränkung).
- `src/mei-document.js` cached den rohen MEI-Text zusätzlich zur URL
  (`lastRawMeiData`-Ref), damit ein reiner Regler-Wechsel kein neues
  Netzwerk-Fetch auslöst, aber trotzdem `toolkit.loadData()` (nicht nur
  `redoLayout()`) durchführt.

### Gehörbildungsmodus (Stimme hervorheben: Farbe + Wiedergabe)

Neuer, standardmäßig deaktivierter Editor-Bereich (`playbackEnabled`,
Switch), der eine Stimme farblich markiert (`highlightColor`, per
`ColorPicker`, Default `#00ff00`) und akustisch hervorhebt.

**Architektur:**
- `src/mei-voice-utils.js` — `extractVoices()` (Editor: Stimmen-Dropdown,
  liest Staff/Layer + `<label>` aus der Rohdatei), `countNotes()`
  (Größen-Check), `buildVoiceInfoByNoteId()`/`buildNoteEvents()` (Display:
  laufen gegen `toolkit.getMEI()`, **nicht** die Rohdatei — Verovio vergibt
  fehlende `xml:id`s automatisch, nur `getMEI()` enthält garantiert
  dieselben IDs wie `renderToTimemap()`/`renderToSVG()`-Output).
- `src/mei-document.js` berechnet Note-Events/Stimmen-Zuordnung im
  bestehenden Lade-Effekt (nicht in einer separaten Komponente — der
  Verovio-Toolkit ist ein modulweites Singleton, ein zweiter unabhängiger
  Zugriff würde mit dem angezeigten Inhalt kollidieren) und färbt die
  gewählte Stimme per Post-Render-DOM-Pass ein (Inline-Style `fill`/
  `stroke`, nicht CSS-Klasse — Farbe ist pro Dokument konfigurierbar).
- `src/mei-playback.js` — kopiert die Struktur von
  `@educandu/educandu/components/abc-player.js` (Offline-Rendering zu
  WAV-Blob → bestehender `MediaPlayer` mit Seek/Loop/Download/
  Playback-Rate). Instrument: `smplr`s `SplendidGrandPiano` (aktiv
  gepflegt, im Gegensatz zum veralteten `soundfont-player`).
  Sample-Fetch (externe Ressource, `smpldsnds.github.io`) passiert
  bewusst erst nach Klick auf "Play", nie automatisch — DSGVO-Erwägung,
  gleicher Standard wie beim schon vorhandenen `abc-player` (lädt von
  `educandu.github.io`).

**Zwei nicht-offensichtliche Bugs unterwegs gefunden und gefixt:**
1. **Nur eine Note hörbar, dann Stille:** `smplr`s Standard-Scheduler
   dispatcht nur Events innerhalb eines kurzen (200ms) Echtzeit-Lookahead-
   Fensters sofort; alles Spätere landet in einer Warteschlange, die per
   `setInterval` gegen `context.currentTime` abgeglichen wird. Bei
   `renderOffline()` läuft die Zeit nicht in Echtzeit — die Warteschlange
   holt nie auf. Fix: eigener `Scheduler` mit `lookaheadMs`, das die
   gesamte Stückdauer abdeckt, wird der Piano-Instanz mitgegeben.
2. **Sehr lange Ladezeit bei großen Stücken:** `SplendidGrandPiano` lädt
   sonst den vollen Tonumfang + alle Velocity-Layer. Fix: `notesToLoad`
   auf die im Stück tatsächlich vorkommenden Tonhöhen + nur die zwei
   verwendeten Velocity-Stufen beschränkt.

**Sicherheitsgrenze:** `MAX_NOTE_COUNT_FOR_PLAYBACK` (800, grober
Schätzwert, in `constants.js` leicht anpassbar) — oberhalb dieser
Notenzahl wird die Wiedergabe deaktiviert (mit Erklärung statt endlosem
Laden), Anzeige und Farbmarkierung bleiben unberührt. Editor warnt schon
vorher analog zur bestehenden Dateigrößen-Warnung.

### Bugfixes an bestehender Funktionalität

- **CORS-Bug bei externen Dateien:** Alle drei Fetch-Stellen (Anzeige,
  Editor-Dateigrößen-Check, Editor-Stimmenerkennung) haben pauschal
  `withCredentials: true` gesendet. Nach CORS-Spezifikation blockieren
  Browser aber jede credentialed Anfrage gegen eine Antwort mit
  `Access-Control-Allow-Origin: *` (Wildcard) — eine sehr verbreitete
  Konfiguration bei offenen externen Angeboten (z.B. Bach Digital). Fix:
  `withCredentials`/`credentials` wird jetzt per
  `isInternalSourceType({ url, cdnRootUrl })` bestimmt (Cookies nur für
  eigene CDN-Inhalte) — Muster aus dem educandu-Core übernommen
  (`media-player.js`, `pdf-viewer-display.js` u.a. machen das schon so).
- **Bessere Fehlermeldung:** Verovio meldet den genauen Grund eines
  fehlgeschlagenen `loadData()` (z.B. "No `<body>` element found in the
  MEI data") nur über `console.error`/`console.warn`, nicht über
  Rückgabewert oder Exception. `mei-document.js` fängt das jetzt ab
  (`captureVerovioMessages()`, temporäre Console-Interception um den
  `loadData()`-Aufruf) und zeigt es zusätzlich zur generischen
  Fehlermeldung an. Ausgelöst durch eine Bach-Digital-Datei, die zwar
  valides MEI-XML war, aber ein leeres `<music/>`-Element hatte
  (Werk-Datensatz ohne hinterlegte Transkription).

### Sonstiges

- `jsdom` als Dev-Dependency (Unit-Tests für DOM-basierte Utilities,
  `// @vitest-environment jsdom` nur in den betroffenen Spec-Dateien).
- `smplr` als Runtime-Dependency (lazy per `import()`, wie Verovio selbst).
- `/assets/**` in `.gitignore` — lokaler Ablageort für Test-MEI-Dateien,
  nie Teil des Repos.

### TODO für eine kommende Sitzung

- **Tempo-/Geschwindigkeitsänderung bei der Wiedergabe:** `MediaPlayer`
  wird bereits mit `allowPlaybackRate` eingebunden — die Standard-Player-
  Steuerung bringt dafür schon eine fertige Auswahl mit (`MEDIA_PLAYBACK_RATES`
  in `@educandu/educandu/domain/constants.js`: 0.25×–2×, feine Stufen um 1×),
  läuft über die browsernative `playbackRate` (i.d.R. tonhöhenerhaltend).
  Vermutlich funktioniert das schon ohne weiteren Code — **noch nicht im
  Browser bestätigt**, das ist der offene Punkt für nächstes Mal.

### Bewusst nicht umgesetzt

- **XML ansehen/bearbeiten im Editor** (für Nutzer:innen mit MEI-Kenntnissen):
  durchdacht und explizit verworfen. Echtes Bearbeiten+Zurückspeichern
  bräuchte Schreibzugriff auf den CDN/Upload, den das Plugin nicht hat —
  spürbar größerer Scope als bisher. Eine reine Nur-Lese-Ansicht wurde
  ebenfalls verworfen: der Diagnosenutzen ("warum lädt das nicht") ist
  durch die neue detaillierte Fehlermeldung bereits abgedeckt, und wer die
  Datei sowieso schon hat (hochgeladen oder externe URL), kann sie genauso
  gut am Original ansehen — eine Kopie im Plugin hätte keinen
  eigenständigen Mehrwert gehabt.
