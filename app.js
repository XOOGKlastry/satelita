import { getWaybackItemsWithLocalChanges, getMetadata } from 'https://esm.sh/@esri/wayback-core@1.1.0';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const map = L.map('map', { zoomControl: false, minZoom: 2, maxZoom: 18 }).setView([52.23, 21.01], 12);
L.control.zoom({ position: 'bottomright' }).addTo(map);
const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
L.control.layers({ 'OpenStreetMap': base }, {}, { position: 'topright', collapsed: true }).addTo(map);
const drawn = new L.FeatureGroup().addTo(map);
const $ = (id) => document.getElementById(id);
let rectangleDrawer = null;
let bounds = null;
let releases = [];
let selected = new Set();
let currentLayer = null;
let searchLayer = null;
let requestId = 0;
let imagerySource = 'esri';
const geoportalWms = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolutionTime';

function setStatus(message, mode = '') {
  $('status').className = `status ${mode}`;
  $('status').innerHTML = `<span class="status-mark">${mode === 'loading' ? '⟳' : mode === 'error' ? '!' : '✳'}</span><span>${message}</span>`;
}
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function formatAcquisition(epoch) {
  if (!epoch) return null;
  const d = new Date(epoch);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
}
function leafletUrl(item) {
  return item.itemURL.replace('{level}', '{z}').replace('{row}', '{y}').replace('{col}', '{x}');
}
function boundsText(b) {
  const sw = b.getSouthWest(), ne = b.getNorthEast();
  const area = Math.abs((ne.lng - sw.lng) * (ne.lat - sw.lat) * 111 * 111 * Math.cos((ne.lat + sw.lat) / 2 * Math.PI / 180));
  return `${area.toFixed(area < 1 ? 2 : 1)} km² · ${sw.lat.toFixed(4)}, ${sw.lng.toFixed(4)}`;
}
function updateSelectionCard() {
  $('selection-card').classList.toggle('empty', !bounds);
  $('selection-title').textContent = bounds ? 'Zaznaczony fragment mapy' : 'Jeszcze nic tu nie ma';
  $('selection-subtitle').textContent = bounds ? boundsText(bounds) : 'Użyj narzędzia prostokąta na mapie';
  $('clear-selection').hidden = !bounds;
}

map.on(L.Draw.Event.CREATED, async (event) => {
  drawn.clearLayers(); drawn.addLayer(event.layer);
  bounds = event.layer.getBounds(); updateSelectionCard(); await findReleases();
});
map.on(L.Draw.Event.DELETED, () => clearSelection());
$('clear-selection').addEventListener('click', clearSelection);
function clearSelection() {
  requestId++; drawn.clearLayers(); bounds = null; releases = []; selected.clear();
  if (currentLayer) map.removeLayer(currentLayer); currentLayer = null;
  $('imagery-list').replaceChildren(); $('count').textContent = '—'; $('download').disabled = true;
  $('zip-label').textContent = 'Pliki będą podpisane datą ujęcia'; updateSelectionCard();
  setStatus('Zaznacz obszar na mapie, aby sprawdzić archiwum.');
}

