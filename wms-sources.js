import { geographicSourceRow } from './image-core.js';

// Orthophoto archives; no low-resolution satellite composites.
export const SOURCE_NAMES={esri:'Esri Wayback',geoportal:'Geoportal',geoportal_hd:'Geoportal HD',poznan:'Poznań GEOPOZ'};
export const WMS_SOURCES={
 geoportal_hd:{
  url:'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/HighResolutionTime',
  version:'1.3.0',crs:'CRS:84',layer:'Image',name:SOURCE_NAMES.geoportal_hd,
  license:'GUGiK / PZGIK: https://www.geoportal.gov.pl/pl/dane/ortofotomapa-orto/',
  attribution:'GUGiK / Geoportal.gov.pl — ortofotomapa wysokiej rozdzielczości',
  attributionHtml:'GUGiK / <a href="https://www.geoportal.gov.pl">Geoportal.gov.pl</a> — HD'
 },
 poznan:{
  url:'https://wms2.geopoz.poznan.pl/geoserver/wms',
  extraUrl:'https://wms1.geopoz.poznan.pl:6443/arcgis/services/SIPII/ortofotomapy/MapServer/WMSServer',
  version:'1.1.1',crs:'EPSG:4326',name:SOURCE_NAMES.poznan,
  license:'CC BY 4.0. GEOPOZ, Ortofotomapa Poznań: https://dane.gov.pl/pl/dataset/4984,ortofotomapa-poznan-2023-2024-usluga-wms',
  attribution:'Zarząd Geodezji i Katastru Miejskiego GEOPOZ — https://sipgeoportal.geopoz.poznan.pl/',
  attributionHtml:'<a href="https://sipgeoportal.geopoz.poznan.pl/">GEOPOZ / Poznań</a> · CC BY 4.0'
 }
};
const child=(node,name)=>[...node.children].find(el=>el.localName===name);
function coverage(layer){
 for(let node=layer;node?.children;node=node.parentElement){
  const geographic=child(node,'EX_GeographicBoundingBox');
  if(geographic)return {west:Number(child(geographic,'westBoundLongitude')?.textContent),east:Number(child(geographic,'eastBoundLongitude')?.textContent),south:Number(child(geographic,'southBoundLatitude')?.textContent),north:Number(child(geographic,'northBoundLatitude')?.textContent)};
  const box=child(node,'LatLonBoundingBox');
  if(box)return {west:Number(box.getAttribute('minx')),east:Number(box.getAttribute('maxx')),south:Number(box.getAttribute('miny')),north:Number(box.getAttribute('maxy'))};
 }
 return null;
}
function overlaps(a,b){return !b||a.west<b.east&&a.east>b.west&&a.south<b.north&&a.north>b.south;}
async function capabilities(url,source,signal){
 const response=await fetch(url+'?SERVICE=WMS&REQUEST=GetCapabilities&VERSION='+source.version,{signal:AbortSignal.any([signal,AbortSignal.timeout(18000)])});
 if(!response.ok)throw Error('HTTP '+response.status);
 const doc=new DOMParser().parseFromString(await response.text(),'application/xml');
 if(doc.querySelector('parsererror')||doc.getElementsByTagNameNS('*','ServiceException').length||!doc.getElementsByTagNameNS('*','Layer').length)throw Error('Źródło nie zwróciło katalogu warstw.');
 return doc;
}
export async function archiveItems(provider,signal,context){
 const source=WMS_SOURCES[provider];if(!source)throw Error('Nieobsługiwane źródło zdjęć.');
 const endpoints=[source.url,...(source.extraUrl?[source.extraUrl]:[])];
 const catalogs=await Promise.allSettled(endpoints.map(url=>capabilities(url,source,signal)));
 if(signal.aborted)throw signal.reason;
 const result=[];
 catalogs.forEach((catalog,index)=>{
  const endpoint=endpoints[index];
  if(catalog.status==='rejected'){
   result.push({id:provider+':catalog-error:'+index,provider,state:'error',catalogError:true,releaseDateLabel:'Archiwum',error:'Nie można odczytać katalogu: '+catalog.reason.message});
   return;
  }
  const layers=[...catalog.value.getElementsByTagNameNS('*','Layer')];
  if(provider==='geoportal_hd'){
   const layer=layers.find(el=>child(el,'Name')?.textContent.trim()===source.layer);
   if(!layer)throw Error('Brak warstwy ortofotomapy HD w katalogu.');
   let dimension=null;
   for(let node=layer;node&&!dimension;node=node.parentElement)dimension=[...node.children].find(el=>['Dimension','Extent'].includes(el.localName)&&el.getAttribute('name')==='time');
   const dates=dimension?.textContent.match(/\d{4}-\d{2}-\d{2}/g);
   if(!dates||dates.length<2)throw Error('Brak zakresu czasu ortofotomapy HD.');
   const first=Number(dates[0].slice(0,4)),last=Number(dates[1].slice(0,4));
   if(last-first>100||last<first)throw Error('Nieprawidłowy zakres lat.');
   for(let year=first;year<=last;year++)result.push({year:String(year),layer:source.layer,endpoint,time:year+'-01-01',coverage:coverage(layer),dateKind:'rok zapytania WMS; nie potwierdzona data ujęcia'});
  }else{
   for(const layer of layers){
    const name=child(layer,'Name')?.textContent.trim(),title=child(layer,'Title')?.textContent.trim()||'';
    const year=title.match(/^Ortofotomapa\s+((?:19|20)\d{2})/i)?.[1];
    if(!name||!year||/CIR|NDVI|opis|dron/i.test(title))continue;
    result.push({year,layer:name,endpoint,title,coverage:coverage(layer),dateKind:'rok ortofotomapy podany przez GEOPOZ; miesiąc nieznany'});
   }
  }
 });
 const images=result.filter(item=>item.year);
 if(!images.length&&!result.length)throw Error('Brak archiwalnych ortofotomap w katalogu.');
 return result.sort((a,b)=>Number(b.year||0)-Number(a.year||0)).map(v=>{
  if(v.catalogError)return v;
  const available=overlaps(context,v.coverage);
  return {...v,id:provider+':'+v.year+':'+endpoints.indexOf(v.endpoint)+':'+v.layer,provider,releaseDateLabel:v.year,exportLabel:v.year,state:available?'pending':'empty',error:available?'':'Obszar poza zasięgiem tej ortofotomapy.',license:source.license,attribution:source.attribution};
 });
}
export async function archiveImage(item,context,signal,imageBitmap,canvas){
 const source=WMS_SOURCES[item.provider];
 const params=new URLSearchParams({SERVICE:'WMS',VERSION:source.version,REQUEST:'GetMap',LAYERS:item.layer,STYLES:'',FORMAT:'image/png',TRANSPARENT:'TRUE',BBOX:[context.west,context.south,context.east,context.north].join(','),WIDTH:String(context.width),HEIGHT:String(context.height)});
 params.set(source.version==='1.3.0'?'CRS':'SRS',source.crs);
 if(item.time)params.set('TIME',item.time);
 item.sourceUrl=item.endpoint+'?'+params;
 const bitmap=await imageBitmap(item.sourceUrl,signal);
 try{
  const c=canvas(context.width,context.height),ctx=c.getContext('2d');
  for(let row=0;row<c.height;row++){
   const sourceRow=geographicSourceRow(row,c.height,bitmap.height,context.south,context.north);
   ctx.drawImage(bitmap,0,sourceRow,bitmap.width,1,0,row,c.width,1);
  }
  return c;
 }finally{bitmap.close();}
}
