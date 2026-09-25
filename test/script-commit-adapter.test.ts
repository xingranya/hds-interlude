import assert from 'node:assert/strict'
import test from 'node:test'
import { decisionToScriptCommit as legacyDecisionToScriptCommit, findGroupScriptEvent, findOutgoingScriptEvent } from '../src/script/commit-builder'
import { unboundImmediateMessageEvents } from '../src/script/commit-builder'
import { messageEventReference } from '../src/script/contract'
import { validateScriptCommit } from '../src/script/validator'

test('script-first output becomes one deterministic host-owned commit with causal message events', () => {
  const input = {
    storyId: 'story-1', participantId: 'alice', phase: 'user-message' as const,
    from: new Date('2026-09-04T00:00:00.000Z'), now: new Date('2026-09-04T00:03:00.000Z'),
    messageSeparator: '<sep/>', splitReplyMessages: true,
    frameId: 'frame:one', burstId: 'burst:one',
    groupReplyContent: '群里说一句',
    decision: {
      script: '她停下手里的事，发出“我看见了”，又接着发出“让我想一下”；随后在群里写下“群里说一句”。',
      interaction: { seen: true, reply: { mode: 'immediate' as const, content: '我看见了<sep/>让我想一下' } },
      crossConversationActions: [{ participantId: 'bob', mode: 'delayed' as const, content: '晚点说', sendAt: '2026-09-04T00:10:00.000Z' }],
    },
  }
  const first = legacyDecisionToScriptCommit(input)
  const second = legacyDecisionToScriptCommit(input)
  assert.equal(first.commitId, second.commitId)
  assert.equal(first.sourceFormat, 'script-first-v1')
  assert.deepEqual(first.events, second.events)
  assert.deepEqual(validateScriptCommit(first), { valid: true, errors: [] })
  assert.notEqual(legacyDecisionToScriptCommit({
    ...input,
    decision: { ...input.decision, interaction: { seen: true, reply: { mode: 'immediate', content: '不同的实际消息' } } },
  }).commitId, first.commitId)

  const outgoing = findOutgoingScriptEvent(first, 'alice', 'immediate', '我看见了<sep/>让我想一下')
  assert.deepEqual(outgoing?.bubbles, ['我看见了', '让我想一下'])
  assert.equal(outgoing?.causedByEventIds.length, 1)
  assert.equal(outgoing?.scriptBinding?.status, 'bound')
  assert.equal(outgoing?.scriptBinding?.spans?.length, 2)
  assert.equal(messageEventReference(outgoing!)?.commitId, first.commitId)
  assert.equal(findGroupScriptEvent(first)?.content, '群里说一句')
  assert.equal(findGroupScriptEvent(first)?.scriptBinding?.status, 'bound')
  assert.equal(first.events.find(event => event.kind === 'outgoing-message' && event.deliveryMode === 'delayed')?.scriptBinding?.status, 'future')
  assert.deepEqual(unboundImmediateMessageEvents(first), [])
})

test('an absent or ambiguous prose action is diagnostic and keeps compatibility delivery intact', () => {
  const commit = legacyDecisionToScriptCommit({
    storyId: 'story-2', participantId: 'alice', phase: 'user-message',
    from: new Date('2026-09-04T00:00:00.000Z'), now: new Date('2026-09-04T00:01:00.000Z'),
    frameId: 'frame:two', burstId: 'burst:two',
    decision: {
      script: '她看完以后立即回了过去，但这段旧式输出没有写出消息原文。',
      interaction: { seen: true, reply: { mode: 'immediate', content: '知道了' } },
    },
  })
  const unbound = unboundImmediateMessageEvents(commit)
  assert.equal(unbound.length, 1)
  assert.equal(unbound[0].scriptBinding?.status, 'unbound')
  assert.equal(findOutgoingScriptEvent(commit, 'alice')?.content, '知道了')
  assert.deepEqual(validateScriptCommit(commit), { valid: true, errors: [] })
})

test('a proactive sticker is attached to its approved private contact', () => {
  const commit = legacyDecisionToScriptCommit({
    storyId: 'story-3', participantId: '', phase: 'advance',
    from: new Date('2026-09-25T12:00:00.000Z'), now: new Date('2026-09-25T12:01:00.000Z'),
    frameId: 'frame:three', burstId: 'burst:three',
    decision: {
      script: '她想起小星，发了句“刚看到一只小猫”，又发了一张猫猫表情包。',
      crossConversationActions: [{ participantId: 'onebot:3551827003:1935220968', mode: 'immediate',
        content: '刚看到一只小猫', willingness: 0.9,
        localMedia: { assetId: 'sticker:cat', placement: 'after-text', willingness: 0.9 } }],
    },
  })
  const text = findOutgoingScriptEvent(commit, 'onebot:3551827003:1935220968', 'immediate', '刚看到一只小猫')
  const image = commit.events.find(event => event.kind === 'platform-action' && event.metadata?.localMedia)
  assert.ok(text)
  assert.equal(image?.participantId, 'onebot:3551827003:1935220968')
  assert.equal(image?.metadata?.localMedia?.assetId, 'sticker:cat')
  assert.deepEqual(validateScriptCommit(commit), { valid: true, errors: [] })
})