async function findReleases() {
  const id = ++requestId; selected.clear(); $('imagery-list').replaceChildren(); $('count').textContent = '…'; $('search-releases').value = ''; $('search-count').textContent = '';
  $('download').disabled = true;
  if (imagerySource === 'geoportal') {
    const thisYear = Math.min(new Date().getFullYear(), 2025);
    releases = Array.from({ length: thisYear - 1995 + 1 }, (_, i) => {
      const year = thisYear - i;
      return { provider: 'geoportal', releaseNum: year, releaseDateLabel: String(year), layerIdentifier: 'ortofotomapa archiwalna' };
    });
    selected = new Set(releases.map(r => r.releaseNum)); $('count').textContent = `${releases.length} LAT`;
    renderReleases(); setStatus('Geoportal udostępnia archiwalną ortofotomapę przez WMS z parametrem czasu. WMS może zwrócić najbliższe dostępne ujęcie dla roku; lista lat nie gwarantuje osobnego zdjęcia w każdym roku.', '');
    return;
  }
  setStatus('Przeszukuję archiwum zdjęć dla wybranego obszaru…', 'loading');
  try {
    const center = bounds.getCenter();
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    const points = [center, sw, L.latLng(sw.lat, ne.lng), L.latLng(ne.lat, sw.lng), ne];
    const zoom = Math.max(8, Math.min(17, map.getZoom()));
    const found = await Promise.all(points.map(p => getWaybackItemsWithLocalChanges({ longitude: p.lng, latitude: p.lat }, zoom, { onlyUseSizeToFilterDuplicates: true })));
    if (id !== requestId) return;
    const byRelease = new Map();
    found.flat().forEach(item => byRelease.set(item.releaseNum, item));
    releases = [...byRelease.values()].sort((a,b) => b.releaseDatetime - a.releaseDatetime);
    $('count').textContent = `${releases.length} WERSJI`;
    if (!releases.length) {
      setStatus('Nie znaleziono archiwalnych wydań dla tego obszaru. Spróbuj nieco zmienić zaznaczenie.', 'error'); return;
    }
    selected = new Set(releases.map(r => r.releaseNum));
    renderReleases(); setStatus(`Znaleziono ${releases.length} wydań archiwum. Daty na liście dotyczą wydania; data pozyskania zdjęcia pojawi się po sprawdzeniu metadanych.`, '');
  } catch (error) {
    if (id !== requestId) return;
    console.error(error); $('count').textContent = 'BŁĄD';
    setStatus('Nie udało się pobrać archiwum. Sprawdź połączenie i spróbuj ponownie.', 'error');
  }
}

function renderReleases() {
  $('imagery-list').innerHTML = releases.map((r) => `<label class="imagery-item" data-id="${r.releaseNum}">
    ${r.provider === 'geoportal' ? '<span class="thumb geo-thumb">PL</span>' : `<img class="thumb" loading="lazy" src="${r.itemURL.replace('{level}/{row}/{col}', `${Math.min(map.getZoom(), 15)}/${Math.floor(map.project(bounds.getCenter(), Math.min(map.getZoom(),15)).y/256)}/${Math.floor(map.project(bounds.getCenter(), Math.min(map.getZoom(),15)).x/256)}`)}" alt="">`}
    <span class="item-info"><span class="item-date">${escapeHtml(r.releaseDateLabel)}</span><span class="item-meta">${r.provider === 'geoportal' ? 'rok zapytania · GUGiK / Geoportal' : `wydanie archiwum · ${escapeHtml(r.layerIdentifier || 'World Imagery')}`}</span></span>
    <input class="item-check" type="checkbox" ${selected.has(r.releaseNum) ? 'checked' : ''} aria-label="Dodaj wydanie ${escapeHtml(r.releaseDateLabel)} do ZIP">
  </label>`).join('');
  $('imagery-list').querySelectorAll('.imagery-item').forEach((row) => {
    row.addEventListener('click', async (e) => {
      if (e.target.matches('input')) { toggleRelease(Number(row.dataset.id), e.target.checked); return; }
      const item = releases.find(r => r.releaseNum === Number(row.dataset.id)); if (item) showRelease(item, row);
    });
  });
  $('imagery-list').querySelectorAll('img.thumb').forEach(img => img.addEventListener('error', () => { img.style.visibility = 'hidden'; }, { once: true }));
  filterRows(); syncSelection(); showRelease(releases[0], $('imagery-list').firstElementChild);
}
function filterRows() {
  const query = $('search-releases').value.trim().toLocaleLowerCase('pl');
  let visible = 0;
  $('imagery-list').querySelectorAll('.imagery-item').forEach(row => {
    const match = row.textContent.toLocaleLowerCase('pl').includes(query);
    row.hidden = !match; if (match) visible++;
  });
  $('search-count').textContent = releases.length ? `${visible} z ${releases.length} pozycji widocznych` : '';
}
function syncSelection() {
  $('download').disabled = !selected.size;
  $('zip-label').textContent = `${selected.size} wybranych ujęć do eksportu`;
  $('imagery-list').querySelectorAll('.imagery-item').forEach(row => {
    const box = row.querySelector('.item-check');
    box.checked = selected.has(Number(row.dataset.id));
  });
}
function toggleRelease(id, checked) { checked ? selected.add(id) : selected.delete(id); syncSelection(); }
function setVisibleSelected(checked) {
  $('imagery-list').querySelectorAll('.imagery-item:not([hidden])').forEach(row => {
    const id = Number(row.dataset.id); checked ? selected.add(id) : selected.delete(id);
  });
  syncSelection();
}

