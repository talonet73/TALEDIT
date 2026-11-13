import type { MediaAsset } from '../types/editor';
export async function importMediaFile(file: File, onProgress?:(percent:number)=>void): Promise<MediaAsset> {
  return new Promise((resolve,reject)=>{
    const request=new XMLHttpRequest();
    request.open('POST','/api/upload-media');
    request.setRequestHeader('Content-Type','application/octet-stream');
    request.setRequestHeader('x-filename',encodeURIComponent(file.name));
    request.upload.onprogress=event=>{if(event.lengthComputable)onProgress?.(Math.round(event.loaded/event.total*100));};
    request.onerror=()=>reject(new Error('Caricamento interrotto. Controlla la connessione e riprova.'));
    request.onabort=()=>reject(new Error('Importazione annullata.'));
    request.onload=()=>{
      try {
        const result=JSON.parse(request.responseText);
        if(request.status<200||request.status>=300||!result.success||!result.asset)throw new Error(result.error||`Importazione fallita: ${file.name}`);
        resolve(result.asset);
      }catch(error){reject(error instanceof SyntaxError?new Error(`Importazione fallita (HTTP ${request.status}).`):error);}
    };
    // Send the File directly: no arrayBuffer/base64 copy, even for 28 GB originals.
    request.send(file);
  });
}
