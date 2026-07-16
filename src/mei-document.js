import { Spin } from 'antd';
import MeiPlayback from './mei-playback.js';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import { useIsMounted } from '@educandu/educandu/ui/hooks.js';
import { applyMeasuresPerLine } from './mei-layout-utils.js';
import HttpClient from '@educandu/educandu/api-clients/http-client.js';
import { useService } from '@educandu/educandu/components/container-context.js';
import { buildNoteEvents, buildVoiceInfoByNoteId } from './mei-voice-utils.js';
import { DEFAULT_HIGHLIGHT_COLOR_VALUE, DEFAULT_MEASURES_PER_LINE_VALUE, DEFAULT_SPACING_SYSTEM_VALUE } from './constants.js';

// Verovio reports the specific reason a file failed to load (e.g. "No <body> element found in
// the MEI data") only via console.error/console.warn, not via a return value or thrown error.
// Capturing those messages lets the UI show that specific reason instead of a generic
// "not a valid MEI file" message, which is misleading for files that are well-formed XML/MEI but
// simply contain no notation (e.g. metadata-only exports).
/* eslint-disable no-console */
function captureVerovioMessages(callback) {
  const messages = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...args) => messages.push(args.join(' ').trim());
  console.warn = (...args) => messages.push(args.join(' ').trim());
  try {
    return { result: callback(), messages };
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
  /* eslint-enable no-console */
}

let verovioToolkitPromise = null;

function loadVerovioToolkit() {
  verovioToolkitPromise ??= Promise.all([
    import('verovio/wasm'),
    import('verovio/esm')
  ]).then(async ([{ default: createVerovioModule }, { VerovioToolkit }]) => {
    const verovioModule = await createVerovioModule();
    return new VerovioToolkit(verovioModule);
  });

  return verovioToolkitPromise;
}

