/**
 * useSound — composable untuk audio feedback di POS.
 * Menggunakan Web Audio API agar tidak perlu file audio external.
 */
export function useSound() {
  let audioCtx = null

  function getCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioCtx
  }

  /**
   * Bunyikan nada singkat.
   * @param {number} frequency - Hz
   * @param {number} duration  - detik
   * @param {string} type      - OscillatorType (sine|square|sawtooth|triangle)
   * @param {number} gain      - volume 0–1
   */
  function beep(frequency = 800, duration = 0.1, type = 'sine', gain = 0.3) {
    try {
      const ctx = getCtx()
      const osc = ctx.createOscillator()
      const vol = ctx.createGain()

      osc.connect(vol)
      vol.connect(ctx.destination)

      osc.type = type
      osc.frequency.setValueAtTime(frequency, ctx.currentTime)
      vol.gain.setValueAtTime(gain, ctx.currentTime)
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + duration)
    } catch {
      // Audio tidak tersedia, abaikan
    }
  }

  /** Suara saat item berhasil ditambah ke keranjang */
  function playAddItem() {
    beep(880, 0.08, 'sine', 0.25)
  }

  /** Suara konfirmasi pembayaran berhasil */
  function playPaymentSuccess() {
    beep(660, 0.1, 'sine', 0.3)
    setTimeout(() => beep(880, 0.15, 'sine', 0.3), 120)
    setTimeout(() => beep(1100, 0.2, 'sine', 0.3), 260)
  }

  /** Suara error / aksi tidak valid */
  function playError() {
    beep(300, 0.15, 'square', 0.2)
  }

  /** Suara scan/barcode */
  function playScan() {
    beep(1200, 0.05, 'sine', 0.2)
  }

  return {
    beep,
    playAddItem,
    playPaymentSuccess,
    playError,
    playScan,
  }
}
