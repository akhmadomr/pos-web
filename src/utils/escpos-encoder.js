export class EscPosEncoder {
  constructor() {
    this.buffer = []
  }

  // Helper to convert string to bytes (simplified to ASCII/Latin1)
  text(str) {
    for (let i = 0; i < str.length; i++) {
      let code = str.charCodeAt(i)
      if (code > 255) code = 63 // '?' for unsupported chars
      this.buffer.push(code)
    }
    return this
  }

  newline() {
    this.buffer.push(0x0a)
    return this
  }

  align(val) {
    const map = { left: 0, center: 1, right: 2 }
    this.buffer.push(0x1b, 0x61, map[val] ?? 0)
    return this
  }

  bold(val) {
    this.buffer.push(0x1b, 0x45, val ? 1 : 0)
    return this
  }

  size(val) {
    // 1 = normal, 2 = double width & height
    this.buffer.push(0x1d, 0x21, val === 2 ? 0x11 : 0x00)
    return this
  }

  cut() {
    this.buffer.push(0x1d, 0x56, 0x41, 0x03)
    return this
  }

  image(pixels, width, height) {
    // Gunakan ESC * (Bit Image Column Format) alih-alih GS v 0 (Raster)
    // ESC * jauh lebih stabil di printer Bluetooth murah karena gambar dipecah per 24-baris piksel
    const m = 33; // 33 = 24-dot double density
    const nL = width & 0xFF;
    const nH = (width >> 8) & 0xFF;
    
    // Set line spacing ke 24 dots agar gambar tidak terpotong garis putih
    this.buffer.push(0x1B, 0x33, 24);
    
    for (let y = 0; y < height; y += 24) {
      this.buffer.push(0x1B, 0x2A, m, nL, nH);
      
      for (let x = 0; x < width; x++) {
        for (let b = 0; b < 3; b++) {
          let byte = 0;
          for (let p = 0; p < 8; p++) {
            const py = y + (b * 8) + p;
            if (py < height && pixels[py * width + x]) {
              byte |= (1 << (7 - p));
            }
          }
          this.buffer.push(byte);
        }
      }
      this.buffer.push(0x0A); // Print line
    }
    
    // Kembalikan line spacing ke default (30)
    this.buffer.push(0x1B, 0x32);
    
    return this
  }

  encode() {
    return new Uint8Array(this.buffer)
  }
}

export function jsonToEscPos(payload) {
  const encoder = new EscPosEncoder()
  // Initialize printer
  encoder.buffer.push(0x1b, 0x40)

  const lines = payload.lines || []
  const PAPER_WIDTH = 32 // Standard 58mm characters width (32 chars)

  for (const line of lines) {
    if (line.type === 'align') {
      encoder.align(line.value)
    } else if (line.type === 'text') {
      if (line.bold) encoder.bold(true)
      if (line.size) encoder.size(line.size)
      encoder.text(line.value).newline()
      if (line.size) encoder.size(1)
      if (line.bold) encoder.bold(false)
    } else if (line.type === 'keyvalue') {
      if (line.bold) encoder.bold(true)
      if (line.size) encoder.size(line.size)
      
      const key = line.key || ''
      const val = line.value || ''
      const spaceLen = PAPER_WIDTH - key.length - val.length
      if (spaceLen > 0) {
        encoder.text(key + ' '.repeat(spaceLen) + val).newline()
      } else {
        encoder.text(key + ' ' + val).newline()
      }
      
      if (line.size) encoder.size(1)
      if (line.bold) encoder.bold(false)
    } else if (line.type === 'separator') {
      const char = line.style === 'dashed' ? '-' : '='
      encoder.text(char.repeat(PAPER_WIDTH)).newline()
    } else if (line.type === 'feed') {
      for (let i = 0; i < (line.lines || 1); i++) encoder.newline()
    } else if (line.type === 'image') {
      encoder.image(line.pixels, line.width, line.height)
    } else if (line.type === 'cut') {
      encoder.cut()
    }
  }

  return encoder.encode()
}
