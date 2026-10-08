// Public WMS archives. Dates and layers are read from provider capabilities.
export const SOURCE_NAMES={esri:'Esri Wayback',geoportal:'Geoportal',sentinel:'Sentinel-2 EOX'};
export const WMS_SOURCES={
 sentinel:{url:'https://tiles.maps.eox.at/wms',name:SOURCE_NAMES.sentinel,license:'CC BY 4.0 (2016); CC BY-NC-SA 4.0 (późniejsze). https://cloudless.eox.at/documentation/license',attribution:'EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data)',attributionHtml:'<a href="https://cloudless.eox.at">EOxCloudless</a> by <a href="https://eox.at">EOX</a> · modified Copernicus Sentinel data'}
};
export async function archiveItems(provider,signal){
 const source=WMS_SOURCES[provider];
 if(!source)throw Error('Nieobsługiwane źródło zdjęć.');
 const response=await fetch(source.url+'?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0',{signal:AbortSignal.any([signal,AbortSignal.timeout(18000)])});
 if(!response.ok)throw Error('Archiwum '+source.name+': HTTP '+response.status);
 const doc=new DOMParser().parseFromString(await response.text(),'application/xml');
 if(doc.querySelector('parsererror'))throw Error('Błędny katalog '+source.name);
 const child=(node,name)=>[...node.children].find(el=>el.localName===name)?.textContent.trim();
 const layers=[...doc.getElementsByTagNameNS('*','Layer')];
 const result=[];
 for(const layer of layers){
  const name=child(layer,'Name')||'';
  if(provider==='sentinel'){
   if(!/^s2cloudless(?:-\d{4})?_3857$/.test(name))continue;
   const year=name.match(/^s2cloudless-(\d{4})_/)?.[1]||'2016';
   if(year!=='2017')result.push({year,layer:name});
  }
 }
 if(!result.length)throw Error('Brak rocznych warstw w katalogu '+source.name+'.');
 return result.sort((a,b)=>Number(b.year)-Number(a.year)).map(v=>({...v,id:provider+':'+v.year,provider,releaseDateLabel:v.year,exportLabel:v.year,state:'pending',dateKind:'mozaika roczna; nie pojedyncza data ujęcia',license:source.license,attribution:provider==='sentinel'?'EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data '+(v.year==='2016'?'2016 & 2017':v.year==='2018'?'2017 & 2018':v.year)+')':source.attribution}));
}
export async function annualImage(item,context,signal,project,imageBitmap,canvas){
 const source=WMS_SOURCES[item.provider],sw=project(context.south,context.west),ne=project(context.north,context.east);
 const params=new URLSearchParams({SERVICE:'WMS',VERSION:'1.3.0',REQUEST:'GetMap',LAYERS:item.layer,STYLES:'',FORMAT:'image/png',TRANSPARENT:'TRUE',CRS:'EPSG:3857',BBOX:[sw.x,sw.y,ne.x,ne.y].join(','),WIDTH:String(context.width),HEIGHT:String(context.height)});
 if(item.time)params.set('TIME',item.time);
 item.sourceUrl=source.url+'?'+params;
 const bitmap=await imageBitmap(item.sourceUrl,signal);
 try{const c=canvas(context.width,context.height);c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);return c;}finally{bitmap.close();}
}
