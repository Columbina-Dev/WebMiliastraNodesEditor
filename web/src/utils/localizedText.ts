export type LocalizedText = {
  key: string;
  params?: Record<string, string | number>;
};

export class LocalizedError extends Error {
  readonly key: string;
  readonly params?: Record<string, string | number>;

  constructor(message: LocalizedText) {
    super(message.key);
    this.name = 'LocalizedError';
    this.key = message.key;
    this.params = message.params;
  }
}

export const isLocalizedError = (error: unknown): error is LocalizedError =>
  error instanceof LocalizedError;

