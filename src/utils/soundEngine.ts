import { AlarmSoundProfile } from '../types/sports';

/**
 * Web Audio API synthesizer for custom match & F1 session alarms.
 * Works offline with zero external audio dependencies.
 */
export function playAlarmAudio(profile: AlarmSoundProfile): void {
  if (typeof window === 'undefined') return;
  if (profile === 'SILENT_HAPTIC') {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([120, 60, 120]);
      } catch {
        // Ignore if unsupported
      }
    }
    return;
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (profile === 'BROADCAST_CHIME') {
      // Three-note Champions League / Broadcast style harmonic chime
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.13);

        gain.gain.setValueAtTime(0.001, now + idx * 0.13);
        gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.13 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.13 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.13);
        osc.stop(now + idx * 0.13 + 0.48);
      });
    } else if (profile === 'F1_PIT_SIREN') {
      // F1 Pit Lane dual-tone electronic alert beep (3 rapid pulses)
      for (let i = 0; i < 3; i++) {
        const start = now + i * 0.22;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, start);
        osc.frequency.linearRampToValueAtTime(1174.66, start + 0.14);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.19);
      }
    }
  } catch {
    // AudioContext blocked or unavailable in headless environment
  }
}
