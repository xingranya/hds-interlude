import type { DialogueBurstState, SceneFrame } from '../types';
export interface CompiledNarrativeContext {
    storyIdentity: Record<string, unknown>;
    relevantEstablishedEpisodes: Record<string, unknown>;
    currentSceneEvidence: Record<string, unknown>;
    ongoingThreads: Record<string, unknown>;
    availableNearFuture: Record<string, unknown>;
    incomingEvent: Record<string, unknown>;
    authoringWindow: Record<string, unknown>;
}
/**
 * M4 bridge: compile beta10's proven fields into a positive continuation
 * scaffold. Each prepared value is moved into one semantic group and is never
 * recomputed or duplicated in the model-facing payload.
 */
export declare function compileNarrativeContext(payload: Record<string, any>, frame: SceneFrame | undefined, _burst: DialogueBurstState | undefined): CompiledNarrativeContext;
export declare function compiledContextConflicts(payload: Record<string, any>, compiled: CompiledNarrativeContext): string[];
