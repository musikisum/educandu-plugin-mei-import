import { Alert } from 'antd';
import PropTypes from 'prop-types';
import Logger from '@educandu/educandu/common/logger.js';
import { useTranslation } from 'react-i18next';
import { MAX_NOTE_COUNT_FOR_PLAYBACK } from './constants.js';
import { handleError } from '@educandu/educandu/ui/error-helper.js';
import MediaPlayer from '@educandu/educandu/components/media-player/media-player.js';
import { MEDIA_SCREEN_MODE } from '@educandu/educandu/domain/constants.js';
import React, { useEffect, useRef, useState } from 'react';
import { useIsMounted, useOnComponentUnmount } from '@educandu/educandu/ui/hooks.js';
import MediaPlayerProgressBar from '@educandu/educandu/components/media-player/media-player-progress-bar.js';
import MediaPlayerControls, { MEDIA_PLAYER_CONTROLS_STATE } from '@educandu/educandu/components/media-player/media-player-controls.js';

const logger = new Logger(import.meta.url);

const VOLUME = 1;
const HIGHLIGHTED_VOICE_VELOCITY = 100;
const OTHER_VOICE_VELOCITY = 45;
const DOWNLOAD_FILE_NAME = 'wiedergabe.wav';

const registerUrlForDisposal = url => url && setTimeout(() => URL.revokeObjectURL(url), 1000);

function MeiPlayback({ noteEvents, highlightedVoice }) {
  const { t } = useTranslation('musikisum/educandu-plugin-mei-import');
  const isMounted = useIsMounted();
  const mediaPlayerRef = useRef(null);
  const lastNoteEvents = useRef(null);
  const [soundUrl, setSoundUrl] = useState(null);
  const [hasStartedRendering, setHasStartedRendering] = useState(false);
  const [shouldPlayAfterRendering, setShouldPlayAfterRendering] = useState(false);

  lastNoteEvents.current = noteEvents;

  const isTooLargeForPlayback = noteEvents.length > MAX_NOTE_COUNT_FOR_PLAYBACK;

  useEffect(() => {
    setShouldPlayAfterRendering(false);
  }, [noteEvents, highlightedVoice]);

  useOnComponentUnmount(() => {
    registerUrlForDisposal(soundUrl);
  });

  // Rendering (and with it, the fetch of the external piano samples) is only started once the
  // user has actively clicked "play" at least once (see handlePlayClick), never automatically
  // just because a voice was selected or the notation was loaded.
  useEffect(() => {
    if (!hasStartedRendering || !noteEvents.length || isTooLargeForPlayback || !isMounted.current) {
      return;
    }

    (async () => {
      try {
        const { renderOffline, SplendidGrandPiano, Scheduler } = await import('smplr');

        const lastNoteEndMs = Math.max(...noteEvents.map(event => event.startMs + event.durationMs));
        const durationInSeconds = (lastNoteEndMs / 1000) + 1;
        const uniqueMidiNumbers = [...new Set(noteEvents.map(event => event.midiNumber))];

        const result = await renderOffline(async context => {
          // smplr's default scheduler only dispatches note-on events that fall within a short
          // (200ms) real-time lookahead window; anything further out is queued and dispatched
          // later by polling context.currentTime on a real-time setInterval. Inside an
          // OfflineAudioContext that polling never catches up (rendering isn't tied to wall-clock
          // time), so only the very first note(s) would ever actually sound. Widening the
          // lookahead to cover the whole piece makes every note dispatch synchronously up front,
          // which is what offline rendering needs.
          // eslint-disable-next-line new-cap
          const scheduler = Scheduler(context, { lookaheadMs: (durationInSeconds * 1000) + 1000 });
          // Only fetch the piano samples actually needed (pitches used in the piece, and only the
          // two velocity layers we ever play at) instead of the full multi-octave, multi-velocity
          // sample set - for large, long pieces this cuts the number of sample files fetched (and
          // thus the time until playback is ready) considerably.
          const piano = await new SplendidGrandPiano(context, {
            scheduler,
            notesToLoad: { notes: uniqueMidiNumbers, velocityRange: [OTHER_VOICE_VELOCITY, HIGHLIGHTED_VOICE_VELOCITY] }
          }).load;
          for (const event of noteEvents) {
            const isHighlighted = !highlightedVoice || event.voiceKey === highlightedVoice;
            piano.start({
              note: event.midiNumber,
              time: event.startMs / 1000,
              duration: event.durationMs / 1000,
              velocity: isHighlighted ? HIGHLIGHTED_VOICE_VELOCITY : OTHER_VOICE_VELOCITY
            });
          }
        }, { duration: durationInSeconds });

        if (noteEvents === lastNoteEvents.current && isMounted.current) {
          setSoundUrl(oldValue => {
            registerUrlForDisposal(oldValue);
            return URL.createObjectURL(result.toWav());
          });
        }
      } catch (error) {
        handleError({ message: error.message, error, logger, t });
      }
    })();
  }, [hasStartedRendering, noteEvents, highlightedVoice, isTooLargeForPlayback, isMounted, t]);

  const handlePlayClick = () => {
    setShouldPlayAfterRendering(true);
    setHasStartedRendering(true);
  };

  const handleMediaPlayerDuration = () => {
    if (shouldPlayAfterRendering) {
      setTimeout(() => mediaPlayerRef.current.play(), 0);
    }
    setShouldPlayAfterRendering(false);
  };

  if (isTooLargeForPlayback) {
    return (
      <div className="EP_Musikisum_MeiImport_Playback">
        <Alert type="warning" showIcon message={t('playbackTooLargeWarning')} />
      </div>
    );
  }

  let controlsState;
  if (!noteEvents.length) {
    controlsState = MEDIA_PLAYER_CONTROLS_STATE.disabled;
  } else if (!hasStartedRendering) {
    controlsState = MEDIA_PLAYER_CONTROLS_STATE.waiting;
  } else if (!soundUrl) {
    controlsState = MEDIA_PLAYER_CONTROLS_STATE.loading;
  } else {
    controlsState = null;
  }

  if (controlsState) {
    return (
      <div className="EP_Musikisum_MeiImport_Playback">
        <div className="EP_Musikisum_MeiImport_Playback-controls">
          <MediaPlayerProgressBar disabled />
          <MediaPlayerControls
            allowLoop
            allowDownload
            allowPlaybackRate
            state={controlsState}
            volume={VOLUME}
            onPlayClick={handlePlayClick}
            />
        </div>
      </div>
    );
  }

  return (
    <div className="EP_Musikisum_MeiImport_Playback">
      <MediaPlayer
        allowLoop
        allowDownload
        allowPlaybackRate
        sourceUrl={soundUrl}
        volume={VOLUME}
        mediaPlayerRef={mediaPlayerRef}
        screenMode={MEDIA_SCREEN_MODE.none}
        downloadFileName={DOWNLOAD_FILE_NAME}
        onDuration={handleMediaPlayerDuration}
        />
    </div>
  );
}

MeiPlayback.propTypes = {
  noteEvents: PropTypes.arrayOf(PropTypes.shape({
    midiNumber: PropTypes.number.isRequired,
    voiceKey: PropTypes.string.isRequired,
    startMs: PropTypes.number.isRequired,
    durationMs: PropTypes.number.isRequired
  })),
  highlightedVoice: PropTypes.string
};

MeiPlayback.defaultProps = {
  noteEvents: [],
  highlightedVoice: ''
};

export default MeiPlayback;