function MeiDocument({ url, withCredentials, zoom, width, spacingSystem, measuresPerLine, playbackEnabled, highlightedVoice, highlightColor }) {
  const divRef = useRef(null);
  const isMounted = useIsMounted();
  const lastLoadedUrl = useRef(null);
  const lastRawMeiData = useRef(null);
  const lastLoadedMeasuresPerLine = useRef(null);
  const httpClient = useService(HttpClient);
  const [hasError, setHasError] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [noteEvents, setNoteEvents] = useState([]);
  const { t } = useTranslation('musikisum/educandu-plugin-mei-import');

  useEffect(() => {
    (async () => {
      if (!url) {
        lastLoadedUrl.current = null;
        lastRawMeiData.current = null;
        lastLoadedMeasuresPerLine.current = null;
        if (isMounted.current && divRef.current) {
          divRef.current.innerHTML = '';
        }
        setHasError(false);
        setErrorDetails('');
        setIsLoading(false);
        setNoteEvents([]);
        return;
      }

      // Only show the loading indicator when a new file has to be fetched and parsed, not when
      // just re-laying out the already loaded file for a changed zoom/spacing/width value.
      const isNewFile = url !== lastLoadedUrl.current;
      // A measuresPerLine change needs the (cached) MEI data to be re-parsed and reloaded into
      // the toolkit (it changes the actual document content via injected system breaks), unlike
      // zoom/spacing/width changes, which only need a cheap redoLayout on the already-loaded data.
      const needsReload = isNewFile || measuresPerLine !== lastLoadedMeasuresPerLine.current;

      try {
        if (isNewFile) {
          setIsLoading(true);
        }

        const toolkit = await loadVerovioToolkit();
        if (!isMounted.current || !divRef.current) {
          return;
        }

        const scale = Math.round(zoom * 100);
        const containerWidth = divRef.current.clientWidth;

        // Verovio lays out systems for the given pageWidth *before* applying scale, so the
        // container's actual pixel width has to be inflated by the inverse of the scale
        // factor, otherwise scaled-down/up content would wrap at the wrong point.
        // pageHeight is set to the toolkit's maximum and adjustPageHeight shrinks the result
        // back down to the actual content height, so the whole piece renders as a single,
        // non-paginated page instead of being cut off after the first page.
        toolkit.setOptions({
          scale,
          adjustPageHeight: true,
          pageWidth: Math.round(containerWidth * 100 / scale),
          pageHeight: 60000,
          spacingSystem,
          breaks: measuresPerLine > 0 ? 'encoded' : 'auto'
        });

        if (needsReload) {
          if (isNewFile) {
            const res = await httpClient.get(url, { responseType: 'text', withCredentials });
            if (!isMounted.current) {
              return;
            }
            // eslint-disable-next-line require-atomic-updates
            lastRawMeiData.current = res.data;
            // eslint-disable-next-line require-atomic-updates
            lastLoadedUrl.current = url;
          }

          const meiData = applyMeasuresPerLine(lastRawMeiData.current, measuresPerLine);
          const { result: isLoaded, messages } = captureVerovioMessages(() => toolkit.loadData(meiData));
          if (!isLoaded) {
            throw new Error(messages.join(' ') || 'Verovio could not load the given file as MEI data');
          }
          // eslint-disable-next-line require-atomic-updates
          lastLoadedMeasuresPerLine.current = measuresPerLine;
        } else {
          toolkit.redoLayout();
        }

        // Note events and voice highlighting are derived from the toolkit's *currently loaded*
        // document, so they can be (re-)computed here regardless of whether this run reloaded
        // the data or just redid the layout (e.g. playbackEnabled was toggled on for content
        // that was already loaded).
        let newNoteEvents = [];
        let highlightedNoteIds = null;
        if (playbackEnabled) {
          const voiceInfoByNoteId = buildVoiceInfoByNoteId(toolkit.getMEI());
          newNoteEvents = buildNoteEvents(voiceInfoByNoteId, toolkit.renderToTimemap());
          if (highlightedVoice) {
            highlightedNoteIds = new Set(
              [...voiceInfoByNoteId]
                .filter(([, voiceInfo]) => voiceInfo.voiceKey === highlightedVoice)
                .map(([id]) => id)
            );
          }
        }

        const svg = toolkit.renderToSVG(1);
        if (isMounted.current && divRef.current) {
          divRef.current.innerHTML = svg;
          if (highlightedNoteIds) {
            for (const noteGroup of divRef.current.querySelectorAll('.note')) {
              if (highlightedNoteIds.has(noteGroup.id)) {
                noteGroup.style.fill = highlightColor;
                noteGroup.style.stroke = highlightColor;
              }
            }
          }
        }
        setNoteEvents(newNoteEvents);
        setHasError(false);
        setErrorDetails('');
      } catch (error) {
        // eslint-disable-next-line require-atomic-updates
        lastLoadedUrl.current = null;
        // eslint-disable-next-line require-atomic-updates
        lastRawMeiData.current = null;
        // eslint-disable-next-line require-atomic-updates
        lastLoadedMeasuresPerLine.current = null;
        if (isMounted.current) {
          setHasError(true);
          setErrorDetails(error.message || '');
          setNoteEvents([]);
          if (divRef.current) {
            divRef.current.innerHTML = '';
          }
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    })();
  }, [url, withCredentials, zoom, width, spacingSystem, measuresPerLine, playbackEnabled, highlightedVoice, highlightColor, httpClient, isMounted]);

  return (
    <div className="EP_Musikisum_MeiImport_Document">
      {!!isLoading && (
        <div className="EP_Musikisum_MeiImport_Document-spinner">
          <Spin size="large" />
        </div>
      )}
      {!!hasError && (
        <div className="EP_Musikisum_MeiImport_Document-error">
          <div>{t('renderError')}</div>
          {!!errorDetails && (
            <div className="EP_Musikisum_MeiImport_Document-errorDetails">{errorDetails}</div>
          )}
        </div>
      )}
      <div ref={divRef} />
      {!!playbackEnabled && !!noteEvents.length && (
        <MeiPlayback noteEvents={noteEvents} highlightedVoice={highlightedVoice} />
      )}
    </div>
  );
}

MeiDocument.propTypes = {
  url: PropTypes.string,
  withCredentials: PropTypes.bool,
  zoom: PropTypes.number,
  width: PropTypes.number,
  spacingSystem: PropTypes.number,
  measuresPerLine: PropTypes.number,
  playbackEnabled: PropTypes.bool,
  highlightedVoice: PropTypes.string,
  highlightColor: PropTypes.string
};

MeiDocument.defaultProps = {
  url: null,
  withCredentials: true,
  zoom: 1,
  width: 100,
  spacingSystem: DEFAULT_SPACING_SYSTEM_VALUE,
  measuresPerLine: DEFAULT_MEASURES_PER_LINE_VALUE,
  playbackEnabled: false,
  highlightedVoice: '',
  highlightColor: DEFAULT_HIGHLIGHT_COLOR_VALUE
};

export default MeiDocument;
