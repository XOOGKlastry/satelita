# Warstwy Czasu

Aplikacja Leaflet do przeglądania archiwalnych zdjęć wybranego obszaru i pobierania ich do ZIP.

## Generator animacji

Krok 3 „Zrób animację” otwiera generator wewnątrz strony i automatycznie przekazuje zaznaczone zdjęcia z kroku 2. Generator przyjmuje również ZIP z komputera. Pliki są przetwarzane lokalnie w przeglądarce; generator tworzy animowany GIF oraz samodzielny plik HTML gotowy do umieszczenia w repozytorium jako osobna podstrona. W HTML można zatrzymać/wznowić pokaz, przechodzić między klatkami i przewijać suwak. Identyczne zdjęcia są porównywane bez stopki z podpisem; przy powtórzeniach zostaje najstarsza data.

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

## Dodatkowe archiwa szczegółowych ortofotomap

Geoportal HD: osobna usługa archiwalna ortofotomapy wysokiej rozdzielczości (HighResolutionTime). Dostępne lata odczytujemy z katalogu WMS; rok oznacza zapytanie czasu, nie potwierdzoną datę nalotu. Brak obrazu w danym obszarze jest pokazywany w galerii.

Poznań GEOPOZ: miejskie archiwum ortofotomap RGB, z dwóch publicznych usług WMS. Warstwy i roczniki pochodzą z katalogów; zdjęcia są dostępne tylko w zasięgu danej warstwy. Poza zasięgiem nie wysyłamy GetMap. Miesiąc nie jest dopisywany, jeśli katalog go nie podaje. Dostępne także starsze zdjęcia lotnicze; ich szczegółowość zależy od roku. Dane przypisujemy GEOPOZ i zapisujemy warunki CC BY 4.0.

Duży przycisk „Pobierz wszystkie możliwe” sprawdza Esri, Geoportal, Geoportal HD i Poznań, po czym pobiera jeden ZIP ze wczytanymi obrazami. Nie zależy od filtra ani ręcznego zaznaczenia. Gotowe podglądy bieżącego źródła są używane ponownie. Braki i błędy nie blokują reszty; raport jest w obszar.json. Zmiana obszaru anuluje poprzednie zadanie. Nazwy: geoportal_hd_RRRR.png, poznan_RRRR.png (numery przy kilku warstwach z tego samego roku). ZIP zawiera ZRODLA-I-LICENCJE.txt. Nie ma źródeł z mozaikami satelitarnymi o rozdzielczości dziesiątek metrów.

## Trzy kroki i porównywanie zdjęć

1. Wybierz obszar: osobny panel adresu i działki, rysowanie na mapie, przejście do analizy lub bezpośrednie pobranie wszystkich możliwych zdjęć.
2. Analizuj i pobierz: mapa pośrodku, po lewej stos warstw i podgląd, po prawej galeria i eksport. Wybierz miniaturę i kliknij „Nałóż wybrane zdjęcie”. Każde zdjęcie ma osobną przezroczystość (0% = pełna widoczność), widoczność, kolejność i usuwanie. Warstwy porównania pozostają po zmianie źródła, lecz są usuwane po zmianie obszaru. Eksport i animacja używają oryginalnych podpisanych zdjęć zaznaczonych w galerii.
3. Zrób animację: wybrane zdjęcia trafiają automatycznie do generatora w tej samej stronie. Można wrócić do analizy. Pliki GIF i samodzielny HTML pobiera się z generatora. Zmiana obszaru resetuje poprzednią animację.

Układ komputerowy mieści się w wysokości okna. Długi stos warstw przewija się we własnym panelu; na telefonie panele są ustawione pionowo. Dane do animacji są przekazywane lokalnie pomiędzy stronami tego samego pochodzenia.
