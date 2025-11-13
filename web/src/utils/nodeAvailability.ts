import serverNodeList from '../data/nodeDefinitions.server';
import clientNodeAvailability from '../data/nodeDefinitions.client';
import { nodeDefinitions } from '../data/nodeDefinitions';
import {
  GRAPH_SYSTEM_NODE_IDS,
  type ClientGraphType,
  type GraphEnvironment,
} from '../types/node';
import { clientKindFromEnvironment } from './graphEnvironment';

const SYSTEM_NODE_ID_SET = new Set<string>(GRAPH_SYSTEM_NODE_IDS as readonly string[]);
const ALL_NODE_ID_SET = new Set(nodeDefinitions.map((definition) => definition.id));

const SERVER_NODE_ID_SET = new Set(serverNodeList);
const CLIENT_NODE_ID_SETS: Record<ClientGraphType, Set<string>> = {
  boolean: new Set(clientNodeAvailability.boolean),
  integer: new Set(clientNodeAvailability.integer),
  skill: new Set(clientNodeAvailability.skill),
};

const withFallback = (candidate: Set<string>) =>
  candidate.size > 0 ? candidate : ALL_NODE_ID_SET;

export const getAllowedNodeIds = (environment: GraphEnvironment): Set<string> => {
  if (environment === 'server') {
    return withFallback(SERVER_NODE_ID_SET);
  }
  const kind = clientKindFromEnvironment(environment);
  if (kind) {
    return withFallback(CLIENT_NODE_ID_SETS[kind]);
  }
  return withFallback(SERVER_NODE_ID_SET);
};

export const getNodeDefinitionsForEnvironment = (
  environment: GraphEnvironment,
  options: { includeSystem?: boolean } = {},
) => {
  const { includeSystem = true } = options;
  const allowedIds = getAllowedNodeIds(environment);
  return nodeDefinitions.filter((definition) => {
    if (SYSTEM_NODE_ID_SET.has(definition.id)) {
      return includeSystem;
    }
    return allowedIds.has(definition.id);
  });
};

export const isNodeAllowedInEnvironment = (nodeId: string, environment: GraphEnvironment) => {
  if (SYSTEM_NODE_ID_SET.has(nodeId)) {
    return true;
  }
  return getAllowedNodeIds(environment).has(nodeId);
};
