# Warstwy Czasu

Statyczna aplikacja Leaflet. Zaznacz prostokąt, wybierz źródło i pobierz widok mapy dla dostępnych wydań i lat do ZIP. Każdy zrzut zawiera widoczny zasięg mapy, warstwę, datę oraz oznaczenie źródła.

Listę pozycji można przeszukiwać po roku/dacie; przyciski zaznaczają lub odznaczają wszystkie aktualnie widoczne wyniki.

## Źródła

- **Esri Wayback:** archiwalne wydania. Aplikacja wyszukuje wydania ze zmianami w pobliżu zaznaczenia i sprawdza datę pozyskania zdjęcia w punkcie centralnym. Pliki mają nazwy `esri_MM_RRRR.png`.
- **Geoportal:** WMS archiwalnych ortofotomap GUGiK (`StandardResolutionTime`). Lista lat jest zakresem zapytań czasu; nie oznacza, że istnieje inne zdjęcie dla każdego roku. WMS może zwrócić najbliższe dostępne ujęcie. Pliki mają nazwy `geoportal_RRRR.png`.
- **Google Satellite:** bieżąca warstwa wyłącznie do podglądu. Google Maps Tile API wymaga własnego klucza, włączonego API i rozliczeń. Google nie udostępnia przez to API archiwum historycznych zdjęć Google Earth. Kafelki Google nie są zapisywane do ZIP: zasady API ograniczają przechowywanie, pobieranie i użycie offline.

Klucz Google wpisany przyciskiem w interfejsie jest przechowywany lokalnie w `localStorage` przeglądarki i nie trafia do repozytorium. To klucz przeglądarkowy, a nie poufny sekret: ogranicz go w Google Cloud do Maps Tile API i domeny aplikacji. Użytkownicy Google muszą mieć własny klucz albo korzystać z przeglądarki, w której klucz jest zapisany.

### Utworzenie klucza Google

1. W [Google Cloud Console](https://console.cloud.google.com/projectcreate) utwórz projekt albo wybierz istniejący. W projekcie musi być włączone rozliczanie.
2. Otwórz [Map Tiles API](https://console.cloud.google.com/marketplace/product/google/tile.googleapis.com) i kliknij **Włącz**.
3. W [Google Maps Platform → Credentials](https://console.cloud.google.com/google/maps-apis/credentials) wybierz **Utwórz dane logowania → Klucz API**.
4. W ograniczeniach klucza ustaw aplikację jako **Witryny**, dodaj `https://xoogklastry.github.io/*`, a w ograniczeniach API wybierz tylko **Map Tiles API** (`tile.googleapis.com`). Do lokalnych testów dodaj `http://localhost:8000/*`.
5. Skopiuj klucz i wklej go przez przycisk **Ustaw klucz Google** w aplikacji. Ustaw dzienny limit zapytań i kontroluj koszty w Cloud Console.

## Zrzuty i uruchomienie

ZIP zawiera PNG zrzutów widocznego okna mapy, pliki tekstowe z informacją o źródle oraz `obszar.txt`. Warstwa Esri i Geoportal są pobierane przed zrzutem; biblioteka html2canvas składa widok w PNG. Dla działania uruchom `index.html` przez HTTP, np. `python -m http.server 8000`, a potem otwórz `http://localhost:8000`.

Biblioteki Leaflet, Leaflet Draw, JSZip, html2canvas i wayback-core są pobierane z CDN.

## Dostęp na GitHub

Repozytorium `satelita` konta `XOOGKlastry` jest publiczne, więc opublikowany tam kod będzie widoczny dla wszystkich. Zwykłe GitHub Pages również są publiczne, nawet gdy repo jest prywatne. Ograniczony dostęp do Pages jest dostępny dla stron projektowych z prywatnych repozytoriów organizacji, przy odpowiednim planie i konfiguracji.

Workflow `.github/workflows/pages.yml` publikuje stronę na GitHub Pages przy zmianach w `main`. Włącz GitHub Pages w ustawieniach repozytorium, wybierając jako źródło `GitHub Actions`.
