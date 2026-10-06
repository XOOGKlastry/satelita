# Warstwy Czasu

Aplikacja Leaflet do przeglądania archiwalnych zdjęć dla wybranego obszaru. Wyszukaj adres lub działkę, narysuj prostokąt, wybierz archiwum i pobierz wybrane zrzuty mapy do ZIP. Listę ujęć można filtrować i zaznaczać zbiorczo.

## Źródła

- Esri Wayback: archiwalne wydania map. Nazwy plików: esri_MM_RRRR.png.
- Geoportal: archiwalne ortofotomapy GUGiK. Lista czasu to zakres zapytań do WMS; nie gwarantuje osobnego zdjęcia każdego roku. Nazwy: geoportal_RRRR.png.
- Adresy: Uniwersalna Usługa Geokodowania GUGiK (UUG).
- Działki: usługa lokalizacji działek ewidencyjnych GUGiK (ULDK); wyszukiwanie po identyfikatorze albo nazwie obrębu i numerze. Pokrycie zależy od dostępności danych EGiB w powiecie.

ZIP zawiera PNG widoku mapy, pliki tekstowe ze źródłem oraz obszar.txt. Uruchom przez HTTP, np. python -m http.server 8000, i otwórz http://localhost:8000.

GitHub Pages workflow publikuje stronę po zmianie main. W Settings → Pages ustaw Build and deployment → Source: GitHub Actions.

