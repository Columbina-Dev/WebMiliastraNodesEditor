import type { ProjectDocument } from '../../types/project';

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
    throw new Error('模板.gil存档疑似已损坏，请重新从原神导出。');
  }
  const view = new DataView(buffer);
  const declaredSize = view.getUint32(0, false);
  const version = view.getUint32(4, false);
  const magic = view.getUint32(8, false);
  const constant = view.getUint32(12, false);
  const payloadLength = view.getUint32(16, false);

  if (version !== 1 || magic !== MAGIC || constant !== 2) {
    throw new Error('无法识别的.gil文件头，请使用正式版原神导出 .gil 存档。');
  }
  if (payloadLength + HEADER_SIZE > buffer.byteLength) {
    throw new Error('模板.gil文件的长度信息异常。');
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

  throw new Error(
    'gil 导出映射尚未完成（节点图格式仍在反推），请暂时使用 Zip 导出。\n' +
      '详见 docs/gil-node-format.md 了解当前进展。',
  );
}
