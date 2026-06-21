import { Track } from '../types';

/**
 * Extracts a base64 or Blob URL cover art from ID3 APIC frames, Vorbis comment METADATA_BLOCK_PICTURE, or folder art files.
 */
export async function parseAudioMetadata(file: File, fileHandle?: FileSystemFileHandle): Promise<Omit<Track, 'id' | 'playCount' | 'addedAt'>> {
  const fileName = file.name;
  const fileSize = file.size;
  
  // Default fallbacks from filename
  let title = fileName.replace(/\.[^/.]+$/, ""); // strip extension
  let artist = 'Unknown Artist';
  let album = 'Unknown Album';
  let genre = 'Unknown Genre';

  // Try parsing file name formatted as "Artist - Title" or "01 - Artist - Title" or "01. Artist - Title"
  const cleanBase = title.trim();
  const dashParts = cleanBase.split(' - ');
  if (dashParts.length === 2) {
    artist = dashParts[0].trim();
    title = dashParts[1].trim();
  } else if (dashParts.length >= 3) {
    // Check if first part looks like a track number
    const trackPattern = /^\d+[\.\-_ ]?/;
    if (trackPattern.test(dashParts[0])) {
      artist = dashParts[1].trim();
      title = dashParts.slice(2).join(' - ').trim();
    } else {
      artist = dashParts[0].trim();
      title = dashParts.slice(1).join(' - ').trim();
    }
  }

  let artworkUrl: string | undefined = undefined;
  let artworkBlob: Blob | undefined = undefined;

  try {
    // Determine the exact ID3 tag size dynamically first to prevent truncation
    let headerSlice = file.slice(0, 10);
    let headerBuffer = await headerSlice.arrayBuffer();
    let headerView = new DataView(headerBuffer);

    let isID3 = false;
    let totalTagSize = 1024 * 256; // Fallback size for FLAC/OGG header parsing

    if (
      headerView.byteLength >= 10 &&
      headerView.getUint8(0) === 0x49 &&
      headerView.getUint8(1) === 0x44 &&
      headerView.getUint8(2) === 0x33
    ) {
      isID3 = true;
      const byte4 = headerView.getUint8(6);
      const byte3 = headerView.getUint8(7);
      const byte2 = headerView.getUint8(8);
      const byte1 = headerView.getUint8(9);
      // Synchronisation safe integer reconstruction
      const tagSize = ((byte4 & 0x7F) << 21) | ((byte3 & 0x7F) << 14) | ((byte2 & 0x7F) << 7) | (byte1 & 0x7F);
      totalTagSize = tagSize + 10;
    }

    // Limit dynamic slice depth to 12MB to safeguard memory for files with giant tag segments
    const tagBufferLimit = Math.min(totalTagSize, 12 * 1024 * 1024);
    const targetSlice = file.slice(0, isID3 ? tagBufferLimit : 1024 * 256);
    const arrayBuffer = await targetSlice.arrayBuffer();
    const view = new DataView(arrayBuffer);

    if (isID3 && view.byteLength > 10) {
      const majorVersion = view.getUint8(3);
      const isUnsynchronized = (view.getUint8(5) & 0x80) !== 0;

      let offset = 10;
      const maxOffset = Math.min(totalTagSize, view.byteLength - 10);

      while (offset < maxOffset - 10) {
        // Read Frame ID (4 characters)
        let frameId = '';
        for (let i = 0; i < 4; i++) {
          frameId += String.fromCharCode(view.getUint8(offset + i));
        }

        // Validate frame ID (uppercase letters and numbers)
        if (!/^[A-Z0-9]{4}$/.test(frameId)) {
          break; // Done or corrupted
        }

        // Read Frame Size
        let frameSize = 0;
        if (majorVersion === 4) {
          // Version 2.4 uses synchsafe size
          const f4 = view.getUint8(offset + 4);
          const f3 = view.getUint8(offset + 5);
          const f2 = view.getUint8(offset + 6);
          const f1 = view.getUint8(offset + 7);
          frameSize = ((f4 & 0x7F) << 21) | ((f3 & 0x7F) << 14) | ((f2 & 0x7F) << 7) | (f1 & 0x7F);
        } else {
          // Version 2.3 uses standard uint32 size
          frameSize = view.getUint32(offset + 4, false);
        }

        if (frameSize <= 0 || offset + 10 + frameSize > view.byteLength) {
          break;
        }

        const dataStart = offset + 10;
        
        // Handle common text frames
        if (frameId.startsWith('T') && frameId !== 'TXXX' && frameId !== 'TMCL') {
          const encoding = view.getUint8(dataStart);
          const textBytes = new Uint8Array(arrayBuffer, dataStart + 1, frameSize - 1);
          const decodedText = decodeText(textBytes, encoding);

          if (frameId === 'TIT2' && decodedText) title = decodedText;
          if (frameId === 'TPE1' && decodedText) artist = decodedText;
          if (frameId === 'TALB' && decodedText) album = decodedText;
          if (frameId === 'TCON' && decodedText) genre = decodedText;
        } 
        // Handle Album Cover (APIC frame)
        else if (frameId === 'APIC') {
          try {
            const encoding = view.getUint8(dataStart);
            let pIdx = dataStart + 1;

            // Read MIME Type (Null-terminated ASCII string)
            let mimeType = '';
            while (pIdx < view.byteLength && view.getUint8(pIdx) !== 0) {
              mimeType += String.fromCharCode(view.getUint8(pIdx));
              pIdx++;
            }
            pIdx++; // Skip null terminator

            // Picture type (1 byte)
            const pictureType = view.getUint8(pIdx);
            pIdx++;

            // Description (Null-terminated)
            if (encoding === 1 || encoding === 2) {
              // UTF-16 description (2 bytes null)
              while (pIdx < view.byteLength - 1 && !(view.getUint8(pIdx) === 0 && view.getUint8(pIdx+1) === 0)) {
                pIdx += 2;
              }
              pIdx += 2;
            } else {
              // UTF-8 / ISO-8859-1 description
              while (pIdx < view.byteLength && view.getUint8(pIdx) !== 0) {
                pIdx++;
              }
              pIdx++;
            }

            // The remaining bytes of the frame are the binary picture data
            const pictureDataOffset = pIdx;
            const pictureDataSize = (dataStart + frameSize) - pIdx;

            if (pictureDataSize > 0 && pictureDataOffset + pictureDataSize <= view.byteLength) {
              const imgBuffer = arrayBuffer.slice(pictureDataOffset, pictureDataOffset + pictureDataSize);
              const blob = new Blob([imgBuffer], { type: mimeType || 'image/jpeg' });
              artworkBlob = blob;
              artworkUrl = URL.createObjectURL(blob);
            }
          } catch (e) {
            console.error('Failed reading APIC metadata', e);
          }
        }

        offset += 10 + frameSize; // Move to next frame
      }
    } 
    // Handle FLAC metadata format (ends with "fLaC" bytes)
    else if (view.byteLength > 4 && view.getUint8(0) === 0x66 && view.getUint8(1) === 0x4C && view.getUint8(2) === 0x61 && view.getUint8(3) === 0x43) {
      // Very simple FLAC metadata block parsing
      let offset = 4;
      let lastBlock = false;

      while (!lastBlock && offset < view.byteLength - 4) {
        const header = view.getUint8(offset);
        lastBlock = (header & 0x80) !== 0;
        const blockType = header & 0x7F;
        
        const blockSize = (view.getUint8(offset + 1) << 16) | (view.getUint8(offset + 2) << 8) | view.getUint8(offset + 3);
        
        const blockStart = offset + 4;
        if (blockStart + blockSize > view.byteLength) {
          break;
        }

        // Block Type 4 is Vorbis Comment
        if (blockType === 4 && blockStart + blockSize <= view.byteLength) {
          try {
            const blockBytes = new Uint8Array(arrayBuffer, blockStart, blockSize);
            const decoder = new TextDecoder('utf-8');
            
            // Read vendor length (4 bytes list)
            const vendorLength = view.getUint32(blockStart, true);
            let cursor = blockStart + 4 + vendorLength;

            const commentListLength = view.getUint32(cursor, true);
            cursor += 4;

            for (let i = 0; i < commentListLength; i++) {
              if (cursor + 4 > blockStart + blockSize) break;
              const commentLength = view.getUint32(cursor, true);
              cursor += 4;

              if (cursor + commentLength > blockStart + blockSize) break;
              const commentBytes = new Uint8Array(arrayBuffer, cursor, commentLength);
              const commentStr = decoder.decode(commentBytes);
              cursor += commentLength;

              const splitIdx = commentStr.indexOf('=');
              if (splitIdx !== -1) {
                const key = commentStr.substring(0, splitIdx).toUpperCase();
                const val = commentStr.substring(splitIdx + 1);
                if (key === 'TITLE') title = val;
                if (key === 'ARTIST') artist = val;
                if (key === 'ALBUM') album = val;
                if (key === 'GENRE') genre = val;
              }
            }
          } catch (e) {
            console.error('Error parsing FLAC vorbis comments', e);
          }
        }
        // Block Type 6 is PICTURE
        else if (blockType === 6 && blockStart + blockSize <= view.byteLength) {
          try {
            // Read FLAC Picture Type
            let pCursor = blockStart;
            const pictureType = view.getUint32(pCursor, false);
            pCursor += 4;

            const mimeLen = view.getUint32(pCursor, false);
            pCursor += 4;

            const mimeBytes = new Uint8Array(arrayBuffer, pCursor, mimeLen);
            const mimeType = new TextDecoder('utf-8').decode(mimeBytes);
            pCursor += mimeLen;

            const descLen = view.getUint32(pCursor, false);
            pCursor += 4 + descLen; // Skip description

            const width = view.getUint32(pCursor, false);
            pCursor += 4;
            const height = view.getUint32(pCursor, false);
            pCursor += 12; // Skip height, depth, colors, plus picture data length

            const picDataLen = view.getUint32(pCursor, false);
            pCursor += 4;

            if (picDataLen > 0 && pCursor + picDataLen <= blockStart + blockSize) {
              const picBuffer = arrayBuffer.slice(pCursor, pCursor + picDataLen);
              const blob = new Blob([picBuffer], { type: mimeType || 'image/jpeg' });
              artworkBlob = blob;
              artworkUrl = URL.createObjectURL(blob);
            }
          } catch (e) {
            console.error('Error parsing FLAC artwork block', e);
          }
        }

        offset += 4 + blockSize;
      }
    }
  } catch (error) {
    console.error(`Metadata parsing error for ${fileName}:`, error);
  }

  // Calculate audio duration using a silent HTML5 element lookup
  let duration = 0;
  try {
    duration = await getAudioDuration(file);
  } catch (e) {
    console.warn(`Duration detection failed for ${fileName}, defaulting to 180s.`, e);
    duration = 180; // Reasonable fallback
  }

  // Format responses and handle clean empty states
  return {
    title: (title || 'Unknown Title').trim(),
    artist: (artist || 'Unknown Artist').trim(),
    album: (album || 'Unknown Album').trim(),
    genre: (genre || 'Unknown Genre').trim(),
    duration,
    fileName,
    fileSize,
    artworkUrl,
    artworkBlob
  };
}

