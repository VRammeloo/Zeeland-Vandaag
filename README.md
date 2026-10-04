# Zeeland Vandaag

Een lichtgewicht, statische web-app met een dagoverzicht van het lokale nieuws in de provincie Zeeland. Geen build-stap, geen frameworks, geen database — alleen `index.html`, `styles.css`, `app.js` en een optionele RSS-proxy.

## Wat het doet

- Haalt nieuws op uit openbare RSS-feeds van Zeeuwse bronnen (Omroep Zeeland, PZC, BN DeStem, HVZeeland, Provincie Zeeland).
- Groepeert berichten per dag (vandaag + terugbladeren tot 3 dagen).
- Toont een samenvatting bovenaan: aantal berichten per bron.
- Filteren op bron en zoeken in titels en samenvattingen.
- Cache van 15 minuten in `localStorage`, plus een handmatige verversknop.
- Elk bericht opent het volledige artikel bij de originele bron (in een nieuw tabblad).

## Installatie op rammeloo.eu

1. Upload alle bestanden naar een map op je webserver, bijvoorbeeld `https://rammeloo.eu/zeeland/`.
   - `index.html`, `styles.css`, `app.js`
   - `rss-proxy.php` — alleen nodig als je server PHP ondersteunt (aanbevolen)
2. Zorg dat de app in de modus `PROXY_MODE = "self"` staat (standaard) in `app.js`.
3. Open de pagina in je browser — klaar.

### Als je host géén PHP heeft

Zet in `app.js` bovenaan:

```js
var PROXY_MODE = "public";
```

De app gebruikt dan een publieke CORS-proxy. Dat werkt zonder configuratie, maar is minder betrouwbaar en afhankelijk van een derde partij. Voor een eigen domein is de PHP-proxy (of een gelijkwaardig klein server-script) de betere keuze: alle verzoeken blijven dan binnen je eigen domein.

### Andere proxies

Gebruik je bijv. een Node-server, dan is het equivalent van `rss-proxy.php` een klein endpoint dat de feed-url van een whitelist ophaalt en de XML teruggeeft. Het enige wat de app verwacht is: `GET <proxy>?url=<encoded-feed-url>` die de RSS/XML-body teruggeeft.

## Feeds aanpassen

Bewerk de `FEEDS`-lijst bovenaan in `app.js` en voeg desgewenst het domein toe aan de whitelist in `rss-proxy.php`.

## Bestanden

| Bestand | Functie |
| --- | --- |
| `index.html` | Structuur van de pagina |
| `styles.css` | Stijl (licht thema, mobiel-vriendelijk) |
| `app.js` | Logica: feeds ophalen, dagen groeperen, filters, cache |
| `rss-proxy.php` | Optionele self-hosted RSS-proxy (PHP) |

## Lokaal testen

Open `index.html` niet direct als `file://` (fetch werkt dan niet). Start een lokale server in deze map, bijvoorbeeld:

```bash
php -S localhost:8080
# of
python3 -m http.server 8080
```

en ga naar `http://localhost:8080`.
