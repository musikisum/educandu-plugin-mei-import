import { Alert, Form } from 'antd';
import { useTranslation } from 'react-i18next';
import Info from '@educandu/educandu/components/info.js';
import UrlInput from '@educandu/educandu/components/url-input.js';
import StepSlider from '@educandu/educandu/components/step-slider.js';
import { useIsMounted } from '@educandu/educandu/ui/hooks.js';
import React, { useEffect, useState } from 'react';
import {
  MAX_ZOOM_VALUE, MIN_ZOOM_VALUE,
  MAX_SPACING_SYSTEM_VALUE, MIN_SPACING_SYSTEM_VALUE,
  LARGE_FILE_SIZE_WARNING_THRESHOLD_IN_BYTES
} from './constants.js';
import MarkdownInput from '@educandu/educandu/components/markdown-input.js';
import ClientConfig from '@educandu/educandu/bootstrap/client-config.js';
import { ensureAreExcluded } from '@educandu/educandu/utils/array-utils.js';
import { sectionEditorProps } from '@educandu/educandu/ui/default-prop-types.js';
import ObjectWidthSlider from '@educandu/educandu/components/object-width-slider.js';
import { useService } from '@educandu/educandu/components/container-context.js';
import { usePercentageFormat } from '@educandu/educandu/components/locale-context.js';
import { FORM_ITEM_LAYOUT, SOURCE_TYPE } from '@educandu/educandu/domain/constants.js';
import { getAccessibleUrl } from '@educandu/educandu/utils/source-utils.js';

const FormItem = Form.Item;

export default function MeiImportEditor({ content, onContentChanged }) {
  const { t } = useTranslation('musikisum/educandu-plugin-mei-import');
  const isMounted = useIsMounted();
  const clientConfig = useService(ClientConfig);
  const percentageFormatter = usePercentageFormat();
  const [isFileTooLarge, setIsFileTooLarge] = useState(false);

  const { sourceUrl, zoom, spacingSystem, width, caption } = content;

  useEffect(() => {
    setIsFileTooLarge(false);

    if (!sourceUrl) {
      return () => {};
    }

    const actualUrl = getAccessibleUrl({ url: sourceUrl, cdnRootUrl: clientConfig.cdnRootUrl });
    const abortController = new AbortController();

    (async () => {
      try {
        const res = await fetch(actualUrl, { method: 'HEAD', credentials: 'include', signal: abortController.signal });
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

  const handleWidthChange = newValue => {
    triggerContentChanged({ width: newValue });
  };

  const handleCaptionChange = event => {
    triggerContentChanged({ caption: event.target.value });
  };

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
          label={<Info tooltip={t('common:widthInfo')}>{t('common:width')}</Info>}
          {...FORM_ITEM_LAYOUT}
          >
          <ObjectWidthSlider value={width} onChange={handleWidthChange} />
        </Form.Item>
      </Form>
    </div>
  );
}

MeiImportEditor.propTypes = {
  ...sectionEditorProps
};
