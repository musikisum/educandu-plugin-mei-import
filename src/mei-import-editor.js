import { Alert, ColorPicker, Form, Select, Switch } from 'antd';
import { countNotes, extractVoices } from './mei-voice-utils.js';
import { useTranslation } from 'react-i18next';
import Info from '@educandu/educandu/components/info.js';
import UrlInput from '@educandu/educandu/components/url-input.js';
import StepSlider from '@educandu/educandu/components/step-slider.js';
import { useIsMounted } from '@educandu/educandu/ui/hooks.js';
import React, { useEffect, useState } from 'react';
import HttpClient from '@educandu/educandu/api-clients/http-client.js';
import {
  MAX_ZOOM_VALUE, MIN_ZOOM_VALUE,
  MAX_SPACING_SYSTEM_VALUE, MIN_SPACING_SYSTEM_VALUE,
  MAX_MEASURES_PER_LINE_VALUE, MIN_MEASURES_PER_LINE_VALUE,
  LARGE_FILE_SIZE_WARNING_THRESHOLD_IN_BYTES,
  MAX_NOTE_COUNT_FOR_PLAYBACK
} from './constants.js';
import MarkdownInput from '@educandu/educandu/components/markdown-input.js';
import ClientConfig from '@educandu/educandu/bootstrap/client-config.js';
import { ensureAreExcluded } from '@educandu/educandu/utils/array-utils.js';
import { sectionEditorProps } from '@educandu/educandu/ui/default-prop-types.js';
import ObjectWidthSlider from '@educandu/educandu/components/object-width-slider.js';
import { useService } from '@educandu/educandu/components/container-context.js';
import { usePercentageFormat } from '@educandu/educandu/components/locale-context.js';
import { FORM_ITEM_LAYOUT, SOURCE_TYPE } from '@educandu/educandu/domain/constants.js';
import { getAccessibleUrl, isInternalSourceType } from '@educandu/educandu/utils/source-utils.js';

const FormItem = Form.Item;

