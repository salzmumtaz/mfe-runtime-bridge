export interface DemoContext {
  theme: 'light' | 'dark';
  locale: 'en' | 'fr';
  playback: {
    playing: boolean;
    bpm: number;
    currentStep: number;
    activeTracks: TrackName[];
  };
}

export type TrackName = 'kick' | 'clap' | 'synth';
export type Pattern = Record<TrackName, boolean[]>;

export interface DemoEvents {
  'transport.command': { command: 'play' | 'stop'; pattern: Pattern };
  'sequencer.pattern': { pattern: Pattern };
  'clock.tick': { step: number; activeTracks: TrackName[] };
  'studio.remix': { seed: number };
}

export interface DemoRequests {
  'groove.analyze': {
    input: { pattern: Pattern };
    output: { character: string; density: number };
  };
}