/**
 * Text parsing helper based on ID3 character encodings
 */
function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) {
      // Latin-1 (ISO-8859-1)
      let out = '';
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0) break; // Terminated
        out += String.fromCharCode(bytes[i]);
      }
      return out;
    } else if (encoding === 1) {
      // UTF-16 (with BOM)
      const decoder = new TextDecoder('utf-16');
      return decoder.decode(bytes).replace(/\0+$/, "").trim();
    } else if (encoding === 2) {
      // UTF-16BE (without BOM)
      const decoder = new TextDecoder('utf-16be');
      return decoder.decode(bytes).replace(/\0+$/, "").trim();
    } else if (encoding === 3) {
      // UTF-8
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes).replace(/\0+$/, "").trim();
    }
  } catch (e) {
    console.error('Text decoding error', e);
  }
  return '';
}

/**
 * Native audio helper to extracts exact track length
 */
function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = Object.assign(document.createElement('audio'), {
      preload: 'metadata',
      src: URL.createObjectURL(file)
    });
    
    const timeout = setTimeout(() => {
      audio.src = '';
      reject(new Error('Audio duration metadata inquiry timeout'));
    }, 4000);

    audio.onloadedmetadata = () => {
      clearTimeout(timeout);
      const dur = audio.duration;
      // Revoke temporal visual assets
      URL.revokeObjectURL(audio.src);
      audio.src = '';
      if (!isNaN(dur) && isFinite(dur)) {
        resolve(dur);
      } else {
        resolve(180);
      }
    };

    audio.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(audio.src);
      audio.src = '';
      reject(audio.error || new Error('Audio file processing error'));
    };
  });
}
