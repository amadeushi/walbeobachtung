# Walbeobachtung

Interaktives Wahldashboard für die Kommunalwahlen in Stadt und Landkreis Hildesheim. Die Anwendung verbindet amtliche Open-Data- und VoteManager-Ergebnisse, historische Vergleichsdaten, Sitzprojektionen sowie eine für 16:9-Leinwände optimierte Wahlabendansicht.

## Entwicklung

```bash
npm install
npm run dev
```

## Produktion

```bash
npm run build
```

Die für klassischen Webspace vorbereitete Fassung liegt in `selfhost/`. Ihr PHP-Endpunkt ruft die amtlichen Wahldaten serverseitig ab und hält den letzten erfolgreichen Stand als Ausfallsicherung vor.

## Datenquellen

- Landkreis Hildesheim: amtliche Wahlpräsentation und Open Data
- Stadt Hildesheim: amtliche Wahlpräsentation und Open Data
- Historische, im Projekt dokumentierte Archive für die Kommunalwahlen 2011, 2016 und 2021

Zwischenstände und Sitzberechnungen sind bis zur Feststellung durch den jeweiligen Wahlausschuss nicht amtlich.
