# Źródła archiwów
Sprawdzono katalogi i warunki źródeł: 2026-10-08. Aplikacja odczytuje aktualne możliwości usług w przeglądarce. Data pozyskania odpowiedzi i pełny URL zapytania trafiają do eksportu.

| Źródło | Usługa | Daty / układ |
| --- | --- | --- |
| Esri Wayback | https://livingatlas.arcgis.com/wayback/ | Lokalne zmiany w środku i narożnikach prostokąta; kafle EPSG:3857. Data ujęcia dla środka obszaru lub wyraźnie oznaczona data wydania. |
| Geoportal GUGiK | https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolutionTime | GetCapabilities, GetMap EPSG:4326 i przeliczenie wierszy do Mercatora. Rok zapytania nie potwierdza daty zdjęcia. |
| EOX Sentinel-2 | https://tiles.maps.eox.at/wms | Warstwy s2cloudless w EPSG:3857; katalog oferuje 2016 oraz 2018–2025. Pominięta osobna warstwa 2017: brak osobnego roku w publicznym opisie licencji. |

EOX: https://cloudless.eox.at/license-non-commercial — 2016 CC BY 4.0; 2018–2025 CC BY-NC-SA 4.0. Atrybucja widoczna na mapie oraz zapisana w PNG i metadanych. Eksportowane PNG są wycinkami z podpisem, a nie oryginalnymi produktami pomiarowymi. Licencja kodu nie zmienia licencji danych.


Puste obrazy i błędy są rozróżniane. Manifest ZIP podaje liczbę i listę wyeksportowanych zdjęć oraz pominięte odpowiedzi. Wszystkie podglądy mają te same granice w EPSG:4326, renderowane w EPSG:3857. Mozaiki roczne mają inną rozdzielczość i sposób złożenia niż ortofotomapy, dlatego sam rok nie dowodzi porównywalności obserwacji.
