import type { ClientGraphType } from '../types/node';

export type ClientNodeAvailability = Record<ClientGraphType, string[]>;

export const clientNodeAvailability: ClientNodeAvailability = {
  boolean: [],
  integer: [],
  skill: [],
};

export default clientNodeAvailability;
