// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyMeasuresPerLine } from './mei-layout-utils.js';

const MEI_NAMESPACE = 'http://www.music-encoding.org/ns/mei';

function createMeiXml(measureCount, { withExistingBreaks = false } = {}) {
  const measures = [];
  for (let i = 1; i <= measureCount; i += 1) {
    measures.push(`<measure n="${i}"><staff n="1"><layer n="1"/></staff></measure>`);
    if (withExistingBreaks && i < measureCount) {
      measures.push('<sb/>');
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="${MEI_NAMESPACE}">
  <music>
    <body>
      <mdiv>
        <score>
          <section>
            ${measures.join('\n            ')}
          </section>
        </score>
      </mdiv>
    </body>
  </music>
</mei>`;
}

function countMeasuresBetweenBreaks(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  const section = doc.querySelector('section');
  const groups = [];
  let currentGroupSize = 0;

  for (const child of section.children) {
    if (child.localName === 'measure') {
      currentGroupSize += 1;
    } else if (child.localName === 'sb') {
      groups.push(currentGroupSize);
      currentGroupSize = 0;
    }
  }
  groups.push(currentGroupSize);

  return groups;
}

describe('applyMeasuresPerLine', () => {
  it('returns the input unchanged when measuresPerLine is 0', () => {
    const xml = createMeiXml(5);
    expect(applyMeasuresPerLine(xml, 0)).toBe(xml);
  });

  it('returns the input unchanged when measuresPerLine is negative', () => {
    const xml = createMeiXml(5);
    expect(applyMeasuresPerLine(xml, -1)).toBe(xml);
  });

  it('inserts a system break after every Nth measure', () => {
    const result = applyMeasuresPerLine(createMeiXml(7), 3);
    expect(countMeasuresBetweenBreaks(result)).toStrictEqual([3, 3, 1]);
  });

  it('does not insert a trailing break after the last measure', () => {
    const result = applyMeasuresPerLine(createMeiXml(6), 3);
    expect(countMeasuresBetweenBreaks(result)).toStrictEqual([3, 3]);
  });

  it('does not insert any break when measuresPerLine exceeds the total measure count', () => {
    const result = applyMeasuresPerLine(createMeiXml(4), 10);
    expect(countMeasuresBetweenBreaks(result)).toStrictEqual([4]);
  });

  it('removes pre-existing system breaks before inserting new ones', () => {
    const result = applyMeasuresPerLine(createMeiXml(6, { withExistingBreaks: true }), 2);
    expect(countMeasuresBetweenBreaks(result)).toStrictEqual([2, 2, 2]);
  });

  it('inserts the break element in the MEI namespace', () => {
    const result = applyMeasuresPerLine(createMeiXml(4), 2);
    const doc = new DOMParser().parseFromString(result, 'application/xml');
    const systemBreak = doc.querySelector('sb');
    expect(systemBreak.namespaceURI).toBe(MEI_NAMESPACE);
  });
});
