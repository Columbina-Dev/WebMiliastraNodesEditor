import rawVersionInfo from './versionInfo.json';

export interface VersionInfo {
  homepage: string;
  editor: string;
  tutorial: string;
  effects: string;
  node: string;
}

const DEFAULT_VERSION_INFO: VersionInfo = {
  homepage: '',
  editor: '',
  tutorial: '',
  effects: '',
  node: '',
};

export const VERSION_INFO: VersionInfo = {
  ...DEFAULT_VERSION_INFO,
  ...rawVersionInfo,
};

export default VERSION_INFO;
