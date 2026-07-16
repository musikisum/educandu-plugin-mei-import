// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildNoteEvents, buildVoiceInfoByNoteId, countNotes, extractVoices, getMidiNumberForNote } from './mei-voice-utils.js';

const MEI_NAMESPACE = 'http://www.music-encoding.org/ns/mei';

const TWO_STAFF_TWO_LAYER_MEI = `<?xml version="1.0" encoding="UTF-8"?>
<mei xmlns="${MEI_NAMESPACE}">
  <music><body><mdiv><score>
    <scoreDef>
      <staffGrp>
        <staffDef n="1" lines="5" label="Sopran/Alt">
          <layerDef n="1" label="Sopran"/>
          <layerDef n="2" label="Alt"/>
        </staffDef>
        <staffDef n="2" lines="5"/>
      </staffGrp>
    </scoreDef>
    <section>
      <measure n="1">
        <staff n="1">
          <layer n="1"><note xml:id="s1" pname="c" oct="5" dur="4"/></layer>
          <layer n="2"><note xml:id="a1" pname="e" oct="4" dur="4"/></layer>
        </staff>
        <staff n="2">
          <layer n="1"><note xml:id="t1" pname="c" oct="4" dur="4"/></layer>
        </staff>
      </measure>
    </section>
  </score></mdiv></body></music>
</mei>`;

describe('countNotes', () => {
  it('counts every note element in the document', () => {
    expect(countNotes(TWO_STAFF_TWO_LAYER_MEI)).toBe(3);
  });
});

describe('extractVoices', () => {
  it('finds every staff/layer combination that contains notes, in document order', () => {
    const voices = extractVoices(TWO_STAFF_TWO_LAYER_MEI);
    expect(voices.map(v => v.key)).toStrictEqual(['1-1', '1-2', '2-1']);
  });

  it('reads the label from layerDef, falling back to staffDef', () => {
    const voices = extractVoices(TWO_STAFF_TWO_LAYER_MEI);
    expect(voices.find(v => v.key === '1-1').label).toBe('Sopran');
    expect(voices.find(v => v.key === '1-2').label).toBe('Alt');
  });

  it('returns null as label when neither layerDef nor staffDef has one', () => {
    const voices = extractVoices(TWO_STAFF_TWO_LAYER_MEI);
    expect(voices.find(v => v.key === '2-1').label).toBeNull();
  });

  it('ignores layers without any note', () => {
    const mei = `<mei xmlns="${MEI_NAMESPACE}"><music><body><mdiv><score><section>
      <measure n="1"><staff n="1"><layer n="1"><rest dur="4"/></layer></staff></measure>
    </section></score></mdiv></body></music></mei>`;
    expect(extractVoices(mei)).toStrictEqual([]);
  });

  it('does not list the same voice twice across multiple measures', () => {
    const mei = `<mei xmlns="${MEI_NAMESPACE}"><music><body><mdiv><score><section>
      <measure n="1"><staff n="1"><layer n="1"><note pname="c" oct="4" dur="4"/></layer></staff></measure>
      <measure n="2"><staff n="1"><layer n="1"><note pname="d" oct="4" dur="4"/></layer></staff></measure>
    </section></score></mdiv></body></music></mei>`;
    expect(extractVoices(mei).map(v => v.key)).toStrictEqual(['1-1']);
  });
});

describe('getMidiNumberForNote', () => {
  function noteElement(attributes) {
    const doc = new DOMParser().parseFromString(`<mei xmlns="${MEI_NAMESPACE}"/>`, 'application/xml');
    const note = doc.createElementNS(MEI_NAMESPACE, 'note');
    for (const [name, value] of Object.entries(attributes)) {
      note.setAttribute(name, value);
    }
    return note;
  }

  it('computes the MIDI number for a plain natural note (c4 = 60)', () => {
    expect(getMidiNumberForNote(noteElement({ pname: 'c', oct: '4' }))).toBe(60);
  });

  it('applies a sharp accidental', () => {
    expect(getMidiNumberForNote(noteElement({ pname: 'c', oct: '4', accid: 's' }))).toBe(61);
  });

  it('applies a flat accidental', () => {
    expect(getMidiNumberForNote(noteElement({ pname: 'e', oct: '4', accid: 'f' }))).toBe(63);
  });

  it('prefers accid.ges over accid when both are present', () => {
    expect(getMidiNumberForNote(noteElement({ 'pname': 'c', 'oct': '4', 'accid': 'n', 'accid.ges': 's' }))).toBe(61);
  });

  it('returns null when pname or oct is missing', () => {
    expect(getMidiNumberForNote(noteElement({ pname: 'c' }))).toBeNull();
    expect(getMidiNumberForNote(noteElement({ oct: '4' }))).toBeNull();
  });
});

describe('buildNoteEvents', () => {
  it('pairs on/off timemap events with pitch and voice information from the MEI', () => {
    // s1 (staff 1, layer 1, c5=72) sounds 0-500, a1 (staff 1, layer 2, e4=64) sounds 500-1000,
    // t1 (staff 2, layer 1, c4=60) sounds 1000-1500.
    const timemapEvents = [
      { on: ['s1'], tstamp: 0 },
      { off: ['s1'], on: ['a1'], tstamp: 500 },
      { off: ['a1'], on: ['t1'], tstamp: 1000 },
      { off: ['t1'], tstamp: 1500 }
    ];

    const voiceInfoByNoteId = buildVoiceInfoByNoteId(TWO_STAFF_TWO_LAYER_MEI);
    const noteEvents = buildNoteEvents(voiceInfoByNoteId, timemapEvents);

    expect(noteEvents).toStrictEqual([
      { midiNumber: 72, voiceKey: '1-1', startMs: 0, durationMs: 500 },
      { midiNumber: 64, voiceKey: '1-2', startMs: 500, durationMs: 500 },
      { midiNumber: 60, voiceKey: '2-1', startMs: 1000, durationMs: 500 }
    ]);
  });

  it('ignores ids that never receive a matching off event', () => {
    const timemapEvents = [{ on: ['s1'], tstamp: 0 }];
    const voiceInfoByNoteId = buildVoiceInfoByNoteId(TWO_STAFF_TWO_LAYER_MEI);
    expect(buildNoteEvents(voiceInfoByNoteId, timemapEvents)).toStrictEqual([]);
  });
});

describe('buildVoiceInfoByNoteId', () => {
  it('maps each note id to its MIDI number and voice key', () => {
    const voiceInfoByNoteId = buildVoiceInfoByNoteId(TWO_STAFF_TWO_LAYER_MEI);
    expect(voiceInfoByNoteId.get('s1')).toStrictEqual({ midiNumber: 72, voiceKey: '1-1' });
    expect(voiceInfoByNoteId.get('a1')).toStrictEqual({ midiNumber: 64, voiceKey: '1-2' });
    expect(voiceInfoByNoteId.get('t1')).toStrictEqual({ midiNumber: 60, voiceKey: '2-1' });
  });
});
