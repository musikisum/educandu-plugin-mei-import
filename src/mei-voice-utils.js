const PITCH_CLASS_OFFSETS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const ACCIDENTAL_OFFSETS = { ff: -2, f: -1, n: 0, s: 1, x: 2, ss: 2 };

function findLabel(defElement) {
  if (!defElement) {
    return null;
  }

  const attributeLabel = defElement.getAttribute('label');
  if (attributeLabel) {
    return attributeLabel;
  }

  const labelChild = [...defElement.children].find(child => child.localName === 'label');
  return labelChild?.textContent.trim() || null;
}

export function getMidiNumberForNote(noteElement) {
  const pname = noteElement.getAttribute('pname');
  const octAttribute = noteElement.getAttribute('oct');
  if (!pname || !(pname in PITCH_CLASS_OFFSETS) || !octAttribute) {
    return null;
  }

  const oct = Number(octAttribute);
  if (Number.isNaN(oct)) {
    return null;
  }

  const accid = noteElement.getAttribute('accid.ges') || noteElement.getAttribute('accid') || '';
  const accidentalOffset = ACCIDENTAL_OFFSETS[accid] || 0;

  return ((oct + 1) * 12) + PITCH_CLASS_OFFSETS[pname] + accidentalOffset;
}

export function countNotes(meiXmlString) {
  const doc = new DOMParser().parseFromString(meiXmlString, 'application/xml');
  return doc.querySelectorAll('note').length;
}

export function extractVoices(meiXmlString) {
  const doc = new DOMParser().parseFromString(meiXmlString, 'application/xml');

  const staffDefsByN = new Map();
  for (const staffDef of doc.querySelectorAll('staffDef')) {
    staffDefsByN.set(staffDef.getAttribute('n'), staffDef);
  }

  const voices = [];
  const seenKeys = new Set();

  for (const staff of doc.querySelectorAll('staff')) {
    const staffN = staff.getAttribute('n');
    for (const layer of staff.querySelectorAll('layer')) {
      const layerN = layer.getAttribute('n');
      const key = `${staffN}-${layerN}`;
      if (!seenKeys.has(key) && layer.querySelector('note')) {
        seenKeys.add(key);

        const staffDef = staffDefsByN.get(staffN) || null;
        const layerDef = staffDef
          ? [...staffDef.querySelectorAll('layerDef')].find(def => def.getAttribute('n') === layerN)
          : null;

        voices.push({ key, staffN, layerN, label: findLabel(layerDef) || findLabel(staffDef) });
      }
    }
  }

  return voices;
}

export function buildVoiceInfoByNoteId(processedMeiXmlString) {
  const doc = new DOMParser().parseFromString(processedMeiXmlString, 'application/xml');

  const idToVoiceInfo = new Map();
  for (const staff of doc.querySelectorAll('staff')) {
    const staffN = staff.getAttribute('n');
    for (const layer of staff.querySelectorAll('layer')) {
      const layerN = layer.getAttribute('n');
      const voiceKey = `${staffN}-${layerN}`;
      for (const note of layer.querySelectorAll('note')) {
        const id = note.getAttribute('xml:id');
        const midiNumber = getMidiNumberForNote(note);
        if (id && midiNumber !== null) {
          idToVoiceInfo.set(id, { midiNumber, voiceKey });
        }
      }
    }
  }

  return idToVoiceInfo;
}

export function buildNoteEvents(voiceInfoByNoteId, timemapEvents) {
  const noteEvents = [];
  const openNoteStartMsById = new Map();

  for (const event of timemapEvents) {
    for (const id of event.on || []) {
      openNoteStartMsById.set(id, event.tstamp);
    }
    for (const id of event.off || []) {
      const hasStart = openNoteStartMsById.has(id);
      const startMs = openNoteStartMsById.get(id);
      openNoteStartMsById.delete(id);

      const voiceInfo = voiceInfoByNoteId.get(id);
      if (hasStart && voiceInfo) {
        noteEvents.push({
          midiNumber: voiceInfo.midiNumber,
          voiceKey: voiceInfo.voiceKey,
          startMs,
          durationMs: event.tstamp - startMs
        });
      }
    }
  }

  return noteEvents;
}