function geoportalViewportLayer(year){
  const view=map.getBounds();const size=map.getSize();const corners=[view.getSouthWest(),view.getNorthWest(),view.getSouthEast(),view.getNorthEast()].map(p=>proj4('WGS84',projection2180,[p.lng,p.lat]));const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);const maxDimension=1800,scale=Math.min(1,maxDimension/size.x,maxDimension/size.y);const params=new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.1.1',LAYERS:'Raster',STYLES:'',FORMAT:'image/png',TRANSPARENT:'FALSE',SRS:'EPSG:2180',BBOX:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)].join(','),WIDTH:String(Math.max(1,Math.round(size.x*scale))),HEIGHT:String(Math.max(1,Math.round(size.y*scale))),TIME:String(year)+'-01-01'});return L.imageOverlay(geoportalWms+'?'+params.toString(),view,{crossOrigin:true,opacity:1,interactive:false,alt:'Geoportal WMS '+year});
}

async function showRelease(item, row, singleImage = false) {
  if (currentLayer) map.removeLayer(currentLayer);
  currentLayer = item.provider === 'geoportal'
    ? (singleImage ? geoportalViewportLayer(item.releaseDateLabel).addTo(map) : L.tileLayer.wms(geoportalWms, { layers: 'Raster', format: 'image/png', transparent: false, version: '1.1.1', time: `${item.releaseDateLabel}-01-01`, crossOrigin: true, attribution: 'GUGiK / Geoportal.gov.pl' }).addTo(map))
    : L.tileLayer(leafletUrl(item), { maxZoom: 19, crossOrigin: true, attribution: 'Esri, Maxar, Earthstar Geographics' }).addTo(map);
  $('imagery-list').querySelectorAll('.imagery-item').forEach(el => el.classList.toggle('active', el === row));
  row?.scrollIntoView({ block: 'nearest' });
  item.exportLabel = item.provider === 'geoportal' ? item.releaseDateLabel : (item.releaseDateLabel.match(/^(\d{4})-(\d{2})/)?.slice(1).reverse().join('_') || item.releaseDateLabel);
  try {
    if (item.provider === 'geoportal') return;
    const c = bounds.getCenter(); const meta = await getMetadata({ longitude: c.lng, latitude: c.lat }, Math.min(17, Math.max(8, map.getZoom())), item.releaseNum);
    const acquisition = formatAcquisition(meta?.date);
    if (acquisition) item.exportLabel = `${acquisition.slice(5,7)}_${acquisition.slice(0,4)}`;
    const metaLine = row?.querySelector('.item-meta');
    if (metaLine && acquisition) metaLine.textContent = `ujęcie ${acquisition} · ${meta.provider || 'dostawca nieznany'} · wydanie ${item.releaseDateLabel}`;
  } catch (err) { console.debug('Metadata unavailable for this release', err); }
}

