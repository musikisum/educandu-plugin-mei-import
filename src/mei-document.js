import { Spin } from 'antd';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import { useIsMounted } from '@educandu/educandu/ui/hooks.js';
import HttpClient from '@educandu/educandu/api-clients/http-client.js';
import { DEFAULT_SPACING_SYSTEM_VALUE } from './constants.js';
import { useService } from '@educandu/educandu/components/container-context.js';

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

function MeiDocument({ url, zoom, width, spacingSystem }) {
  const divRef = useRef(null);
  const isMounted = useIsMounted();
  const lastLoadedUrl = useRef(null);
  const httpClient = useService(HttpClient);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation('musikisum/educandu-plugin-mei-import');

  useEffect(() => {
    (async () => {
      if (!url) {
        lastLoadedUrl.current = null;
        if (isMounted.current && divRef.current) {
          divRef.current.innerHTML = '';
        }
        setHasError(false);
        setIsLoading(false);
        return;
      }

      // Only show the loading indicator when a new file has to be fetched and parsed, not when
      // just re-laying out the already loaded file for a changed zoom/spacing/width value.
      const isNewFile = url !== lastLoadedUrl.current;

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
          spacingSystem
        });

        if (isNewFile) {
          const res = await httpClient.get(url, { responseType: 'text', withCredentials: true });
          if (!isMounted.current) {
            return;
          }
          if (!toolkit.loadData(res.data)) {
            throw new Error('Verovio could not load the given file as MEI data');
          }
          // eslint-disable-next-line require-atomic-updates
          lastLoadedUrl.current = url;
        } else {
          toolkit.redoLayout();
        }

        const svg = toolkit.renderToSVG(1);
        if (isMounted.current && divRef.current) {
          divRef.current.innerHTML = svg;
        }
        setHasError(false);
      } catch (error) {
        // eslint-disable-next-line require-atomic-updates
        lastLoadedUrl.current = null;
        if (isMounted.current) {
          setHasError(true);
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
  }, [url, zoom, width, spacingSystem, httpClient, isMounted]);

  return (
    <div className="EP_Musikisum_MeiImport_Document">
      {!!isLoading && (
        <div className="EP_Musikisum_MeiImport_Document-spinner">
          <Spin size="large" />
        </div>
      )}
      {!!hasError && (
        <div className="EP_Musikisum_MeiImport_Document-error">{t('renderError')}</div>
      )}
      <div ref={divRef} />
    </div>
  );
}

MeiDocument.propTypes = {
  url: PropTypes.string,
  zoom: PropTypes.number,
  width: PropTypes.number,
  spacingSystem: PropTypes.number
};

MeiDocument.defaultProps = {
  url: null,
  zoom: 1,
  width: 100,
  spacingSystem: DEFAULT_SPACING_SYSTEM_VALUE
};

export default MeiDocument;
