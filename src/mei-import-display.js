import React from 'react';
import MeiDocument from './mei-document.js';
import Markdown from '@educandu/educandu/components/markdown.js';
import ClientConfig from '@educandu/educandu/bootstrap/client-config.js';
import { getAccessibleUrl } from '@educandu/educandu/utils/source-utils.js';
import { useService } from '@educandu/educandu/components/container-context.js';
import { sectionDisplayProps } from '@educandu/educandu/ui/default-prop-types.js';

export default function MeiImportDisplay({ content }) {
  const clientConfig = useService(ClientConfig);

  const { sourceUrl, zoom, spacingSystem, width, caption } = content;
  const actualUrl = sourceUrl
    ? getAccessibleUrl({ url: sourceUrl, cdnRootUrl: clientConfig.cdnRootUrl })
    : null;

  return (
    <div className="EP_Musikisum_MeiImport_Display">
      <div className={`EP_Musikisum_MeiImport_Display-viewer u-width-${width || 100}`}>
        <MeiDocument url={actualUrl} zoom={zoom} width={width} spacingSystem={spacingSystem} />
      </div>
      {!!caption && (
        <div className={`EP_Musikisum_MeiImport_Display-caption u-width-${width || 100}`}>
          <Markdown inline>{caption}</Markdown>
        </div>
      )}
    </div>
  );
}

MeiImportDisplay.propTypes = {
  ...sectionDisplayProps
};
