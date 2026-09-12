// Web Audio API Sound Generator for instant POS feedback without external audio files

class POSAudioEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // Lazy audio context init on user gesture
  }

  private getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Crisp 1800Hz POS barcode scan chirp
   */
  public playScanBeep() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6 note
      osc.frequency.exponentialRampToValueAtTime(1900, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // ignore audio errors
    }
  }

  /**
   * Pleasant ascending two-tone chime for Payment Success or Checkout complete
   */
  public playSuccessChime() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const playTone = (freq: number, startOffset: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startOffset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startOffset);
        osc.stop(ctx.currentTime + startOffset + duration);
      };

      playTone(523.25, 0.0, 0.12); // C5
      playTone(659.25, 0.1, 0.12); // E5
      playTone(783.99, 0.2, 0.25); // G5
      playTone(1046.50, 0.32, 0.4); // C6
    } catch {
      // ignore audio errors
    }
  }

  /**
   * Low warning buzz for item not found or out of stock
   */
  public playErrorBuzz() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // ignore audio errors
    }
  }

  /**
   * Urgent warning siren/beep when requested quantity exceeds available stock
   */
  public playStockAlertSound() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const playBuzzPulse = (startTime: number, freq1: number, freq2: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq1, ctx.currentTime + startTime);
        osc.frequency.linearRampToValueAtTime(freq2, ctx.currentTime + startTime + duration);

        gain.gain.setValueAtTime(0.3, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
      };

      // Double urgent beep alert
      playBuzzPulse(0.0, 750, 320, 0.14);
      playBuzzPulse(0.18, 750, 320, 0.18);
    } catch {
      // ignore audio errors
    }
  }

  /**
   * Cash drawer pop click sound
   */
  public playCashSound() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // ignore
    }
  }

  /**
   * Subtle rhythmic stepper motor & thermal feed sound for invoice printing
   */
  public playReceiptPrintSound() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Series of subtle micro thermal print stepper clicks
      for (let i = 0; i < 8; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + (i * 0.08);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420 + (i % 2 === 0 ? 80 : -40), t);
        osc.frequency.exponentialRampToValueAtTime(160, t + 0.04);

        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.045);
      }
    } catch {
      // ignore
    }
  }
}

export const posAudio = new POSAudioEngine();
