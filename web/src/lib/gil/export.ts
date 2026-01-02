import type { ProjectDocument } from '../../types/project';
import { LocalizedError } from '../../utils/localizedText';

export interface GilExportOptions {
  templateGil: ArrayBuffer;
  projectDocument: ProjectDocument;
}

export interface GilExportResult {
  gilBuffer: ArrayBuffer;
}

const HEADER_SIZE = 20; // first 5 u32 values before payload
const MAGIC = 0x00000326;

/**
 * Basic structural sanity check for a `.gil` buffer.
 * Returns payload length to help callers avoid slicing outside bounds.
 */
function readGilEnvelope(buffer: ArrayBuffer): { payloadLength: number } {
  if (buffer.byteLength < HEADER_SIZE) {
    throw new LocalizedError({ key: 'gil.export.templateCorrupted' });
  }
  const view = new DataView(buffer);
  const declaredSize = view.getUint32(0, false);
  const version = view.getUint32(4, false);
  const magic = view.getUint32(8, false);
  const constant = view.getUint32(12, false);
  const payloadLength = view.getUint32(16, false);

  if (version !== 1 || magic !== MAGIC || constant !== 2) {
    throw new LocalizedError({ key: 'gil.export.unrecognizedHeader' });
  }
  if (payloadLength + HEADER_SIZE > buffer.byteLength) {
    throw new LocalizedError({ key: 'gil.export.lengthMismatch' });
  }
  // declaredSize is totalLengthMinusHeader in samples; keep for reference
  const expectedLength = declaredSize + 4;
  if (expectedLength !== buffer.byteLength) {
    // Only warn; some tooling may not preserve the exact value.
    console.warn(
      '[gil] Declared length does not match actual buffer length:',
      expectedLength,
      buffer.byteLength,
    );
  }
  return { payloadLength };
}

/**
 * Placeholder exporter.
 *
 * Mapping from web graph JSON to `.gil` proto is still being reversed; once
 * stable, this function should:
 *  - decode the payload protobuf,
 *  - replace field 10 (graph list) with data derived from projectDocument,
 *  - re-encode while keeping UI/layout sections untouched.
 */
export async function exportGraphsToGil(options: GilExportOptions): Promise<GilExportResult> {
  const { templateGil } = options;
  readGilEnvelope(templateGil);

  throw new LocalizedError({ key: 'gil.export.notImplemented' });
}
