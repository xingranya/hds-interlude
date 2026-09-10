import { AutomaticDeliverySummary, ContinuitySnapshot, ScenePresenceState, StoryState, WorkingDetail, DialogueBurstState, SceneFrame } from './types';
/**
 * Version 1 is the first state envelope that is decoded and encoded in one
 * place. Older beta10 rows have no version and are upgraded on read.
 */
export declare const CURRENT_STORY_STATE_VERSION = 4;
export interface StoryStateMigrationInspection {
    sourceVersion: number;
    targetVersion: number;
    upgraded: boolean;
    unknownKeys: string[];
    perspectiveDefaultAvailable: boolean;
}
export declare function inspectStoryStateMigration(value: unknown, configuredPerspective?: string): StoryStateMigrationInspection;
/** Decode any persisted version into the current, complete state envelope. */
export declare function decodeStoryState(value: unknown): StoryState;
/**
 * Pure and idempotent upgrade. Unknown top-level keys are deliberately moved
 * into extensions so a later plugin can recover them instead of losing them
 * during an unrelated state write.
 */
export declare function upgradeStoryState(value: unknown): StoryState;
export declare function normalizeSceneFrame(value: unknown): SceneFrame | undefined;
export declare function normalizeDialogueBurst(value: unknown): DialogueBurstState | undefined;
/** Encode through the same codec so writes can never bypass normalization. */
export declare function encodeStoryState(value: StoryState): StoryState;
export declare function normalizeAutomaticDeliverySummaries(value: unknown): AutomaticDeliverySummary[];
export declare function normalizeScenePresenceState(value: unknown): ScenePresenceState[];
export declare function normalizeWorkingDetails(value: unknown): WorkingDetail[];
export declare function normalizeTimelineCarry(value: unknown): string[];
export declare function normalizeContinuitySnapshot(value: unknown): ContinuitySnapshot | undefined;
