import type { DialogueBurstState, SceneFrame } from '../types'

export interface CompiledNarrativeContext {
  storyIdentity: Record<string, unknown>
  relevantEstablishedEpisodes: Record<string, unknown>
  currentSceneEvidence: Record<string, unknown>
  ongoingThreads: Record<string, unknown>
  availableNearFuture: Record<string, unknown>
  incomingEvent: Record<string, unknown>
  authoringWindow: Record<string, unknown>
}

/**
 * M4 bridge: compile beta10's proven fields into a positive continuation
 * scaffold. Each prepared value is moved into one semantic group and is never
 * recomputed or duplicated in the model-facing payload.
 */
export function compileNarrativeContext(
  payload: Record<string, any>,
  frame: SceneFrame | undefined,
  _burst: DialogueBurstState | undefined,
): CompiledNarrativeContext {
  return {
    storyIdentity: {
      setting: payload.setting,
    },
    relevantEstablishedEpisodes: compactObject({
      recentScript: payload.recentScript,
      sceneContext: payload.sceneContext,
      continuitySnapshot: payload.continuitySnapshot,
      continuitySnapshotAgeMinutes: payload.continuitySnapshotAgeMinutes,
      durableFacts: payload.durableFacts,
      memories: payload.memories,
      overlayEvolution: payload.overlayEvolution,
      // M4.1: a recall hit points back to the original script neighbourhood.
      // The model-facing name makes clear that this is prose evidence, not a
      // second abstract memory summary.
      recalledScript: payload.recalledHistory,
      webContext: payload.webContext,
      recentExchange: payload.recentExchange,
    }),
    currentSceneEvidence: projectSceneEvidence(
      frame,
      new Set((payload.recentScript ?? []).map((entry: { id?: number }) => entry.id).filter(Number.isSafeInteger)),
    ),
    ongoingThreads: compactObject({
      state: payload.state,
      currentParticipant: payload.currentParticipant,
      participants: payload.participants,
      activeConsequences: payload.activeConsequences,
      followUpCommitments: payload.followUpCommitments,
      contactThreads: payload.contactThreads,
      workingDetails: payload.workingDetails,
      interruptedOutgoingDrafts: payload.interruptedOutgoingDrafts,
      supersededDelayedReplies: payload.supersededDelayedReplies,
      automaticDeliverySummaries: payload.automaticDeliverySummaries,
      deliveryReality: payload.deliveryReality,
      developmentTendencies: payload.developmentTendencies,
    }),
    availableNearFuture: compactObject({
      timelinePlan: payload.timelinePlan,
      timelineCarry: payload.timelineCarry,
      schedulePreplan: payload.schedulePreplan,
      dueIntents: payload.dueIntents,
      upcomingPlans: payload.upcomingPlans,
    }),
    incomingEvent: compactObject({
      event: payload.currentEvent,
      groupContext: payload.groupContext,
      chatCapabilities: payload.chatCapabilities,
      stickerCatalog: payload.stickerCatalog,
    }),
    authoringWindow: compactObject({
      phase: payload.phase,
      interval: payload.interval,
      continuation: payload.continuation,
      liveTimeBoundary: payload.liveTimeBoundary,
      refreshContinuity: payload.refreshContinuity,
      outputRecovery: payload.outputRecovery,
      emotionalOffset: payload.emotionalOffset,
      agencyWindow: payload.agencyWindow,
    }),
  }
}

export function compiledContextConflicts(payload: Record<string, any>, compiled: CompiledNarrativeContext) {
  const pairs: Array<[unknown, unknown, string]> = [
    [payload.setting, compiled.storyIdentity.setting, 'setting'],
    [payload.state, compiled.ongoingThreads.state, 'state'],
    [payload.recentScript, compiled.relevantEstablishedEpisodes.recentScript, 'recentScript'],
    [payload.currentEvent, compiled.incomingEvent.event, 'currentEvent'],
    [payload.interval, compiled.authoringWindow.interval, 'interval'],
    [payload.timelinePlan, compiled.availableNearFuture.timelinePlan, 'timelinePlan'],
  ]
  return pairs.filter(([legacy, next]) => legacy !== next).map(([, , label]) => `${label} was recomputed`)
}

/** Scene state is a small sourced navigation aid. DialogueBurst is host-owned
 * commit identity and prose-shaped fields are deliberately not serialised. */
function projectSceneEvidence(frame: SceneFrame | undefined, recentEntryIds: Set<number>) {
  if (!frame) return {}
  const outsideSourceEntryIds = frame.sourceEntryIds.filter(id => !recentEntryIds.has(id))
  return compactObject({
    sceneId: frame.sceneId,
    place: sourced(frame, 'place', recentEntryIds),
    presentPeople: sourced(frame, 'presentPeople', recentEntryIds),
    ongoingActivity: sourced(frame, 'ongoingActivity', recentEntryIds),
    attention: sourced(frame, 'attention', recentEntryIds),
    deviceAccess: sourced(frame, 'deviceAccess', recentEntryIds),
    privacy: sourced(frame, 'privacy', recentEntryIds),
    openLoops: sourced(frame, 'openMotions', recentEntryIds),
    sourceEntryIds: outsideSourceEntryIds.length ? outsideSourceEntryIds : undefined,
  })
}

function sourced(frame: SceneFrame, field: keyof SceneFrame['sources'], recentEntryIds: Set<number>) {
  const value = frame[field]
  const sourceEntryIds = frame.sources[field]
  const populated = Array.isArray(value) ? value.length > 0 : typeof value === 'string' && !!value.trim()
  return populated && sourceEntryIds?.length && sourceEntryIds.some(id => !recentEntryIds.has(id))
    ? { value, sourceEntryIds }
    : undefined
}

function compactObject(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}
