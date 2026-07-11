import React from 'react';
import { Form } from 'antd';
import { useTranslation } from 'react-i18next';
import Info from '@educandu/educandu/components/info.js';
import { FORM_ITEM_LAYOUT } from '@educandu/educandu/domain/constants.js';
import MarkdownInput from '@educandu/educandu/components/markdown-input.js';
import { sectionEditorProps } from '@educandu/educandu/ui/default-prop-types.js';
import ObjectWidthSlider from '@educandu/educandu/components/object-width-slider.js';

export default function MeiImportEditor({ content, onContentChanged }) {
  const { t } = useTranslation('musikisum/educandu-plugin-mei-import');
  const { text, width } = content;

  const updateContent = newContentValues => {
    onContentChanged({ ...content, ...newContentValues });
  };

  const handleTextChanged = event => {
    updateContent({ text: event.target.value });
  };

  const handleWidthChange = value => {
    updateContent({ width: value });
  };

  return (
    <div className="EP_Musikisum_MeiImport_Editor">
      <Form labelAlign="left">
        <Form.Item label={t('common:text')} {...FORM_ITEM_LAYOUT}>
          <MarkdownInput value={text} onChange={handleTextChanged} renderAnchors />
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