// Capture the visible map viewport after the selected imagery layer has loaded.
async function exportRelease(item, zip) {
  const row = $('imagery-list').querySelector(`[data-id="${item.releaseNum}"]`);
  await showRelease(item, row, item.provider === 'geoportal');
  $('snapshot-label').textContent = `${item.provider === 'geoportal' ? 'GEOPORTAL' : 'ESRI'} · ${item.exportLabel.replace('_','/')}`;
  $('snapshot-label').hidden = false;
  try {
    const layer = currentLayer;
    await new Promise((resolve, reject) => {
      let finished = false;
      const done = (error) => { if (finished) return; finished = true; clearTimeout(timer); layer.off('load', onLoad); layer.off('error', onError); error ? reject(error) : resolve(); };
      const onLoad = () => done();
      const onError = () => done(new Error(item.provider === 'geoportal' ? 'Geoportal nie zwrócił obrazu dla tego roku.' : 'Nie udało się wczytać warstwy archiwalnej.'));
      const timeout = item.provider === 'geoportal' ? 12000 : 15000;
      const timer = setTimeout(() => done(new Error(item.provider === 'geoportal' ? 'Przekroczono czas oczekiwania na obraz Geoportalu.' : 'Przekroczono czas oczekiwania na warstwę archiwalną.')), timeout);
      layer.on('load', onLoad); layer.on('error', onError);
      if (layer._image?.complete && layer._image.naturalWidth) done();
      if (layer._loading === false && layer._tileZoom !== undefined) done();
    });
    const canvas = await html2canvas($('map'), { useCORS: true, allowTaint: false, backgroundColor: '#dce3dc', scale: 1, logging: false });
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Nie udało się utworzyć zrzutu ekranu.')), 'image/png'));
    const provider = item.provider === 'geoportal' ? 'geoportal' : 'esri';
    zip.file(`zdjecia/${provider}_${item.exportLabel}.png`, blob);
    zip.file(`zdjecia/${provider}_${item.exportLabel}.txt`, `Źródło: ${provider === 'esri' ? 'Esri World Imagery Wayback' : 'GUGiK / Geoportal.gov.pl'}\nEtykieta: ${provider}_${item.exportLabel}\nZrzut widocznego okna mapy. Zasięg mapy: ${boundsText(bounds)}\n`);
  } finally { $('snapshot-label').hidden = true; }
}