export default function MeiImportEditor({ content, onContentChanged }) {
  const { t } = useTranslation('musikisum/educandu-plugin-mei-import');
  const isMounted = useIsMounted();
  const clientConfig = useService(ClientConfig);
  const httpClient = useService(HttpClient);
  const percentageFormatter = usePercentageFormat();
  const [isFileTooLarge, setIsFileTooLarge] = useState(false);
  const [voices, setVoices] = useState([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [isTooLargeForPlayback, setIsTooLargeForPlayback] = useState(false);

  const { sourceUrl, zoom, spacingSystem, measuresPerLine, width, caption, playbackEnabled, highlightedVoice, highlightColor } = content;

  useEffect(() => {
    setIsFileTooLarge(false);

    if (!sourceUrl) {
      return () => {};
    }

    const actualUrl = getAccessibleUrl({ url: sourceUrl, cdnRootUrl: clientConfig.cdnRootUrl });
    // Only send the user's session cookies for the app's own CDN-hosted content - external hosts
    // typically respond with a wildcard Access-Control-Allow-Origin, which browsers reject for
    // credentialed requests.
    const withCredentials = isInternalSourceType({ url: sourceUrl, cdnRootUrl: clientConfig.cdnRootUrl });
    const abortController = new AbortController();

    (async () => {
      try {
        const res = await fetch(actualUrl, {
          method: 'HEAD',
          credentials: withCredentials ? 'include' : 'omit',
          signal: abortController.signal
        });
        const contentLength = Number(res.headers.get('content-length'));
        if (isMounted.current && contentLength > LARGE_FILE_SIZE_WARNING_THRESHOLD_IN_BYTES) {
          setIsFileTooLarge(true);
        }
      } catch {
        // The file size is only used for a soft warning, so a failed HEAD request (e.g. no
        // CORS support on an external host) is not worth surfacing as an error to the user.
      }
    })();

    return () => abortController.abort();
  }, [sourceUrl, clientConfig, isMounted]);

  useEffect(() => {
    setVoices([]);
    setIsTooLargeForPlayback(false);

    if (!playbackEnabled || !sourceUrl) {
      return () => {};
    }

    const actualUrl = getAccessibleUrl({ url: sourceUrl, cdnRootUrl: clientConfig.cdnRootUrl });
    const withCredentials = isInternalSourceType({ url: sourceUrl, cdnRootUrl: clientConfig.cdnRootUrl });
    const abortController = new AbortController();

    (async () => {
      setIsLoadingVoices(true);
      try {
        const res = await httpClient.get(actualUrl, {
          responseType: 'text',
          withCredentials,
          signal: abortController.signal
        });
        if (isMounted.current) {
          setVoices(extractVoices(res.data));
          setIsTooLargeForPlayback(countNotes(res.data) > MAX_NOTE_COUNT_FOR_PLAYBACK);
        }
      } catch {
        // Voice detection is a soft convenience feature for the dropdown below - if the file
        // can't be fetched/parsed here, the user simply won't get a voice list to pick from.
      } finally {
        if (isMounted.current) {
          setIsLoadingVoices(false);
        }
      }
    })();

    return () => abortController.abort();
  }, [playbackEnabled, sourceUrl, clientConfig, httpClient, isMounted]);

  const triggerContentChanged = newContentValues => {
    onContentChanged({ ...content, ...newContentValues });
  };

  const handleSourceUrlChange = value => {
    triggerContentChanged({ sourceUrl: value });
  };

  const handleZoomChange = newValue => {
    triggerContentChanged({ zoom: newValue });
  };

  const handleSpacingSystemChange = newValue => {
    triggerContentChanged({ spacingSystem: newValue });
  };

  const handleMeasuresPerLineChange = newValue => {
    triggerContentChanged({ measuresPerLine: newValue });
  };

  const formatMeasuresPerLine = value => value === 0 ? t('automatic') : value.toString();

  const handleWidthChange = newValue => {
    triggerContentChanged({ width: newValue });
  };

  const handleCaptionChange = event => {
    triggerContentChanged({ caption: event.target.value });
  };

  const handlePlaybackEnabledChange = newValue => {
    triggerContentChanged({ playbackEnabled: newValue });
  };

  const handleHighlightedVoiceChange = newValue => {
    triggerContentChanged({ highlightedVoice: newValue });
  };

  const handleHighlightColorChange = color => {
    triggerContentChanged({ highlightColor: color.toHexString() });
  };

  const voiceSelectOptions = [
    { value: '', label: t('noVoiceHighlighted') },
    ...voices.map(voice => ({
      value: voice.key,
      label: voice.label || t('voiceFallbackLabel', { staffN: voice.staffN, layerN: voice.layerN })
    }))
  ];

  const allowedSourceTypes = ensureAreExcluded(Object.values(SOURCE_TYPE), [SOURCE_TYPE.youtube, SOURCE_TYPE.wikimedia]);

  return (
    <div className="EP_Musikisum_MeiImport_Editor">
      <Form layout="horizontal" labelAlign="left">
        <FormItem {...FORM_ITEM_LAYOUT} label={t('common:url')}>
          <UrlInput value={sourceUrl} onChange={handleSourceUrlChange} allowedSourceTypes={allowedSourceTypes} />
        </FormItem>
        {!!isFileTooLarge && (
          <FormItem {...FORM_ITEM_LAYOUT} label={' '} colon={false}>
            <Alert type="warning" showIcon message={t('largeFileWarning')} />
          </FormItem>
        )}
        <Form.Item label={t('common:caption')} {...FORM_ITEM_LAYOUT}>
          <MarkdownInput inline value={caption} onChange={handleCaptionChange} />
        </Form.Item>
        <Form.Item label={t('zoom')} {...FORM_ITEM_LAYOUT}>
          <StepSlider
            step={0.05}
            value={zoom}
            marksStep={0.05}
            labelsStep={0.25}
            min={MIN_ZOOM_VALUE}
            max={MAX_ZOOM_VALUE}
            onChange={handleZoomChange}
            formatter={percentageFormatter}
            />
        </Form.Item>
        <Form.Item label={t('spacingSystem')} {...FORM_ITEM_LAYOUT}>
          <StepSlider
            step={1}
            value={spacingSystem}
            marksStep={6}
            labelsStep={12}
            min={MIN_SPACING_SYSTEM_VALUE}
            max={MAX_SPACING_SYSTEM_VALUE}
            onChange={handleSpacingSystemChange}
            />
        </Form.Item>
        <Form.Item
          label={<Info tooltip={t('measuresPerLineInfo')}>{t('measuresPerLine')}</Info>}
          {...FORM_ITEM_LAYOUT}
          >
          <StepSlider
            step={1}
            value={measuresPerLine}
            marksStep={2}
            labelsStep={4}
            min={MIN_MEASURES_PER_LINE_VALUE}
            max={MAX_MEASURES_PER_LINE_VALUE}
            onChange={handleMeasuresPerLineChange}
            formatter={formatMeasuresPerLine}
            />
        </Form.Item>
        <Form.Item
          label={<Info tooltip={t('common:widthInfo')}>{t('common:width')}</Info>}
          {...FORM_ITEM_LAYOUT}
          >
          <ObjectWidthSlider value={width} onChange={handleWidthChange} />
        </Form.Item>
        <Form.Item
          label={<Info tooltip={t('playbackEnabledInfo')}>{t('playbackEnabled')}</Info>}
          {...FORM_ITEM_LAYOUT}
          >
          <Switch checked={playbackEnabled} onChange={handlePlaybackEnabledChange} />
        </Form.Item>
        {!!playbackEnabled && !!isTooLargeForPlayback && (
          <FormItem {...FORM_ITEM_LAYOUT} label={' '} colon={false}>
            <Alert type="warning" showIcon message={t('playbackTooLargeWarning')} />
          </FormItem>
        )}
        {!!playbackEnabled && (
          <Form.Item
            label={<Info tooltip={t('highlightedVoiceInfo')}>{t('highlightedVoice')}</Info>}
            {...FORM_ITEM_LAYOUT}
            >
            <Select
              value={highlightedVoice}
              onChange={handleHighlightedVoiceChange}
              loading={isLoadingVoices}
              options={voiceSelectOptions}
              />
          </Form.Item>
        )}
        {!!playbackEnabled && (
          <Form.Item label={t('highlightColor')} {...FORM_ITEM_LAYOUT}>
            <ColorPicker value={highlightColor} onChange={handleHighlightColorChange} disabledAlpha />
          </Form.Item>
        )}
      </Form>
    </div>
  );
}

MeiImportEditor.propTypes = {
  ...sectionEditorProps
};
