import { useCallback, useEffect, useState } from 'react';
import type { ReactMicroFrontendProps } from '../../../src/react';
import { useBridgeContext, useBridgeEvent, useRuntimeBridge } from '../../../src/react';
import type { DemoContext, DemoEvents, DemoRequests, Pattern, TrackName } from '../contracts';

const tracks: TrackName[] = ['kick', 'clap', 'synth'];
const initialPattern: Pattern = {
  kick: [true, false, false, false, true, false, false, false],
  clap: [false, false, true, false, false, false, true, false],
  synth: [true, false, false, true, false, true, false, false],
};

function remix(seed: number): Pattern {
  let value = seed;
  const random = () => {
    value = (value * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return value / 4_294_967_296;
  };
  return Object.fromEntries(tracks.map((track, trackIndex) => [
    track,
    Array.from({ length: 8 }, (_, step) => step === trackIndex * 2 || random() > .62),
  ])) as unknown as Pattern;
}

export function RemoteApp({ path, navigate }: ReactMicroFrontendProps) {
  const context = useBridgeContext<DemoContext>();
  const bridge = useRuntimeBridge<DemoContext, DemoEvents, DemoRequests>();
  const [pattern, setPattern] = useState<Pattern>(initialPattern);
  const [message, setMessage] = useState('React sequencer ready · Angular clock armed');

  useEffect(() => {
    bridge.emit('sequencer.pattern', { pattern });
  }, [bridge, pattern]);

  const receiveRemix = useCallback(({ seed }: DemoEvents['studio.remix']) => {
    setPattern(remix(seed));
    setMessage('Angular rewrote React-owned state');
  }, []);
  useBridgeEvent<DemoContext, DemoEvents, 'studio.remix'>('studio.remix', receiveRemix);

  const receiveTick = useCallback(({ step, activeTracks }: DemoEvents['clock.tick']) => {
    const voices = activeTracks.length ? activeTracks.join(' + ') : 'rest';
    setMessage(`Tick ${step + 1} returned from Angular · ${voices}`);
  }, []);
  useBridgeEvent<DemoContext, DemoEvents, 'clock.tick'>('clock.tick', receiveTick);

  const toggleStep = (track: TrackName, step: number) => {
    setPattern((current) => ({
      ...current,
      [track]: current[track].map((active, index) => index === step ? !active : active),
    }));
  };

  const toggleTransport = () => {
    bridge.emit('transport.command', {
      command: context.playback.playing ? 'stop' : 'play',
      pattern,
    });
  };

  const analyze = async () => {
    setMessage('Angular is analyzing React’s groove…');
    const result = await bridge.request('groove.analyze', { pattern });
    setMessage(`${result.character.toUpperCase()} GROOVE · ${result.density}% density`);
  };

  return (
    <section className="remote-card sequencer" data-theme={context.theme}>
      <div className="remote-heading">
        <div>
          <span className="eyebrow">React-owned instrument</span>
          <h2>Eight-step signal composer</h2>
        </div>
        <span className="protocol">protocol {bridge.protocolVersion}</span>
      </div>

      <div className="sequencer-grid">
        <div className="step-numbers"><span />{Array.from({ length: 8 }, (_, step) => <b key={step}>{step + 1}</b>)}</div>
        {tracks.map((track) => (
          <div className="track" key={track}>
            <strong>{track}</strong>
            {pattern[track].map((active, step) => (
              <button
                aria-label={`${track} step ${step + 1}`}
                aria-pressed={active}
                className={`${active ? 'is-on' : ''} ${context.playback.currentStep === step ? 'is-current' : ''}`}
                key={step}
                onClick={() => toggleStep(track, step)}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="transport">
        <button onClick={toggleTransport}>{context.playback.playing ? '■ Stop Angular clock' : '▶ Start Angular clock'}</button>
        <button className="secondary" onClick={() => void analyze()}>Ask Angular to analyze groove</button>
        <button className="secondary" onClick={() => navigate(path === '/studio' ? '/studio/live' : '/studio')}>Sync route · {path}</button>
      </div>
      <p className="session-status" role="status">{message}</p>
    </section>
  );
}
