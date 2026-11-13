# Drehpunkt – Meine Zeit

## Zugänge

- [PWA für Mitarbeiter](https://db-bpl-drehpunkt-time.web.app) mit der bestehenden Drehpunkt-Produktionsanmeldung.
- [PWA für Dev-Tests](https://db-bpl-drehpunkt-dev-time.web.app) und [Drehpunkt Dev](https://dev.drehpunktlogistik.de/zeiterfassung) mit einem bestehenden Dev-Konto.

Die Zeiterfassung verwendet in jeder Umgebung die vorhandenen Drehpunkt-Konten
und dieselbe Firestore-Datenbank wie das jeweilige Drehpunkt-Web.

Vor dem fachlichen Test müssen Arbeitszeitmodell, Kontostart/Anfangssaldo und
bei Urlaubstests der Urlaubsanspruch für den jeweiligen Mitarbeiter in Drehpunkt
eingerichtet werden. Stempeln erfordert das Modulrecht `timeTracking: edit`.
Für die Abnahme auf dem Handy die zum Testkonto passende URL öffnen.

Mobile PWA für die tägliche Zeiterfassung und eigene Urlaubsangelegenheiten. Das Backend bleibt im Repository `CornerDesign-Dominic/bpldrehpunkt`, die PWA verwendet **dieselbe Firebase Authentication und dieselbe Firestore-Datenbank `(default)`**. Dieses Repository enthält keine zweite Datenbank und keinen eigenen Benutzerbestand.

## Lokal starten

Voraussetzung: Node.js 22.12 oder neuer.

Node.js 22 LTS wird unterstützt; die Installation verwendet die versionierte `package-lock.json`.

```powershell
npm ci
Copy-Item .env.example .env.local
# .env.local mit der Firebase-Webkonfiguration der Entwicklungsumgebung ergänzen
npm run dev
```

Ohne Firebase-Konfiguration erscheint eine Einrichtungsansicht. Es werden keine Beispieldaten oder künstlichen Zeitkonten in produktiven Abläufen verwendet. Für echte Funktionstests werden die zugehörigen neuen Backend-Functions, Rules und Indizes aus dem Drehpunkt-Entwicklungsbranch benötigt.

## Firebase und Veröffentlichung

- Die sechs `VITE_FIREBASE_*` Werte stammen aus einer Firebase-Web-App **im selben Projekt** wie Drehpunkt. Eine eigene Web-App-Registrierung für die PWA ist möglich; Projekt und Benutzerkonten bleiben gemeinsam. Keine Service-Account-Schlüssel oder Admin-Zugangsdaten im Browser hinterlegen.
- Den PWA-Host bei Firebase Authentication als autorisierte Domain und bei App Check/reCAPTCHA Enterprise korrekt registrieren. `VITE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY` setzen. Die neuen Callables erzwingen App Check; ohne gültige Attestierung funktionieren die Serveraufrufe nicht.
- Für das Projekt `db-bpl-drehpunkt-dev` aktiviert die PWA auf `localhost`, `127.0.0.1` und IPv6-Loopback den offiziellen App-Check-Debug-Provider. Das gilt auch für den gebauten lokalen Preview, damit Offline-Tests möglich sind. Firebase erstellt den Debug-Token im Browser. Diesen ausschließlich beim verwendeten Dev-Web-App-Eintrag in Firebase App Check freigeben. Keine Debug-Tokens in Dateien, Build-Variablen oder das Repository schreiben. Bei anderen Projekten und auf veröffentlichten Domains bleibt der Debug-Provider aus.
- Gleiche Anmeldung bedeutet gleiche E-Mail und gleiches Passwort. Sitzungen werden über unterschiedliche Webdomains nicht automatisch geteilt.
- `npm run build` erzeugt `dist/`. Auf einem HTTPS-Host mit Rückfall auf `index.html` bereitstellen. Für lokale Tests: `npm run preview`. Service Worker sind nur im Produktionsbuild aktiv. `sw.js` sollte vom Host mit `Cache-Control: no-cache` ausgeliefert werden.
- Keine Hosting-, Firebase-, Benutzer- oder GitHub-Produktionsänderungen werden durch den lokalen Build vorgenommen.

### Lokaler Test gegen Firebase Dev

1. `.env.local` mit der Webkonfiguration aus **`db-bpl-drehpunkt-dev`** und dem dazugehörigen App-Check-Site-Key füllen. Die PWA nutzt die vorhandenen Dev-Benutzerkonten.
2. Für den normalen Entwicklungsablauf `npm run dev -- --port 5174 --strictPort` ausführen und `http://127.0.0.1:5174/` öffnen. Den lokal erzeugten Debug-Token ausschließlich in App Check der verwendeten Dev-Web-App registrieren. `localhost`/`127.0.0.1` müssen zur lokalen Auth-Konfiguration passen.
3. Für Installation und Offline-Neustart `npm run build` und anschließend `npm run preview -- --port 4174 --strictPort` ausführen. `http://127.0.0.1:4174/` einmal online öffnen und die Aktivierung des Service Workers abwarten. Eine Vite-Dev-Seite stellt keinen Offline-Service-Worker bereit.
4. Mit einem aktiven Dev-Mitarbeiter anmelden, der `timeTracking: edit` besitzt. Der Superadmin richtet vorher Arbeitszeitmodell und Zeitkontobeginn in Drehpunkt Dev ein. Urlaub benötigt zusätzlich das bestehende Urlaubsrecht.
5. Offline stempeln, die gebaute PWA neu öffnen und die wartenden Buchungen prüfen. Nach wiederhergestellter Verbindung müssen die Buchungen als übertragen erscheinen. Korrekturen und Urlaub bleiben offline gesperrt.

Loopback-HTTP kann auf demselben Rechner für Service-Worker-Tests verwendet werden. Ein Handy erreicht den Rechner über eine Netzwerk-IP; dafür ist ein passend registrierter HTTPS-Dev-Host mit regulärem App Check erforderlich. Die Loopback-Debugfreigabe wird nicht auf LAN-Adressen ausgeweitet.

### Firebase-Hosting für den Dev-Test

Die Hosting-Konfiguration ist ausdrücklich auf die Site `db-bpl-drehpunkt-dev-time` im Projekt `db-bpl-drehpunkt-dev` beschränkt. Die vorgesehene Testadresse ist `https://db-bpl-drehpunkt-dev-time.web.app`. Dieser Konfigurationseintrag allein bestätigt noch keine Veröffentlichung.

```powershell
npm run build:dev
firebase deploy --only hosting --project db-bpl-drehpunkt-dev
```

Der Hosting-Predeploy führt `build:dev` erneut aus. Dieser Build prüft die effektiv von Vite aufgelöste Projekt-ID einschließlich bereits gesetzter Prozessvariablen und bricht bei einem anderen Projekt ab. `.firebaserc` besitzt nur den Alias `dev`, keinen automatischen Standard und keinen Produktionsalias. Hosting liefert ausschließlich `dist/`; `.env.local` und andere versteckte Dateien werden nicht hochgeladen.

`dist/firebase-target.json` enthält nach erfolgreichem Dev-Build die öffentliche Projekt-ID, App-ID und Buildzeit zur Zuordnungsprüfung. HTML, Manifest, Service Worker und diese Zuordnungsdatei werden ohne Browser-Cache ausgeliefert. Fingerprintete Assets können dauerhaft gecacht werden. SPA-Adressen fallen auf `index.html` zurück.

### Firebase-Hosting für Produktion

Die Produktions-PWA hat eine eigene Firebase-Web-App und eine eigene
Hosting-Site im bestehenden Projekt `db-bpl-drehpunkt`. Der zugehörige
reCAPTCHA-Enterprise-Schlüssel gilt für die Hosts der Produktions-PWA.
Für die Veröffentlichung die öffentliche SDK-Konfiguration dieser Web-App
einschließlich App-Check-Site-Key in die ignorierte Datei
`.env.production-pwa.local` eintragen. Die Namen der Felder stehen in
`.env.example`.

```powershell
npm run build:prod
firebase deploy --config firebase.prod.json --only hosting --project db-bpl-drehpunkt
```

Der Produktionsbuild prüft Firebase-Projekt, Web-App-ID, Auth-Domain und
App-Check-Konfiguration und schreibt in `dist-production/`. Diese Ausgabe
wird ausschließlich an die Site `db-bpl-drehpunkt-time` veröffentlicht.
Die Drehpunkt-Functions, Firestore-Regeln und Indizes werden über das
Repository `bpldrehpunkt` bereitgestellt.

## Funktionsumfang

- Eigenes Konto, aktive Drehpunkt-Profile und bestehende Modulrechte: `timeTracking: view/edit`, `vacation: view/edit`; Superadmins sehen in der PWA ebenfalls nur ihre eigenen Daten.
- Kommen, Pause starten/beenden und Gehen; Wochenübersicht mit Ist-/Sollstunden, heutige Buchungen, Monatsliste und Gesamtsaldo.
- Tatsächliche Pausen und zusätzlicher rechnerischer Pausenabzug getrennt. Berechnungen und Arbeitszeitmodelle kommen ausschließlich vom gemeinsamen Backend.
- Nachträge/Korrekturen online für heute und die vergangenen sieben Berliner Kalendertage; Pflichtauswahl des Grunds, optionaler Kommentar. Revisionsprüfung verhindert das Überschreiben zwischenzeitlicher Webänderungen.
- Eigener Urlaub: Resturlaub, Anträge, Status/Verlauf, offene Anträge überarbeiten oder zurückziehen, Änderungen/Storno genehmigter Anträge beantragen. 0,5-Tages-Schritte und Zuordnung des halben Urlaubstags bei mehrtägigen Zeiträumen. Die anfängliche Tagesanzahl ist als Mo–Fr-Vorschlag gekennzeichnet und kann bei abweichendem Arbeitsmodell angepasst werden.
- Keine Verwaltungsoberflächen, Krankmeldung, Push- oder E-Mail-Erinnerungen. Arbeitszeitmodelle werden ausschließlich vom Superadmin in Drehpunkt gepflegt.

## Offline und Datenschutz auf dem Gerät

### Auf dem Handy installieren

Den QR-Code im Drehpunkt-Webdashboard beziehungsweise unter „Meine Arbeitszeit“
scannen und die PWA einmal im mobilen Browser öffnen. Unter **Konto → Auf dem
Startbildschirm** zeigt die PWA den Button **App installieren**, sobald der
Browser den Installationsdialog unterstützt und freigibt. Eine angenommene
Installationsanfrage wird erst nach Browserbestätigung als installiert angezeigt.

Auf iPhone/iPad: in Safari **Teilen → Zum Home-Bildschirm → Hinzufügen** wählen.
Auf Android: alternativ im Browsermenü **App installieren** oder **Zum
Startbildschirm hinzufügen**. Falls ein eingebetteter Browser keinen solchen
Menüpunkt anbietet, dieselbe Seite in Safari, Chrome oder Edge öffnen. Der
Installationshinweis kann ausgeblendet und im Konto wieder geöffnet werden.

Die Installation ändert weder Anmeldung noch die auf dem Gerät gespeicherten
Zeitstempel. Vor dem ersten Offline-Einsatz einmal online anmelden und laden.

Nur Zeitstempel funktionieren offline. Einmal online anmelden und den Produktionsbuild vollständig laden, bevor Offline-Stempeln möglich ist. Der Service Worker speichert die Anwendungsdateien einschließlich fingerprinteter JS-/CSS-Dateien. Er speichert keine Firebase-, Auth- oder API-Antworten.

Stempel werden **vor Anzeige einer Erfolgsbestätigung** in IndexedDB gespeichert und bekommen eine unveränderliche ID. Eine eigene, auf das Nutzerkonto begrenzte Warteschlange synchronisiert beim Öffnen, bei wiederkehrender Verbindung und im laufenden Betrieb. Übertragung ist idempotent. Auch ursprünglich online erfasste Buchungen werden bei späterer Übertragung als verzögert gekennzeichnet. Mehrere Tabs desselben Kontos synchronisieren bei unterstützten Browsern unter einem Web Lock.

Die App unterscheidet „auf diesem Gerät gespeichert“ und „übertragen“. Fehler oder Konflikte bleiben sichtbar und werden nicht gelöscht; ein Konflikt blockiert nur die nachfolgenden Buchungen desselben Tages. Bereits im Web geklärte Buchungen können nach ausdrücklicher Bestätigung lokal archiviert werden. Der ursprüngliche lokale Beleg bleibt im Konto unter „Lokal geklärte Buchungen“ sichtbar.

Bestätigt der Server einen Stempel, bevor die Zeitübersicht aktualisiert werden kann, bleibt er bis zum nächsten passenden Übersichtsabgleich lokal im Tagesverlauf sichtbar. Der bestätigte Stempel wird nicht erneut gesendet. Die App entfernt den lokalen Bestätigungsbeleg zusammen mit der Speicherung der aktualisierten Übersicht.

Für Offlinebetrieb speichert IndexedDB zusätzlich die letzte eigene Zeitübersicht und minimale Anmelde-/Rechteinformationen. Urlaubs- und Personaldaten werden nicht für den Offlinezugriff gespeichert. Eine Offline-Rechteauskunft ist naturgemäß der zuletzt bestätigte Stand; das Backend überprüft bei der Übertragung erneut Konto und Berechtigungen.

Die Warteschlange ist geräte- und browsergebunden: Browserdaten löschen, Privatmodus oder Speicherbereinigung können nicht übertragene Daten entfernen. Beim Abmelden bleibt die Warteschlange dem ursprünglichen Konto zugeordnet; sie wird niemals mit einem anderen Konto übertragen. Auf gemeinsam verwendeten Geräten deshalb eigene Browserprofile und Gerätesperren nutzen.

## Prüfung

```powershell
npm run lint
npm test
npm run build
```

Die automatisierten Tests prüfen IndexedDB-Transaktionen mit `fake-indexeddb`, Kontentrennung, Rechteentzug während eines Übersichtsabrufs, verlorene Serverbestätigungen, bestätigte Stempel bei abgebrochenem Übersichtsabruf, Konflikte zwischen Tagen, lokale Archivierung und Berliner Kalender-/Sommerzeitgrenzen. Die Abnahme auf einem echten Handy erfolgt gegen Firebase Dev.

Vor Freigabe mit echten Testkonten prüfen: Anmeldung/App Check, Rechteentzug, alle Urlaubsstatuswechsel, parallele Web-/Handy-Korrekturen, Offline-Neustart nach erstem Laden, Netzwerkabbruch zwischen Serverannahme und Antwort, Konfliktklärung und Wiederanmeldung mit einem anderen Konto. Ohne lokale Firebase-Konfiguration sind diese Integrationsprüfungen noch offen.

## Vorbereitete mobile Oberfläche (13.11.2026, noch nicht veröffentlicht)

Lokaler Arbeitsbranch: `codex/mobile-time-overview`. Keine Änderung am Backend,
keine Veröffentlichung an Dev oder Produktion. Die bestehende Stempel- und
Offline-Warteschlange wird weiterverwendet.

- Arbeitsstatus statt Online-Anzeige im Kopf; Uhrzeit/Datum, danach Stempelaktionen.
- Eine kompakte Card mit den Reitern Heute, Woche und Gesamt. Keine Monats- oder
  Wochen-Buchungstabellen auf der Zeitseite.
- Tagespfeile erlauben ältere Tage, aber keine Zukunft. Ältere Tage außerhalb
  des geladenen Bereichs werden mit `ownOnly` separat angefragt. Offline gibt
  es für nicht geladene Tage einen Hinweis statt einer erfundenen leeren Liste.
- Einzelbuchungen chronologisch mit Stift; eigener Grund je Änderung/Nachtrag.
  Heute und die sieben vergangenen Berliner Kalendertage sind bearbeitbar.
  Ältere Tage bleiben lesbar. Löschen benötigt Mülleimer, Bestätigung und Grund.
- Das Backend erhält weiterhin die vollständige Tagesrevision. Nur die gewählte
  Buchung ändert sich; andere IDs und exakte Stempelzeiten bleiben erhalten.
  Revisionskonflikte erfordern Neuladen, fehlgeschlagener Übersichtsabgleich
  nach bestätigtem Speichern erlaubt kein erneutes Speichern derselben Änderung.
- Wochenbalken mit Pausenfarbe und Ist/Soll; Wochensaldo bis heute aus den
  bestehenden Tageswerten. Gesamt zeigt ausschließlich den Kontosaldo mit
  Plus/Minus und gegebenenfalls dem Hinweis auf einen vorläufigen Stand.

Lokale Prüfung: `npm test`, `npm run test:ui`, `npm run lint`, `npm run build`.
Der Build ohne Umgebungsdatei ist ausschließlich eine Kompilierungsprüfung;
es wurden keine Firebase-Zugriffe mit echten Konten und keine Deploys ausgeführt.
Vor der späteren Paketfreigabe folgt die Abnahme auf dem echten Handy gegen Dev.
