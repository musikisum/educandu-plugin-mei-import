export function applyMeasuresPerLine(meiXmlString, measuresPerLine) {
  if (!measuresPerLine || measuresPerLine <= 0) {
    return meiXmlString;
  }

  const doc = new DOMParser().parseFromString(meiXmlString, 'application/xml');

  for (const breakElement of doc.querySelectorAll('sb, pb')) {
    breakElement.remove();
  }

  const measures = [...doc.querySelectorAll('measure')];

  let measureCountSinceLastBreak = 0;
  measures.forEach((measure, index) => {
    measureCountSinceLastBreak += 1;
    const isLastMeasureInDocument = index === measures.length - 1;

    if (measureCountSinceLastBreak === measuresPerLine && !isLastMeasureInDocument) {
      const systemBreak = doc.createElementNS(measure.namespaceURI, 'sb');
      measure.after(systemBreak);
      measureCountSinceLastBreak = 0;
    }
  });

  return new XMLSerializer().serializeToString(doc);
}
