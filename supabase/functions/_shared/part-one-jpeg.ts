import decode from './vendor/jpeg-js/decoder.mjs';

export const PART_ONE_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export class PrivateImageError extends Error {
  readonly code: 'payload_too_large'|'invalid_jpeg'|'image_dimensions_exceeded'|'image_metadata_present';
  constructor(code: PrivateImageError['code']) { super(code); this.code=code; }
}
/** Conservative derivative container allowlist. APP1/EXIF/XMP, ICC, comments,
 * embedded thumbnails and trailing payloads are rejected before decoding. */
export function inspectPrivateJpeg(bytes: Uint8Array): {width:number;height:number} {
  if (bytes.byteLength>PART_ONE_MAX_UPLOAD_BYTES) throw new PrivateImageError('payload_too_large');
  if(bytes.length<16||bytes[0]!==0xff||bytes[1]!==0xd8)throw new PrivateImageError('invalid_jpeg');
  let offset=2,width=0,height=0,frames=0,scans=0,jfif=false;
  while(offset<bytes.length){
    if(bytes[offset++]!==0xff)throw new PrivateImageError('invalid_jpeg');
    while(bytes[offset]===0xff)offset++;
    const marker=bytes[offset++];
    if(marker===0xd9){if(offset!==bytes.length||frames!==1||scans<1)throw new PrivateImageError('invalid_jpeg');return{width,height};}
    if(marker===0x00||marker===0xd8||marker===0x01||marker>=0xd0&&marker<=0xd7||offset+2>bytes.length)throw new PrivateImageError('invalid_jpeg');
    const length=(bytes[offset]<<8)|bytes[offset+1],start=offset+2,end=offset+length;
    if(length<2||end>bytes.length)throw new PrivateImageError('invalid_jpeg');
    if(marker>=0xe0&&marker<=0xef||marker===0xfe){
      if(marker!==0xe0||jfif||length!==16||bytes[start]!==0x4a||bytes[start+1]!==0x46||bytes[start+2]!==0x49||bytes[start+3]!==0x46
        ||bytes[start+4]!==0||bytes[start+12]!==0||bytes[start+13]!==0)throw new PrivateImageError('image_metadata_present');
      jfif=true;
    }else if(marker===0xc0||marker===0xc2){
      if(++frames!==1||length<11||bytes[start]!==8)throw new PrivateImageError('invalid_jpeg');
      height=(bytes[start+1]<<8)|bytes[start+2];width=(bytes[start+3]<<8)|bytes[start+4];
      const components=bytes[start+5];
      if(![1,3].includes(components)||length!==8+components*3||width<1||height<1)throw new PrivateImageError('invalid_jpeg');
      if(width>4096||height>4096)throw new PrivateImageError('image_dimensions_exceeded');
    }else if(![0xdb,0xc4,0xdd,0xda].includes(marker))throw new PrivateImageError('invalid_jpeg');
    offset=end;
    if(marker===0xda){
      if(frames!==1)throw new PrivateImageError('invalid_jpeg');scans++;
      // Entropy is decoded below. Here locate the next unstuffed non-restart
      // marker without accepting any post-image bytes or hidden APP payload.
      while(offset<bytes.length){
        if(bytes[offset]!==0xff){offset++;continue;}
        const next=bytes[offset+1];
        if(next===0x00||next>=0xd0&&next<=0xd7){offset+=2;continue;}
        break;
      }
    }
  }
  throw new PrivateImageError('invalid_jpeg');
}
/** A structural SOF alone is not sanitation proof: decode the bounded actual
 * stream, reject malformed entropy, and compare the decoded pixel dimensions. */
export function verifyPrivateJpeg(bytes:Uint8Array):{width:number;height:number} {
  const dimensions=inspectPrivateJpeg(bytes);
  try{
    const decoded=decode(bytes,{useTArray:true,formatAsRGBA:true,tolerantDecoding:false,maxResolutionInMP:17,maxMemoryUsageInMB:128});
    if(decoded.width!==dimensions.width||decoded.height!==dimensions.height||decoded.data.length!==dimensions.width*dimensions.height*4)
      throw new Error('dimensions');
    return dimensions;
  }catch{throw new PrivateImageError('invalid_jpeg');}
}
