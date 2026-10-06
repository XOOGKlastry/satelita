# Warstwy Czasu

Statyczna aplikacja Leaflet do porównywania dostępnych archiwalnych zdjęć dla wybranego obszaru. Narysuj prostokąt, wybierz Esri Wayback lub Geoportal, zaznacz wiele pozycji i pobierz zrzuty widoku mapy do ZIP. Lista obsługuje wyszukiwanie oraz zaznaczanie/odznaczanie wszystkich widocznych wyników.

## Źródła historyczne

- Esri Wayback: archiwalne wydania wyszukiwane wokół obszaru. Data wydania może różnić się od daty pozyskania zdjęcia; ta ostatnia jest pokazywana, gdy metadane są dostępne. Nazwy: esri_MM_RRRR.png.
- Geoportal: archiwalny WMS GUGiK StandardResolutionTime. Aplikacja wysyła zapytania czasu w zakresie 1995–2025. Lista lat nie gwarantuje osobnego zdjęcia z każdego roku; WMS może zwrócić najbliższe dostępne ujęcie. Nazwy: geoportal_RRRR.png.
- Google Earth: widok historyczny z osią czasu jest dostępny w Google Earth Pro (instrukcja: https://support.google.com/earth/answer/148094?hl=pl). Google Earth API zostało wycofane (https://developers.google.com/earth), więc historycznej osi Google Earth nie da się podłączyć do tej aplikacji Leaflet. Klucz Google Maps Tile API udostępniałby tylko bieżące kafelki, dlatego aplikacja nie wymaga ani nie zapisuje klucza.

## Zrzuty i uruchomienie

ZIP zawiera PNG widoku mapy, tekstowe informacje o źródle i obszar.txt. Włączona warstwa archiwalna jest widoczna podczas zrzutu. Podaj index.html przez HTTP, np. python -m http.server 8000, a następnie otwórz http://localhost:8000.

Biblioteki Leaflet, Leaflet Draw, JSZip, html2canvas i wayback-core są pobierane z CDN.

## GitHub Pages

Repozytorium XOOGKlastry/satelita jest publiczne. Workflow .github/workflows/pages.yml publikuje stronę przy zmianach w main. W ustawieniach repozytorium wybierz Settings → Pages → Build and deployment → Source: GitHub Actions.

