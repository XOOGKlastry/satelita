import { getWaybackItemsWithLocalChanges, getMetadata } from 'https://esm.sh/@esri/wayback-core@1.1.0';
import JSZip from 'https://esm.sh/jszip@3.10.1';
import { geographicSourceRow, hasImagery, uniqueFilename } from './image-core.js';

const $ = id => document.getElementById(id);
const GEO_WMS = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolutionTime';
const PROJECTION_2180 = '+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +units=m +no_defs';
const STATES = { pending:'Sprawdzanie', loading:'Ładowanie', ready:'Dostępne', empty:'Brak zdjęcia', error:'Nie wczytano' };
const map = L.map('map', { zoomControl:false, minZoom:2, maxZoom:18 }).setView([52.23,21.01],12);
L.control.zoom({position:'bottomright'}).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
const drawn = new L.FeatureGroup().addTo(map);
let areaBounds = null, frame = null, items = [], selected = new Set(), activeId = null;
let job = null, generation = 0, rectangleDrawer = null, currentLayer = null, searchLayer = null;
let page = 0, pageSize = 8, columns = 4, autoSelect = true, previewPinned = false, exporting = false;
const sourceName = item => item.provider === 'geoportal' ? 'Geoportal' : 'Esri Wayback';
const html = value => String(value || '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rowDate = item => item.acquisition || item.releaseDateLabel;
function setStatus(message, mode='') {
  $('status').textContent = message; $('status').title = message; $('status').className = 'status ' + mode;
}
function setSearchStatus(id,message,error=false) {
  $(id).textContent=message; $(id).classList.toggle('error',error);
}
function removePreviewLayer() {
  if (currentLayer) map.removeLayer(currentLayer);
  currentLayer=null;
}
function disposeItems() {
  items.forEach(item=>{ if(item.url)URL.revokeObjectURL(item.url); if(item.rasterUrl)URL.revokeObjectURL(item.rasterUrl); });
}
function clearSelection() {
  generation++; job?.abort(); job=null; disposeItems(); items=[]; selected.clear();
  areaBounds=null; frame=null; activeId=null; page=0; previewPinned=false;
  drawn.clearLayers(); removePreviewLayer(); updateArea(); renderGrid(); showPreview(); syncCounts();
  setStatus('Zaznacz obszar, aby sprawdzić zdjęcia.');
}
function updateArea() {
  $('selection-title').textContent=areaBounds?'Wybrany obszar':'Wybierz miejsce';
  if(areaBounds){const c=areaBounds.getCenter(); $('selection-subtitle').textContent=c.lat.toFixed(5)+', '+c.lng.toFixed(5)+' · ten sam zasięg dla wszystkich zdjęć';}
  else $('selection-subtitle').textContent='Wyszukaj adres lub działkę i narysuj prostokąt.';
  $('clear-selection').hidden=!areaBounds;
}
function makeFrame(bounds) {
  const sw=bounds.getSouthWest(),ne=bounds.getNorthEast();
  const northwest=L.CRS.EPSG3857.project(bounds.getNorthWest()), southeast=L.CRS.EPSG3857.project(bounds.getSouthEast());
  const ratio=(southeast.x-northwest.x)/(northwest.y-southeast.y);
  const width=Math.round(ratio>=1?1000:1000*ratio), height=Math.round(ratio>=1?1000/ratio:1000);
  return {south:sw.lat,north:ne.lat,west:sw.lng,east:ne.lng,width:Math.max(80,width),height:Math.max(80,height)};
}
function setArea(bounds) {
  clearSelection(); areaBounds=bounds; drawn.addLayer(L.rectangle(bounds,{color:'#215ae4',weight:2,fillOpacity:.04}));
  map.fitBounds(bounds.pad(.12),{maxZoom:17}); frame=makeFrame(bounds); updateArea(); discover();
}
$('clear-selection').addEventListener('click',clearSelection);
$('draw-area').addEventListener('click',()=>{
  if(rectangleDrawer){rectangleDrawer.disable();return;}
  rectangleDrawer=new L.Draw.Rectangle(map,{shapeOptions:{color:'#215ae4',weight:2,fillOpacity:.08}});
  rectangleDrawer.enable(); $('draw-area').classList.add('active');
});
map.on(L.Draw.Event.DRAWSTOP,()=>{$('draw-area').classList.remove('active');rectangleDrawer=null;});
map.on(L.Draw.Event.CREATED,event=>setArea(event.layer.getBounds()));
$('source-select').addEventListener('change',()=>{if(areaBounds)discover();});
function canvas(width,height) { const c=document.createElement('canvas');c.width=width;c.height=height;return c; }
function canvasBlob(c) { return new Promise((resolve,reject)=>c.toBlob(blob=>blob?resolve(blob):reject(new Error('Nie można zapisać podglądu.')),'image/png')); }
async function pool(values, limit, task) {
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(limit,values.length)},async()=>{
    while(cursor<values.length){const value=values[cursor++];await task(value);}
  }));
}
async function imageBitmap(url,signal) {
  const local=new AbortController(); const abort=()=>local.abort(signal?.reason); signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)abort();
  const timer=setTimeout(()=>local.abort(new DOMException('Przekroczono czas wczytywania.','TimeoutError')),18000);
  try {
    const response=await fetch(url,{signal:local.signal});
    if(!response.ok)throw new Error('Źródło zwróciło HTTP '+response.status+'.');
    const blob=await response.blob();
    if(!blob.type.startsWith('image/'))throw new Error('Źródło nie zwróciło obrazu.');
    return await createImageBitmap(blob);
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
function imageryPresent(c) {
  const sample=canvas(48,48),ctx=sample.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(c,0,0,48,48); return hasImagery(ctx.getImageData(0,0,48,48).data);
}
async function geoportalYears(signal) {
  try{
    const response=await fetch(GEO_WMS+'?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1',{signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
    if(!response.ok)throw new Error('Capabilities');
    const document=new DOMParser().parseFromString(await response.text(),'application/xml');
    const extent=[...document.querySelectorAll('Extent,Dimension')].find(el=>el.getAttribute('name')==='time'&&el.textContent.includes('/'));
    const dates=extent?.textContent.match(/\d{4}-\d{2}-\d{2}/g);
    if(dates?.length>=2){const min=Number(dates[0].slice(0,4)),max=Number(dates[1].slice(0,4));return Array.from({length:max-min+1},(_,i)=>max-i);}
  }catch(error){if(signal.aborted)throw error;}
  return Array.from({length:31},(_,i)=>2025-i);
}
async function discover() {
  generation++; const id=generation; job?.abort(); job=new AbortController();const signal=job.signal;
  disposeItems();items=[];selected.clear();activeId=null;page=0;autoSelect=true;previewPinned=false;removePreviewLayer();
  $('search-releases').value='';renderGrid();showPreview();syncCounts();setStatus('Wyszukuję archiwum…','loading');
  try {
    if($('source-select').value==='geoportal'){
      const years=await geoportalYears(signal);
      if(id!==generation)return;
      items=years.map(year=>({id:String(year),provider:'geoportal',releaseDateLabel:String(year),state:'pending',exportLabel:String(year)}));
      setStatus('Rok Geoportalu oznacza zapytanie czasu; rzeczywista data zdjęcia może być inna.');
    }else{
      const sw=areaBounds.getSouthWest(),ne=areaBounds.getNorthEast(),center=areaBounds.getCenter();
      const points=[center,sw,ne,L.latLng(sw.lat,ne.lng),L.latLng(ne.lat,sw.lng)];
      const found=await Promise.all(points.map(p=>getWaybackItemsWithLocalChanges({longitude:p.lng,latitude:p.lat},Math.max(8,Math.min(17,map.getZoom())),{onlyUseSizeToFilterDuplicates:true})));
      if(id!==generation)return;
      const unique=new Map();found.flat().forEach(item=>unique.set(item.releaseNum,item));
      items=[...unique.values()].sort((a,b)=>b.releaseDatetime-a.releaseDatetime).map(item=>({...item,id:String(item.releaseNum),provider:'esri',state:'pending'}));
      setStatus(items.length?'Sprawdzam zdjęcia i przygotowuję podglądy…':'Brak wydań archiwum dla tego obszaru.');
    }
    activeId=items[0]?.id||null;renderGrid();showPreview();syncCounts();
    const context={...frame};const selectedBounds=areaBounds;
    await pool(items,3,item=>loadItem(item,id,signal,context,selectedBounds));
    if(id!==generation)return;
    const ready=items.filter(item=>item.state==='ready').length;
    setStatus(ready?'Podglądy są gotowe. ZIP korzysta z już wczytanych obrazów.':'Nie udało się wczytać zdjęć. Wybierz kartę, aby zobaczyć przyczynę.',ready?'':'error');
  }catch(error){if(id!==generation||signal.aborted)return;console.error(error);setStatus('Nie udało się pobrać archiwum. Spróbuj zmienić źródło lub obszar.','error');}
}
async function geoportalImage(item,context,signal) {
  const params=new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.1.1',LAYERS:'Raster',STYLES:'',FORMAT:'image/png',TRANSPARENT:'TRUE',SRS:'EPSG:4326',BBOX:[context.west,context.south,context.east,context.north].join(','),WIDTH:String(context.width),HEIGHT:String(context.height),TIME:item.releaseDateLabel+'-01-01'});
  item.sourceUrl=GEO_WMS+'?'+params.toString();
  const bitmap=await imageBitmap(item.sourceUrl,signal);
  try{
    const c=canvas(context.width,context.height),ctx=c.getContext('2d');
    // Convert geographic WMS rows to Web Mercator: every date shares the Esri/map extent.
    for(let row=0;row<c.height;row++){
      const sourceRow=geographicSourceRow(row,c.height,bitmap.height,context.south,context.north);
      ctx.drawImage(bitmap,0,sourceRow,bitmap.width,1,0,row,c.width,1);
    }
    return c;
  }finally{bitmap.close();}
}
async function esriImage(item,context,signal,bounds) {
  let zoom=Math.max(2,Math.min(17,map.getZoom()));
  let nw=map.project(bounds.getNorthWest(),zoom),se=map.project(bounds.getSouthEast(),zoom);
  while(Math.max(se.x-nw.x,se.y-nw.y)>1400&&zoom>2){zoom--;nw=map.project(bounds.getNorthWest(),zoom);se=map.project(bounds.getSouthEast(),zoom);}
  while(Math.max(se.x-nw.x,se.y-nw.y)<650&&zoom<17){zoom++;nw=map.project(bounds.getNorthWest(),zoom);se=map.project(bounds.getSouthEast(),zoom);}
  const c=canvas(context.width,context.height),ctx=c.getContext('2d'),tiles=[];
  const scaleX=c.width/(se.x-nw.x),scaleY=c.height/(se.y-nw.y);
  for(let y=Math.floor(nw.y/256);y<=Math.floor((se.y-.001)/256);y++)
    for(let x=Math.floor(nw.x/256);x<=Math.floor((se.x-.001)/256);x++)tiles.push({x,y});
  await pool(tiles,4,async tile=>{
    const url=item.itemURL.replace('{level}',String(zoom)).replace('{row}',String(tile.y)).replace('{col}',String(tile.x));
    const bitmap=await imageBitmap(url,signal);
    try{ctx.drawImage(bitmap,(tile.x*256-nw.x)*scaleX,(tile.y*256-nw.y)*scaleY,256*scaleX,256*scaleY);}finally{bitmap.close();}
  });
  item.sourceUrl=item.itemURL;return c;
}
async function acquisitionMetadata(item,bounds) {
  const center=bounds.getCenter();
  try{
    const meta=await Promise.race([getMetadata({longitude:center.lng,latitude:center.lat},Math.min(17,Math.max(8,map.getZoom())),item.releaseNum),new Promise(resolve=>setTimeout(()=>resolve(null),3500))]);
    if(meta?.date){const d=new Date(meta.date);if(!Number.isNaN(d.getTime())){item.acquisition=d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');item.exportLabel=item.acquisition.slice(5,7)+'_'+item.acquisition.slice(0,4);item.dateKind='data ujęcia w środku obszaru';}}
  }catch(error){console.debug('Metadane daty niedostępne',error);}
  if(!item.exportLabel){const match=String(item.releaseDateLabel).match(/(\d{4})-(\d{2})/);item.exportLabel='wydanie_'+(match?match[2]+'_'+match[1]:String(item.releaseDateLabel));item.dateKind='data wydania archiwum';}
}
async function loadItem(item,id,signal,context,bounds) {
  if(signal.aborted||id!==generation)return;
  item.state='loading';renderGrid();if(activeId===item.id)showPreview();syncCounts();
  try{
    const raster=item.provider==='geoportal'?await geoportalImage(item,context,signal):await esriImage(item,context,signal,bounds);
    if(signal.aborted||id!==generation)return;
    if(!imageryPresent(raster)){item.state='empty';item.error='Źródło zwróciło pusty obraz dla wybranego obszaru.';}
    else{
      if(item.provider==='esri')await acquisitionMetadata(item,bounds);
      else item.dateKind='rok zapytania WMS, nie potwierdzona data ujęcia';
      if(signal.aborted||id!==generation)return;
      const rawBlob=await canvasBlob(raster);
      const labeled=canvas(raster.width,raster.height+36),ctx=labeled.getContext('2d');
      ctx.drawImage(raster,0,0);ctx.fillStyle='#162336';ctx.fillRect(0,raster.height,labeled.width,36);
      ctx.fillStyle='#fff';ctx.font='13px "Segoe UI",Arial,sans-serif';ctx.textBaseline='middle';
      ctx.fillText(sourceName(item)+' · '+(item.acquisition?item.acquisition:item.releaseDateLabel)+(item.provider==='geoportal'?' · rok zapytania':item.acquisition?' · data ujęcia':' · wydanie'),12,raster.height+18);
      const blob=await canvasBlob(labeled);
      if(signal.aborted||id!==generation)return;
      item.blob=blob;item.rasterUrl=URL.createObjectURL(rawBlob);item.url=URL.createObjectURL(blob);item.state='ready';item.error='';
      if(autoSelect)selected.add(item.id);
      if(!previewPinned&&items.find(v=>v.id===activeId)?.state!=='ready')activeId=item.id;
    }
  }catch(error){
    if(signal.aborted||id!==generation)return;
    item.state='error';item.error=error.name==='TimeoutError'||error.name==='AbortError'?'Źródło nie odpowiedziało w wymaganym czasie. Spróbuj ponownie.':error.message;
    selected.delete(item.id);
  }
  if(id!==generation)return;
  renderGrid();syncCounts();if(activeId===item.id)showPreview();
}
function filteredItems() {const query=$('search-releases').value.trim().toLocaleLowerCase('pl');return items.filter(item=>(rowDate(item)+' '+item.releaseDateLabel+' '+sourceName(item)).toLocaleLowerCase('pl').includes(query));}
function renderGrid() {
  const filtered=filteredItems(),pages=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.min(page,pages-1);
  const visible=filtered.slice(page*pageSize,(page+1)*pageSize);
  $('imagery-list').style.gridTemplateColumns='repeat('+columns+', minmax(0,1fr))';
  const rows=Math.max(1,Math.ceil(pageSize/columns));$('imagery-list').style.gridTemplateRows='repeat('+rows+', minmax(0,1fr))';
  $('imagery-list').innerHTML=visible.length?visible.map(item=>'<article class="image-card '+(item.id===activeId?'active':'')+'" data-id="'+html(item.id)+'" data-state="'+item.state+'" role="button" tabindex="0" aria-label="Podgląd '+html(rowDate(item))+', '+STATES[item.state]+'" title="'+html(item.error||item.dateKind||STATES[item.state])+'"><div class="card-preview">'+(item.url?'<img src="'+item.url+'" alt="">':'<span aria-hidden="true">'+(item.state==='empty'||item.state==='error'?'×':'▧')+'</span>')+'<span class="card-state">'+STATES[item.state]+'</span></div><div class="card-bottom"><span class="card-date">'+html(rowDate(item))+'</span><input class="card-check" type="checkbox" aria-label="Dodaj '+html(rowDate(item))+' do ZIP" '+(selected.has(item.id)?'checked ':'')+(item.state!=='ready'?'disabled':'')+'></div></article>').join(''):'<div class="grid-empty">'+(areaBounds?'Brak pozycji dla tego filtra.':'Tutaj pojawią się miniatury zdjęć.')+'</div>';
  $('imagery-list').querySelectorAll('.image-card').forEach(card=>{
    const item=items.find(value=>value.id===card.dataset.id);
    const preview=()=>{activeId=item.id;previewPinned=true;renderGrid();showPreview();};
    card.addEventListener('click',event=>{if(event.target.matches('input'))return;preview();});
    card.addEventListener('keydown',event=>{if(event.target.matches('input'))return;if(event.key==='Enter'||event.key===' '){event.preventDefault();preview();}});
    card.querySelector('.card-check').addEventListener('change',event=>{event.target.checked?selected.add(item.id):selected.delete(item.id);syncCounts();});
  });
  $('page-label').textContent=(page+1)+' / '+pages;$('page-prev').disabled=page===0;$('page-next').disabled=page>=pages-1;
}
function syncCounts() {
  const ready=items.filter(item=>item.state==='ready').length,loading=items.filter(item=>item.state==='pending'||item.state==='loading').length;
  const missing=items.length-ready-loading;
  $('count').textContent=items.length;
  $('availability-summary').textContent=items.length?ready+' dostępnych · '+loading+' sprawdzanych · '+missing+' brak / błąd':'Dostępność sprawdzamy przed pobraniem.';
  $('header-status').textContent=areaBounds?(ready+' zdjęć gotowych'+(loading?' · trwa sprawdzanie':'')):'Wybierz obszar na mapie';
  const chosen=items.filter(item=>item.state==='ready'&&selected.has(item.id)).length;
  $('zip-label').textContent=chosen+' zdjęć wybranych';$('download').disabled=exporting||!chosen;
}
function showPreview() {
  const item=items.find(value=>value.id===activeId);
  $('preview-image').hidden=true;$('preview-empty').hidden=false;$('retry-image').hidden=true;
  $('preview-state').className='badge '+(item?.state||'neutral');
  $('preview-state').textContent=item?STATES[item.state]:'Podgląd';
  $('preview-title').textContent=item?sourceName(item)+' · '+rowDate(item):'Twój obszar w czasie';
  $('preview-caption').textContent=item?(item.dateKind||sourceName(item)):'Esri Wayback · Geoportal';
  removePreviewLayer();
  if(item?.state==='ready'){
    $('preview-image').src=item.url;$('preview-image').hidden=false;$('preview-empty').hidden=true;
    currentLayer=L.imageOverlay(item.rasterUrl,areaBounds,{pane:'tilePane',attribution:item.provider==='geoportal'?'GUGiK / Geoportal.gov.pl':'Esri, Maxar, Earthstar Geographics'}).addTo(map);
  }else{
    $('preview-message').textContent=!item?'Zaznacz obszar na mapie':item.state==='empty'?'Brak zdjęcia dla tego obszaru':item.state==='error'?'Nie udało się wczytać zdjęcia':'Przygotowuję podgląd…';
    $('preview-detail').textContent=item?.error||(!item?'Tutaj zobaczysz zdjęcie, które trafi do ZIP.':'Dostępność sprawdzana jest automatycznie.');
    $('retry-image').hidden=!item||!['error','empty'].includes(item.state);
  }
}
$('retry-image').addEventListener('click',()=>{
  const item=items.find(value=>value.id===activeId);if(!item||!areaBounds)return;
  loadItem(item,generation,job.signal,{...frame},areaBounds);
});
$('preview-image').addEventListener('error',()=>{const item=items.find(v=>v.id===activeId);if(item?.state==='ready'){item.state='error';item.error='Podgląd nie został poprawnie wyświetlony.';selected.delete(item.id);renderGrid();showPreview();syncCounts();}});
$('search-releases').addEventListener('input',()=>{page=0;renderGrid();});
$('page-prev').addEventListener('click',()=>{page--;renderGrid();});
$('page-next').addEventListener('click',()=>{page++;renderGrid();});
$('select-visible').addEventListener('click',()=>{autoSelect=true;filteredItems().filter(item=>item.state==='ready').forEach(item=>selected.add(item.id));renderGrid();syncCounts();});
$('deselect-visible').addEventListener('click',()=>{autoSelect=false;filteredItems().forEach(item=>selected.delete(item.id));renderGrid();syncCounts();});
new ResizeObserver(entries=>{
  const {width,height}=entries[0].contentRect;
  const newColumns=Math.max(1,Math.min(5,Math.floor((width+8)/112)));
  const rows=Math.max(1,Math.min(4,Math.floor((height+8)/92)));
  if(columns!==newColumns||pageSize!==newColumns*rows){columns=newColumns;pageSize=columns*rows;page=0;renderGrid();}
}).observe($('imagery-list'));
new ResizeObserver(()=>map.invalidateSize()).observe($('map'));
$('download').addEventListener('click',async()=>{
  const chosen=items.filter(item=>selected.has(item.id)&&item.state==='ready'&&item.blob);
  if(!chosen.length||exporting)return;exporting=true;syncCounts();$('download').textContent='Tworzenie ZIP…';setStatus('Pakuję '+chosen.length+' gotowych zdjęć…');
  try{
    const zip=new JSZip(),used=new Set(),manifest=[];
    for(const item of chosen){
      const name=uniqueFilename((item.provider==='geoportal'?'geoportal_':'esri_')+item.exportLabel,used);
      zip.file('zdjecia/'+name+'.png',item.blob);
      const record={filename:name+'.png',source:sourceName(item),date:rowDate(item),dateMeaning:item.dateKind,release:item.releaseDateLabel,sourceUrl:item.sourceUrl,bounds:frame,checkedAt:new Date().toISOString()};
      manifest.push(record);zip.file('zdjecia/'+name+'.txt',JSON.stringify(record,null,2));
    }
    zip.file('obszar.json',JSON.stringify({images:manifest},null,2));
    const blob=await zip.generateAsync({type:'blob',compression:'STORE'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='warstwy-czasu_'+new Date().toISOString().slice(0,10)+'.zip';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    setStatus('Gotowe: '+chosen.length+' zdjęć w ZIP.');
  }catch(error){console.error(error);setStatus('Nie udało się utworzyć ZIP: '+error.message,'error');}
  finally{exporting=false;$('download').innerHTML='Pobierz ZIP <span aria-hidden="true">↓</span>';syncCounts();}
});

// Location search: GUGiK UUG autocomplete and exact ULDK parcel identifiers.
function project2180ToWgs84(x,y){const point=proj4(PROJECTION_2180,'WGS84',[Number(x),Number(y)]);return[point[1],point[0]];}
function parseWktGeometry(value) {
  const wkt=value.trim().replace(/^SRID=\d+;/i,'');
  const type=wkt.match(/^(MULTIPOLYGON|POLYGON)\s*\(/i)?.[1]?.toUpperCase();if(!type)throw new Error('Nie można odczytać geometrii działki.');
  const source=wkt.slice(wkt.indexOf('('));let cursor=0;
  function group(){const result=[];cursor++;while(cursor<source.length){while(/[\s,]/.test(source[cursor]||''))cursor++;if(source[cursor]===')'){cursor++;return result;}if(source[cursor]==='(')result.push(group());else{const match=source.slice(cursor).match(/^[-+\d.eE]+\s+[-+\d.eE]+/);if(!match)throw new Error('Błędna geometria działki.');result.push(match[0].split(/\s+/).map(Number));cursor+=match[0].length;}}return result;}
  return{type:type==='POLYGON'?'Polygon':'MultiPolygon',coordinates:group()};
}
function addressRows(data){const values=data?.results;return(Array.isArray(values)?values:Object.values(values||{})).filter(item=>item&&Number.isFinite(Number(item.x))&&Number.isFinite(Number(item.y)));}
function addressLabel(item){return[item.city,item.street,item.number,item.code].filter(Boolean).join(', ')||'Znaleziony adres';}
function showAddress(item){
  clearSelection();if(searchLayer)map.removeLayer(searchLayer);
  const latlng=project2180ToWgs84(item.x,item.y);map.setView(latlng,17);
  searchLayer=L.marker(latlng).addTo(map).bindPopup(html(addressLabel(item))).openPopup();
  $('address-query').value=addressLabel(item);$('address-suggestions').hidden=true;setSearchStatus('address-status','Narysuj obszar wokół adresu.');
}
async function searchAddresses(query,signal){
  const url=new URL('https://services.gugik.gov.pl/uug/');url.searchParams.set('request','GetAddress');url.searchParams.set('address',query);
  const response=await fetch(url,{signal});if(!response.ok)throw new Error('Usługa adresowa jest niedostępna.');return addressRows(await response.json());
}
function addressOptions(rows){
  const list=$('address-suggestions');list.replaceChildren();
  rows.slice(0,8).forEach(item=>{const button=document.createElement('button');button.type='button';button.setAttribute('role','option');button.textContent=addressLabel(item);button.addEventListener('click',()=>showAddress(item));list.append(button);});
  list.hidden=!rows.length;
}
let suggestTimer=null,suggestController=null,suggestSequence=0;
$('address-query').addEventListener('input',()=>{
  clearTimeout(suggestTimer);suggestController?.abort();const sequence=++suggestSequence;
  const query=$('address-query').value.trim();$('address-suggestions').hidden=true;setSearchStatus('address-status','');
  if(query.length<4)return;
  suggestTimer=setTimeout(async()=>{
    suggestController=new AbortController();
    try{const rows=await searchAddresses(query,suggestController.signal);if(sequence!==suggestSequence)return;addressOptions(rows);if(!rows.length)setSearchStatus('address-status','Dopisz miejscowość i ulicę.');}
    catch(error){if(error.name!=='AbortError'&&sequence===suggestSequence)setSearchStatus('address-status','Podpowiedzi niedostępne. Spróbuj ponownie.',true);}
  },400);
});
$('address-query').addEventListener('keydown',event=>{if(event.key==='Escape')$('address-suggestions').hidden=true;if(event.key==='ArrowDown'){$('address-suggestions').querySelector('button')?.focus();event.preventDefault();}});
$('address-search-form').addEventListener('submit',async event=>{
  event.preventDefault();clearTimeout(suggestTimer);suggestController?.abort();suggestSequence++;
  const query=$('address-query').value.trim();if(!query)return;
  const button=event.currentTarget.querySelector('button[type="submit"]');button.disabled=true;
  try{const rows=await searchAddresses(query);if(!rows.length)throw new Error('Nie znaleziono adresu.');if(rows.length===1)showAddress(rows[0]);else{addressOptions(rows);setSearchStatus('address-status','Wybierz właściwy wynik.');}}
  catch(error){setSearchStatus('address-status',error.message,true);}finally{button.disabled=false;}
});
$('parcel-search-form').addEventListener('submit',async event=>{
  event.preventDefault();const query=$('parcel-query').value.trim();if(!query)return;
  if(!/^\d{6}_\d\.\d{4}\.(?:(?:AR_)?\d+\.)?\d+(?:\/\d+)?$/.test(query)){setSearchStatus('parcel-status','Wpisz pełny identyfikator działki.',true);return;}
  const button=event.currentTarget.querySelector('button[type="submit"]');button.disabled=true;setSearchStatus('parcel-status','Szukam działki…');
  try{
    const url=new URL('https://uldk.gugik.gov.pl/');url.searchParams.set('request','GetParcelById');url.searchParams.set('id',query);url.searchParams.set('result','geom_wkt,id');url.searchParams.set('srid','4326');
    const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Usługa działek jest niedostępna.');
    const lines=(await response.text()).trim().split(/\r?\n/);if(lines[0]!=='0')throw new Error('Nie znaleziono działki.');
    const records=lines.slice(1).filter(line=>/POLYGON/i.test(line));if(!records.length)throw new Error('Brak geometrii działki.');
    const features=records.map(line=>({type:'Feature',properties:{},geometry:parseWktGeometry(line.split('|')[0])}));
    if(searchLayer)map.removeLayer(searchLayer);searchLayer=L.geoJSON({type:'FeatureCollection',features},{style:{color:'#f2a900',weight:2,fillOpacity:.08}}).addTo(map);
    setArea(searchLayer.getBounds());setSearchStatus('parcel-status','Działka znaleziona. Sprawdzam zdjęcia.');
  }catch(error){setSearchStatus('parcel-status',error.message,true);}finally{button.disabled=false;}
});
$('locate').addEventListener('click',()=>map.locate({setView:true,maxZoom:16}));
map.on('locationerror',()=>setStatus('Lokalizacja niedostępna. Wyszukaj adres lub przesuń mapę.','error'));
renderGrid();showPreview();syncCounts();
