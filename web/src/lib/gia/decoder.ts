import protobuf from "protobufjs";
import giaProtoSource from "./giaProtoText";
import { LocalizedError } from "../../utils/localizedText";

const HEADER_SIZE = 20;
const FOOTER_SIZE = 4;
const HEADER_MAGIC = 0x00000326;
const FOOTER_MAGIC = 0x00000679;

const { root: decoderRoot } = protobuf.parse(giaProtoSource, { keepCase: true });
const ROOT_MESSAGE = decoderRoot.lookupType("Root");

const toArrayBuffer = (input: ArrayBuffer | Uint8Array): ArrayBuffer => {
  if (input instanceof ArrayBuffer) {
    return input;
  }
  if (input.byteOffset === 0 && input.byteLength === input.buffer.byteLength) {
    return input.buffer;
  }
  return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
};

const unwrapGiaPayload = (input: ArrayBuffer | Uint8Array) => {
  const buffer = toArrayBuffer(input);
  if (buffer.byteLength <= HEADER_SIZE + FOOTER_SIZE) {
    throw new LocalizedError({ key: "gia.decode.invalidLength" });
  }
  const view = new DataView(buffer);
  const declaredSize = view.getUint32(0, false);
  const schemaVersion = view.getUint32(4, false);
  const headerTag = view.getUint32(8, false);
  const fileType = view.getUint32(12, false);
  const protoSize = view.getUint32(16, false);
  const footerTag = view.getUint32(buffer.byteLength - 4, false);

  if (declaredSize !== buffer.byteLength - FOOTER_SIZE) {
    throw new LocalizedError({ key: "gia.decode.sizeMismatch" });
  }
  if (schemaVersion !== 1) {
    throw new LocalizedError({ key: "gia.decode.unsupportedVersion", params: { version: schemaVersion } });
  }
  if (headerTag !== HEADER_MAGIC || footerTag !== FOOTER_MAGIC) {
    throw new LocalizedError({ key: "gia.decode.headerFooterMismatch" });
  }
  if (fileType !== 3) {
    throw new LocalizedError({ key: "gia.decode.unknownFileType", params: { fileType } });
  }
  const expectedProtoSize = buffer.byteLength - HEADER_SIZE - FOOTER_SIZE;
  if (protoSize !== expectedProtoSize) {
    throw new LocalizedError({ key: "gia.decode.protoSizeMismatch" });
  }
  return new Uint8Array(buffer, HEADER_SIZE, expectedProtoSize);
};

export type DecodedGiaRoot = Record<string, unknown>;

export const decodeGiaBinary = (binary: ArrayBuffer | Uint8Array): DecodedGiaRoot => {
  const payload = unwrapGiaPayload(binary);
  const decodedMessage = ROOT_MESSAGE.decode(payload);
  return ROOT_MESSAGE.toObject(decodedMessage, {
    enums: String,
    longs: String,
    bytes: String,
    defaults: true,
  }) as DecodedGiaRoot;
};
