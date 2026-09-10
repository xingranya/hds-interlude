import assert from 'node:assert/strict'
import test from 'node:test'
import { promptVisibleMessageContent, recentScriptOwnership, storyStateForPrompt, systemPrompt } from '../src/narrator'
import { emptyStoryState } from '../src/types'

test('Alter scoring is requested only while the system is enabled', () => {
  const enabled = systemPrompt('user-message', '', '', '', '', '', false, true)
  assert.match(enabled, /integer field named alter from -5 to \+5/)
  assert.match(enabled, /not the existing atmosphere/)
  assert.match(enabled, /bounded internal weather/)
  assert.match(enabled, /may color the rhythm and form of her messages/)
  assert.match(enabled, /still choose their content and direction/)

  const disabled = systemPrompt('user-message', '', '', '', '', '', false, false)
  assert.doesNotMatch(disabled, /field named alter/)
})

test('current events lead reappraisal before relationship tendencies', () => {
  const prompt = systemPrompt('user-message', '', '', '', '', '', false, false)
  assert.match(prompt, /immediate relational thread/)
  assert.match(prompt, /established tendencies supply nuance/)
  assert.match(prompt, /New events can sustain or revise that reading/)
  assert.match(prompt, /a tendency is context, never a verdict/)
})

test('internal Alter accumulator and history never leak into the main prompt state', () => {
  const state = {
    ...emptyStoryState(),
    alterSystem: {
      alterValue: 8,
      alterWeight: 0.6,
      lastTriggerDirection: 1 as const,
      emotionalOffset: null,
      history: [],
      lastUpdatedAt: '2026-08-22T00:00:00.000Z',
    },
    agencyWindow: {
      activityLoad: 'free' as const,
      privacy: 'private' as const,
      deviceAccess: 'available' as const,
      validUntil: '2026-08-22T01:00:00.000Z',
      basis: '测试', sourceEntryIds: [1], updatedAt: '2026-08-22T00:00:00.000Z',
    },
  }
  const promptState = storyStateForPrompt(state)
  assert.equal('alterSystem' in promptState, false)
  assert.equal('agencyWindow' in promptState, false)
  assert.deepEqual(promptState.automation, {})
})

test('the fixed contract makes local endpoint time authoritative after long gaps', () => {
  const prompt = systemPrompt('user-message', '', '', '', '', '', false, false)
  assert.match(prompt, /interval\.nowLocalContext/)
  assert.match(prompt, /16:00\/afternoon/)
  assert.match(prompt, /continuity snapshot can be stale after reload or a long gap/i)
})

test('interrupted typing is context but never delivered speech', () => {
  const prompt = systemPrompt('user-message', '', '', '', '', '', false, false)
  assert.match(prompt, /interruptedOutgoingDrafts/)
  assert.match(prompt, /not as words the user received/)
  assert.match(prompt, /never send it automatically/)
})

test('each request includes only its current phase strategy', () => {
  const user = systemPrompt('user-message', '', '', '', '', '', false, false)
  const advance = systemPrompt('advance', '', '', '', '', '', false, false)
  const followUp = systemPrompt('conversation-follow-up', '', '', '', '', '', false, false)
  const due = systemPrompt('intent-due', '', '', '', '', '', false, false)
  assert.match(user, /CURRENT PHASE: USER MESSAGE/)
  assert.match(user, /SCRIPT-FIRST TRANSPORT MIRROR/)
  assert.match(user, /For this private turn, return interaction/)
  assert.doesNotMatch(user, /return groupReply as/)
  assert.doesNotMatch(user, /INDEPENDENT LIFE ADVANCE/)
  assert.match(advance, /CURRENT PHASE: INDEPENDENT LIFE ADVANCE/)
  assert.match(advance, /This independent-life phase has no current reply channel/)
  assert.doesNotMatch(advance, /For this private turn, return interaction/)
  assert.doesNotMatch(advance, /interruptedOutgoingDrafts/)
  assert.match(followUp, /place its exact words at the sending action in script/)
  assert.match(due, /CURRENT PHASE: DUE INTENT/)
  assert.match(due, /For this private turn, return interaction/)
})

