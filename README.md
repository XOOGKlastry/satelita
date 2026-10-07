# Warstwy Czasu

Aplikacja Leaflet do przeglądania archiwalnych zdjęć wybranego obszaru i pobierania ich do ZIP.

## Generator animacji

Link „Zrób animację” otwiera generator, który przyjmuje ZIP pobrany z aplikacji. Pliki są przetwarzane lokalnie w przeglądarce; generator tworzy animowany GIF oraz samodzielny plik HTML gotowy do umieszczenia w repozytorium jako osobna podstrona.

## Obsługa

1. Wyszukaj adres z podpowiedziami lub działkę po pełnym identyfikatorze. Obszar możesz też narysować przyciskiem u góry mapy.
2. Wybierz Esri albo Geoportal. Aplikacja pobiera podglądy i sprawdza odpowiedzi źródła.
3. Kliknij miniaturę, aby obejrzeć zdjęcie na mapie i w dużym podglądzie. Zdjęcia mają status: wczytywanie, dostępne, brak zdjęcia lub błąd wczytania. Błędną odpowiedź można ponowić.
4. Zaznacz dostępne zdjęcia pojedynczo lub zbiorczo i pobierz ZIP. Lista ma filtr i strony, więc nie wymaga przewijania całej galerii.

Cały interfejs używa jednej rodziny czcionek. Układ dopasowuje się do ekranu. Podgląd pokazuje ten sam podpisany PNG, który trafia do archiwum. Eksport wykorzystuje pamięć podręczną; nie pobiera ponownie zdjęć. PNG trafiają do ZIP bez dodatkowej kompresji.

## Źródła i daty

- Esri Wayback: historyczne wydania map. Jeśli dostępna jest data pozyskania zdjęcia dla środka obszaru, nazwa ma postać `esri_MM_RRRR.png`. W przeciwnym razie nazwa `esri_wydanie_MM_RRRR.png` wskazuje datę wydania mapy. Mozaika może zawierać zdjęcia z różnych dni.
- Geoportal GUGiK: archiwalne ortofotomapy WMS. Lata pochodzą z GetCapabilities. Rok zapytania nie potwierdza daty wykonania zdjęcia ani osobnego zdjęcia w każdym roku. Nazwy: `geoportal_RRRR.png`.
- Adresy: Uniwersalna Usługa Geokodowania GUGiK (UUG).
- Działki: ULDK GUGiK, wyłącznie pełny identyfikator. Dostępność zależy od danych EGiB.

WMS Geoportalu: https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolutionTime

GetMap używa EPSG:4326, zgodnie z możliwościami usługi sprawdzonymi 2026-10-06. Obraz jest dopasowywany do projekcji mapy Leaflet. Wszystkie zdjęcia w serii obejmują ten sam prostokąt. Przezroczyste oraz jednolicie białe/czarne odpowiedzi oznaczane są jako brak obrazu; awarie sieci lub dekodowania jako błąd, z możliwością ponowienia.

## Archiwum ZIP

- `zdjecia/`: wyłącznie wczytane, zaznaczone PNG.
- Plik TXT przy każdym zdjęciu: źródło, znaczenie daty, wydanie, adres źródła i granice obszaru.
- `obszar.json`: manifest eksportu.

Powtarzające się nazwy otrzymują numer, aby nie nadpisywać zdjęć.

## Uruchomienie

Uruchom przez HTTP, np. `python -m http.server 8000`, i otwórz http://localhost:8000.

GitHub Pages publikuje stronę po zmianie main. W Settings → Pages ustaw Build and deployment → Source: GitHub Actions.
