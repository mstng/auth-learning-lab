import type { HttpRecord, LabState, Result, Snapshot } from './types';
import type { JwtResult } from './jwt-types';

export type CompareAction = 'prepare' | 'access' | 'logout' | 'replay';
export type CompareMemory = { activeJwt: string | null; copy: { sessionId: string; jwt: string } | null };
export const emptyCompareMemory: CompareMemory = { activeJwt: null, copy: null };
export type CompareStep = { title: string; text: string; detail: string; place: 'browser' | 'server' | 'database'; source: 'server' | 'browser' | 'model' };
export type SessionReplayResult = {
  requestId: string; status: number; code: 'valid' | 'missing' | 'expired' | 'inactive';
  sessionId: string; receivedVia: 'json-body'; serverTime: string;
  profile?: { id: string; email: string; role: string };
  before: Snapshot; after: Snapshot; http: HttpRecord; trace: CompareStep[];
};
export type CompareDraft = {
  id: string; action: CompareAction; before: LabState;
  memoryBefore: CompareMemory; memoryAfter: CompareMemory;
  session?: Result; jwt?: JwtResult; replay?: SessionReplayResult;
  steps: CompareStep[];
};
export type CompareObservation = CompareDraft & { after: LabState };