test('private interaction protocol is neutral about reading and explicit about read-but-silent', () => {
  const user = systemPrompt('user-message', '', '', '', '', '', false, false)
  // 协议示例不得用字面 false 充当默认值（弱指令模型会照抄示例值）。
  assert.doesNotMatch(user, /interaction as \{"seen":false/)
  assert.match(user, /"seen":<true\|false>/)
  assert.match(user, /seen and reply are independent fields/)
  // 已读不回是明确合法的普通状态。
  assert.match(user, /seen=true with reply\.mode=none is the ordinary read-but-does-not-answer state/)
  // 无 say 标记时允许 content 直传，堵住"只教 actionId"的静默丢弃悬崖。
  assert.match(user, /supply reply\.content directly instead of an id/)
  // 未读计数是客观到达记录，不是注意力或义务。
  assert.match(user, /unreadMessageCount is the registered count of arrived messages not yet marked read/)
  // 跟进/到期回合：seen=false 不得再暗示回复必须为 none。
  const followUp = systemPrompt('conversation-follow-up', '', '', '', '', '', false, false)
  assert.match(followUp, /reply may still be immediate or delayed when a message is genuinely sent now/)
})

test('a missing visible-reply structure triggers a fresh-output recovery instruction', () => {
  const ordinary = systemPrompt('user-message', '', '', '', '', '', false, false, false, false, false)
  const recovery = systemPrompt('user-message', '', '', '', '', '', false, false, false, false, true)
  assert.doesNotMatch(ordinary, /OUTPUT RECOVERY/)
  assert.match(recovery, /OUTPUT RECOVERY/)
  assert.match(recovery, /fresh unpublished decision/)
})

test('recent script ownership makes narrative thoughts unambiguously protagonist-owned', () => {
  assert.equal(recentScriptOwnership({ kind: 'script', actor: 'narrator' }), 'protagonist-narrative')
  assert.equal(recentScriptOwnership({ kind: 'user-message', actor: 'user' }), 'user-delivered-message')
  assert.equal(recentScriptOwnership({ kind: 'character-message', actor: 'character' }), 'protagonist-delivered-message')
  assert.equal(recentScriptOwnership({ kind: 'group-message', actor: 'user' }), 'external-group-message')
  assert.equal(recentScriptOwnership({ kind: 'intent-cancelled', actor: 'system' }), 'system-event')

  const prompt = systemPrompt('user-message', '', '', '', '', '', false, false)
  assert.match(prompt, /ownership label is authoritative/)
  assert.match(prompt, /a thought about the user is not a thought by the user/)
})

test('Agency Window is available only on background action phases and stays separate from Alter', () => {
  const advance = systemPrompt('advance', '', '', '', '', '', false, true, true)
  assert.match(advance, /agencyWindow may be/)
  assert.match(advance, /Write the protagonist’s life first/)
  assert.match(advance, /must not copy emotionalOffset, infer contact from Alter values/)
  assert.match(advance, /recheck-later/)

  const user = systemPrompt('user-message', '', '', '', '', '', false, true, true)
  assert.doesNotMatch(user, /agencyWindow may be/)
  assert.doesNotMatch(user, /Agency Window describes only practical action capacity/)
})

test('Perspective is a conditional individual-values layer, not a recurring story theme', () => {
  const absent = systemPrompt('user-message', '', '', '', '', '', false, false, false, false)
  const enabled = systemPrompt('user-message', '', '', '', '', '', false, false, false, true)
  assert.doesNotMatch(absent, /INDIVIDUAL VALUES AND WAY OF SEEING THE WORLD/)
  assert.match(enabled, /INDIVIDUAL VALUES AND WAY OF SEEING THE WORLD/)
  assert.match(enabled, /separate outer personality layer, distinct from the character canon/)
  assert.match(enabled, /not a story theme, moral review/)

  const state = { ...emptyStoryState(), settingOverlay: { characterTraits: [], perspective: '更愿意先理解人的处境。' } }
  assert.equal(storyStateForPrompt(state).settingOverlay.perspective, '更愿意先理解人的处境。')
})

test('chat action fields enter the fixed prompt only for registered turn capabilities', () => {
  const disabled = systemPrompt('user-message', '', '', '', '', '')
  const enabled = systemPrompt('user-message', '', '', '', '', '', false, false, false, false, false, {
    platform: 'qq', quoteReply: true, reactions: ['like', 'heart'],
  })
  assert.doesNotMatch(disabled, /CURRENT REGISTERED CHAT ACTIONS/)
  assert.doesNotMatch(disabled, /messageReactions/)
  assert.match(enabled, /CURRENT REGISTERED CHAT ACTIONS \(qq\)/)
  assert.match(enabled, /replyTo/)
  assert.match(enabled, /like\|heart/)
})

test('native face expressions require semantic intent and an explicit threshold', () => {
  const prompt = systemPrompt('user-message', '', '', '', '', '', false, false, false, false, false, {
    platform: 'qq', quoteReply: false, reactions: [], nativeFaces: ['sweat', 'laugh'], expressionThreshold: 0.7,
  })
  assert.match(prompt, /nativeFace/)
  assert.match(prompt, /willingness/)
  assert.match(prompt, /reaches 0.7/)
  assert.match(prompt, /Do not write bracketed face labels/)
})

test('legacy bracket faces are projected as expression semantics for protagonist history', () => {
  assert.equal(promptVisibleMessageContent('那就是你傻[流汗]', 'protagonist-delivered-message'), '那就是你傻〈附带汗颜表情〉')
  assert.equal(promptVisibleMessageContent('用户写了[流汗]', 'user-delivered-message'), '用户写了[流汗]')
})

test('local sticker catalog is conditional and only permits exact listed assets', () => {
  const absent = systemPrompt('user-message', '', '', '', '', '')
  const enabled = systemPrompt('user-message', '', '', '', '', '', false, false, false, false, false, undefined, false, [
    { assetId: 'laugh/dog', group: 'laugh', description: '金毛躺平，表示摆烂。', aliases: ['躺平'], animated: true },
  ])
  assert.doesNotMatch(absent, /CURRENT LOCAL STICKER LIBRARY/)
  assert.match(enabled, /CURRENT LOCAL STICKER LIBRARY/)
  assert.match(enabled, /at most one exact listed sticker/)
})
