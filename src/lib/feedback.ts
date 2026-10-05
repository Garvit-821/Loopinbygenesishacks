/**
 * Scan feedback: a short tone plus a haptic tap. Browsers only allow audio after a user gesture, so call
 * unlockAudio() from the tap that opens a scanner (Scan tab, door mode).
 */

const MUTE_STORAGE_KEY = 'loopin.feedback.muted';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext;
  const AudioContextClass =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    audioContext = new AudioContextClass();
  } catch {
    return null;
  }
  return audioContext;
}

/** Call inside a user gesture (click/tap handler) so later feedback can play sound. */
export function unlockAudio(): void {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === 'suspended') void context.resume().catch(() => undefined);
  // iOS only unlocks audio once a sound starts inside the gesture: play one silent sample.
  const source = context.createBufferSource();
  source.buffer = context.createBuffer(1, 1, 22_050);
  source.connect(context.destination);
  source.start(0);
}

export function isFeedbackMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setFeedbackMuted(muted: boolean): void {
  try {
    if (muted) window.localStorage.setItem(MUTE_STORAGE_KEY, '1');
    else window.localStorage.removeItem(MUTE_STORAGE_KEY);
  } catch {
    // Storage blocked: the preference lasts until reload.
  }
}

interface Tone {
  frequency: number;
  /** Seconds after the first tone starts. */
  at: number;
  duration: number;
}

function playTones(tones: readonly Tone[], wave: OscillatorType): void {
  if (isFeedbackMuted()) return;
  const context = getAudioContext();
  if (!context || context.state !== 'running') return;
  const start = context.currentTime;
  for (const tone of tones) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.value = tone.frequency;
    const begin = start + tone.at;
    const end = begin + tone.duration;
    // Short attack/decay envelope so the tone doesn't click.
    gain.gain.setValueAtTime(0.0001, begin);
    gain.gain.exponentialRampToValueAtTime(0.14, begin + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(begin);
    oscillator.stop(end + 0.02);
  }
}

function vibrate(pattern: VibratePattern): void {
  if (isFeedbackMuted()) return;
  // Haptics are motion; skip them when the user asked for less of it.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Some browsers throw when vibration is blocked by permissions policy.
  }
}

/** Rising two-note chime + one short tap. */
export function successFeedback(): void {
  playTones(
    [
      { frequency: 880, at: 0, duration: 0.09 },
      { frequency: 1318.5, at: 0.08, duration: 0.16 },
    ],
    'sine',
  );
  vibrate(35);
}

/** Single neutral note + a double tap (e.g. "already checked in"). */
export function warningFeedback(): void {
  playTones([{ frequency: 660, at: 0, duration: 0.18 }], 'sine');
  vibrate([40, 60, 40]);
}

/** Falling low tone + a longer buzz. */
export function errorFeedback(): void {
  playTones(
    [
      { frequency: 330, at: 0, duration: 0.14 },
      { frequency: 247, at: 0.15, duration: 0.22 },
    ],
    'triangle',
  );
  vibrate([80, 50, 80]);
}
