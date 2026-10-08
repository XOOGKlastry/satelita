# Źródła archiwów ortofotomap

Sprawdzono katalogi WMS, odpowiedzi usług obrazowych i informacje wydawców: 2026-10-08. Aplikacja odczytuje aktualne możliwości usług. Pełny URL obrazu, warstwa, parametr czasu i data eksportu trafiają do manifestu ZIP.

| Źródło | Usługa | Daty / układ |
| --- | --- | --- |
| Esri Wayback | https://livingatlas.arcgis.com/wayback/ | Lokalne zmiany w środku i narożnikach prostokąta; kafle EPSG:3857. Data ujęcia w środku obszaru albo oznaczona data wydania. |
| Geoportal GUGiK | https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolutionTime | GetCapabilities, GetMap EPSG:4326 i przeliczenie wierszy do Mercatora. Rok zapytania nie potwierdza daty zdjęcia. |
| Geoportal HD | https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/HighResolutionTime | WMS 1.3.0, warstwa Image. Katalog podaje zakres czasu od 2012 do 2025; zapytania roczne. CRS:84 (kolejność długość, szerokość), przeliczenie wierszy do EPSG:3857. |
| Poznań GEOPOZ — archiwum | https://wms2.geopoz.poznan.pl/geoserver/wms | WMS 1.1.1, ortofotomapy RGB. Rok z Title, zasięg z LatLonBoundingBox. Wykluczamy CIR, NDVI i opisy. |
| Poznań GEOPOZ — nowe roczniki | https://wms1.geopoz.poznan.pl:6443/arcgis/services/SIPII/ortofotomapy/MapServer/WMSServer | WMS 1.1.1, roczniki 2023, 2024 i 2025 w sprawdzonym katalogu. Pobieranie EPSG:4326, przeliczenie wierszy do Mercatora. |

## Szczegółowość

To zdjęcia lotnicze / ortofotomapy, a nie mozaiki satelitarne o pikselu 10–30 m. Nie gwarantujemy tej samej rozdzielczości każdego starego rocznika. GUGiK opisuje obecne opracowania o pikselu 0,05 m i 0,10 m; starsze dane mają różną rozdzielczość i pokrycie. Dla miejskiego źródła poza zasięgiem podanym w katalogu nie wysyłamy GetMap. Puste odpowiedzi i błędy są rozróżniane.

Oficjalny wykaz usług: https://www.geoportal.gov.pl/pl/usluga/uslugi-przegladania-wms-i-wmts/
Opis danych: https://www.geoportal.gov.pl/pl/dane/ortofotomapa-orto/

## Poznań: źródło i warunki

Zarząd Geodezji i Katastru Miejskiego GEOPOZ. Katalog otwartych danych:
https://dane.gov.pl/pl/dataset/4984,ortofotomapa-poznan-2023-2024-usluga-wms
Metadane odczytano z https://api.dane.gov.pl/1.4/datasets/4984 — license_name: CC BY 4.0.
Portal: https://sipgeoportal.geopoz.poznan.pl/
Źródło widoczne na mapie, w podpisie PNG i metadanych ZIP.

## Inne znalezione archiwum

MSIP Kraków posiada szczegółowe archiwalne ortofotomapy od 1970 r., lecz nie jest aktywnym źródłem aplikacji. Punkt 9 regulaminu wymaga pisemnej zgody administratora na ciągłe, zorganizowane wykorzystanie usług w zewnętrznym systemie do dalszego udostępniania:
https://msip.krakow.pl/getHtml?dok_id=228972
Katalog: https://msip.krakow.pl/228340,artykul,katalog-danych.html

## Eksport

Manifest ZIP obejmuje wyeksportowane zdjęcia i pominięte odpowiedzi. Podglądy mają te same granice w EPSG:4326 i są renderowane w EPSG:3857. Licencja kodu nie zmienia warunków danych. Eksport to podpisane PNG poglądowe, a nie oryginalne ortofotomapy do pomiarów.