$('download').addEventListener('click', async () => {
  const chosen = releases.filter(r => selected.has(r.releaseNum)); if (!chosen.length || !bounds) return;
  const button = $('download'); button.disabled = true; button.querySelector('span').textContent = 'TWORZĘ PACZKĘ…';
  setStatus(`Eksportuję 0 z ${chosen.length} zdjęć. Pozostaw tę kartę otwartą.`, 'loading');
  try {
    const zip = new JSZip(); zip.file('obszar.txt', `Zaznaczenie: ${boundsText(bounds)}\nEksport: zrzuty widocznego okna mapy, zbliżenie ${map.getZoom()}\nGeoportal pobrany jako pojedynczy obraz widoku na każdy rok.\nPliki są podpisane dostawcą i datą.\n`);
    for (let i=0; i<chosen.length; i++) {
      await exportRelease(chosen[i], zip);
      setStatus(`Eksportuję ${i+1} z ${chosen.length} zdjęć…`, 'loading');
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const lastGeoportal = [...chosen].reverse().find(item => item.provider === 'geoportal');
    if (lastGeoportal) await showRelease(lastGeoportal, $('imagery-list').querySelector(`[data-id="${lastGeoportal.releaseNum}"]`));
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `warstwy-czasu_${new Date().toISOString().slice(0,10)}.zip`; a.click(); URL.revokeObjectURL(a.href);
    setStatus(`Gotowe. Paczka zawiera ${chosen.length} zdjęć i pliki z informacją o źródle.`, '');
  } catch (error) { console.error(error); setStatus(`Eksport nie powiódł się: ${error.message}`, 'error'); }
  finally { button.disabled = !selected.size; button.querySelector('span').textContent = 'POBIERZ PACZKĘ ZIP'; }
});

$('source-select').addEventListener('change', async (event) => {
  imagerySource = event.target.value;
  if (currentLayer) map.removeLayer(currentLayer); currentLayer = null;
  $('map-attribution').textContent = imagerySource === 'geoportal' ? 'GUGiK / Geoportal.gov.pl' : '© Esri, Maxar, Earthstar Geographics';
  if (bounds) await findReleases();
});


const uugEndpoint = 'https://services.gugik.gov.pl/uug/';
const uldkEndpoint = 'https://uldk.gugik.gov.pl/';
const projection2180 = '+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +units=m +no_defs';
function setLocationStatus(message, error = false) { $('location-status').textContent = message; $('location-status').classList.toggle('error', error); }
function project2180ToWgs84(x, y) { const point=proj4(projection2180,'WGS84',[Number(x),Number(y)]); return [point[1],point[0]]; }
function parseWktGeometry(wkt) {
  const type=wkt.match(/^\s*(MULTIPOLYGON|POLYGON)\s*\(/i)?.[1]?.toUpperCase(); if(!type) throw new Error('Usługa nie zwróciła geometrii działki.');
  const source=wkt.slice(wkt.indexOf('(')); let i=0;
  function parseGroup(){const result=[];i++;while(i<source.length){while(/[\s,]/.test(source[i]||''))i++;if(source[i]===')'){i++;return result;}if(source[i]==='(')result.push(parseGroup());else{const m=source.slice(i).match(/^[-+\d.eE]+\s+[-+\d.eE]+/);if(!m)throw new Error('Nie można odczytać geometrii działki.');result.push(m[0].trim().split(/\s+/).map(Number));i+=m[0].length;}}return result;}
  return {type:type==='POLYGON'?'Polygon':'MultiPolygon',coordinates:parseGroup()};
}
function extractWktRecord(line){const match=line.match(/(?:MULTIPOLYGON|POLYGON)\s*\(.*/i);if(!match)return null;const parts=line.split('|');const wkt=parts.find(p=>/(?:MULTIPOLYGON|POLYGON)\s*\(/i.test(p))||match[0];return{wkt,label:parts.filter(p=>p!==wkt).join(' · ')};}
function showSearchResult(layer,boundsToFit,label){if(searchLayer)map.removeLayer(searchLayer);searchLayer=layer.addTo(map);map.fitBounds(boundsToFit,{padding:[30,30],maxZoom:18});if(label)layer.bindPopup(escapeHtml(label)).openPopup();}
let addressSuggestTimer=null; let addressSuggestController=null; let addressSearchSequence=0;
function setSearchStatus(id,message,error=false){$(id).textContent=message;$(id).classList.toggle('error',error);}
function addressRows(data){const values=data?.results;return (Array.isArray(values)?values:Object.values(values||{})).filter(item=>item&&Number.isFinite(Number(item.x))&&Number.isFinite(Number(item.y)));}
function addressLabel(item){return [item.city||item.miejscowosc,item.street||item.ulica,item.number||item.numer,item.code].filter(Boolean).join(', ')||item.jednostka||'Znaleziony adres';}
function showAddress(item){const latlng=project2180ToWgs84(item.x,item.y);const marker=L.marker(latlng);showSearchResult(marker,L.latLngBounds([latlng,latlng]).pad(.012),addressLabel(item));setSearchStatus('address-status','Adres znaleziony. Teraz narysuj obszar do przeglądania.');$('address-suggestions').hidden=true;}
async function searchAddresses(query,signal){const url=new URL(uugEndpoint);url.searchParams.set('request','GetAddress');url.searchParams.set('address',query);const response=await fetch(url,{signal});if(!response.ok)throw new Error('Usługa adresowa jest chwilowo niedostępna.');return addressRows(await response.json());}
$('address-query').addEventListener('input',()=>{clearTimeout(addressSuggestTimer);if(addressSuggestController)addressSuggestController.abort();const query=$('address-query').value.trim();$('address-suggestions').replaceChildren();$('address-suggestions').hidden=true;if(query.length<4){setSearchStatus('address-status','Wpisz co najmniej 4 znaki, aby zobaczyć podpowiedzi.');return;}setSearchStatus('address-status','Szukam podpowiedzi…');const seq=++addressSearchSequence;addressSuggestTimer=setTimeout(async()=>{addressSuggestController=new AbortController();try{const rows=await searchAddresses(query,addressSuggestController.signal);if(seq!==addressSearchSequence)return;const list=$('address-suggestions');list.replaceChildren();rows.slice(0,8).forEach(item=>{const option=document.createElement('button');option.type='button';option.setAttribute('role','option');option.textContent=addressLabel(item);option.addEventListener('click',()=>showAddress(item));list.append(option);});list.hidden=!rows.length;setSearchStatus('address-status',rows.length?'Wybierz podpowiedź albo naciśnij Szukaj.':'Brak podpowiedzi — dopisz miejscowość i ulicę.');}catch(error){if(error.name!=='AbortError'&&seq===addressSearchSequence)setSearchStatus('address-status','Podpowiedzi są chwilowo niedostępne. Możesz zatwierdzić pełny adres.',true);}},350);});
$('address-search-form').addEventListener('submit',async(event)=>{event.preventDefault();const query=$('address-query').value.trim();if(!query)return;const button=$('address-search-form').querySelector('button[type="submit"]');button.disabled=true;setSearchStatus('address-status','Wyszukuję adres…');try{if(addressSuggestController)addressSuggestController.abort();const rows=await searchAddresses(query);if(!rows.length)throw new Error('Nie znaleziono adresu. Wpisz miejscowość, ulicę i numer.');if(rows.length>1){const list=$('address-suggestions');list.replaceChildren();rows.slice(0,8).forEach(item=>{const option=document.createElement('button');option.type='button';option.setAttribute('role','option');option.textContent=addressLabel(item);option.addEventListener('click',()=>showAddress(item));list.append(option);});list.hidden=false;setSearchStatus('address-status','Wybierz właściwy wynik.');}else showAddress(rows[0]);}catch(error){console.error(error);setSearchStatus('address-status',error.message||'Wyszukiwanie adresu nie powiodło się.',true);}finally{button.disabled=false;}});
$('parcel-search-form').addEventListener('submit',async(event)=>{event.preventDefault();const query=$('parcel-query').value.trim();if(!query)return;const idPattern=/^\d{6}_\d\.\d{4}\.(?:\d+\.)?\d+(?:\/\d+)?$/;if(!idPattern.test(query)){setSearchStatus('parcel-status','Wpisz pełny identyfikator działki, np. 141201_1.0001.6509.',true);return;}const button=$('parcel-search-form').querySelector('button[type="submit"]');button.disabled=true;setSearchStatus('parcel-status','Wyszukuję działkę…');try{const url=new URL(uldkEndpoint);url.searchParams.set('request','GetParcelById');url.searchParams.set('id',query);url.searchParams.set('result','geom_wkt,id,parcel,region,commune,county,voivodeship');url.searchParams.set('srid','4326');const response=await fetch(url);if(!response.ok)throw new Error('Usługa działek jest chwilowo niedostępna.');const lines=(await response.text()).trim().split(/\r?\n/);const records=lines.slice(1).map(extractWktRecord).filter(Boolean);if(!records.length)throw new Error('Nie znaleziono działki o tym identyfikatorze.');const features=records.map(record=>({type:'Feature',properties:{label:record.label},geometry:parseWktGeometry(record.wkt)}));const layer=L.geoJSON({type:'FeatureCollection',features},{style:{color:'#f2a900',weight:3,fillColor:'#ffd75e',fillOpacity:.24}});const parcelBounds=layer.getBounds();if(!parcelBounds.isValid())throw new Error('Nie udało się odczytać położenia działki.');showSearchResult(layer,parcelBounds,records[0].label||query);setSearchStatus('parcel-status','Działka zaznaczona. Teraz narysuj obszar do przeglądania.');}catch(error){console.error(error);setSearchStatus('parcel-status',error.message||'Wyszukiwanie działki nie powiodło się.',true);}finally{button.disabled=false;}});
$('draw-area').addEventListener('click',()=>{if(rectangleDrawer){rectangleDrawer.disable();rectangleDrawer=null;$('draw-area').classList.remove('active');return;}rectangleDrawer=new L.Draw.Rectangle(map,{shapeOptions:{color:'#477052',weight:2,fillOpacity:.12}});rectangleDrawer.enable();$('draw-area').classList.add('active');});
map.on(L.Draw.Event.DRAWSTOP,()=>{$('draw-area').classList.remove('active');rectangleDrawer=null;});
map.on(L.Draw.Event.CREATED,()=>{if(searchLayer){map.removeLayer(searchLayer);searchLayer=null;}});

$('locate').addEventListener('click', () => map.locate({ setView: true, maxZoom: 15 }));
$('search-releases').addEventListener('input', filterRows);
$('select-visible').addEventListener('click', () => setVisibleSelected(true));
$('deselect-visible').addEventListener('click', () => setVisibleSelected(false));
map.on('locationfound', e => L.circleMarker(e.latlng, { radius: 7, color: '#31583c', fillOpacity: .7 }).addTo(map));
map.on('locationerror', () => setStatus('Przeglądarka nie udostępniła lokalizacji. Możesz przesunąć mapę ręcznie.', 'error'));
updateSelectionCard();


