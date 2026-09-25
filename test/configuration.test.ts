import assert from 'node:assert/strict'
import test from 'node:test'
import { Config, version } from '../src/index'
import { hasRequiredNarrativeScript, normalizeGroupVisibleReply, normalizeInteraction, recoverAuthoredPrivateSend, recoverQuotedPrivateSend, resolveBlindModeConfig, scriptClaimsVisiblePrivateSend, visibleReplyMode } from '../src/service'
import { resolveAuthoredActions } from '../src/script/authored-actions'
import { configuredProviders, OpenAICompatibleNarrator, parseTokenUsage, ZHIPU_FIRST_VISIBLE_TOKEN_TIMEOUT } from '../src/narrator'
import { HDS_INTERLUDE_VERSION } from '../src/meta'
import { emptyStorySetting, emptyStoryState } from '../src/types'

const now = new Date('2026-09-09T12:00:00Z')

test('Console sections follow the documented setup order', () => {
  assert.deepEqual(Object.keys(Config.dict), [
    'storyDefaults', 'model', 'onebot', 'sharedStory', 'runtime', 'urge', 'schedulePreplan', 'timelineDirector', 'agency',
    'chatActions', 'stickers', 'memory', 'alterSystem', 'browser', 'blindMode', 'logging', 'chatRhythm',
  ])
  // 分类前缀让配置页按 必填→结构→节奏→表达→内在→扩展→维护 分组可读。
  const headers = Object.values(Config.dict).map((item: any) => String(item.meta?.description ?? ''))
  assert.match(headers[0], /^【必填 1】/)
  assert.match(headers[3], /^【结构 4】/)
  assert.match(headers[4], /^【节奏 5】/)
  assert.match(headers[9], /^【表达 10】/)
  assert.match(headers[11], /^【内在 12】/)
  assert.match(headers[13], /^【扩展 14】/)
  assert.match(headers[14], /^【维护 15】/)
})

test('chat actions are opt-in and platform-scoped', () => {
  const actions = Config.dict.chatActions.dict
  assert.equal(actions.enabled.meta.default, false)
  assert.deepEqual(actions.platforms.meta.default, ['qq'])
  assert.equal(actions.quoteReply.meta.default, true)
  assert.equal(actions.messageReactions.meta.default, true)
  assert.equal(actions.nativeFaces.meta.default, true)
  assert.equal(actions.expressionThreshold.meta.default, 0.7)
})

test('local sticker library is opt-in and requires an explicitly assigned visual provider', () => {
  const stickers = Config.dict.stickers.dict
  assert.equal(stickers.enabled.meta.default, false)
  assert.equal(stickers.directory.meta.default, 'data/hds-interlude/stickers')
  assert.equal(stickers.catalogLimit.meta.default, 40)
  assert.equal(stickers.descriptionResponseFormat.meta.default, 'json-object')
})

test('Blind Mode is the first Console section and defaults to a minimal ten-minute heartbeat', () => {
  const blindMode = Config.dict.blindMode.dict
  assert.equal(blindMode.enabled.meta.default, false)
  assert.equal(blindMode.healthReportMinutes.meta.default, 10)
  assert.deepEqual(resolveBlindModeConfig(), { enabled: false, healthReportMinutes: 10 })
  assert.deepEqual(resolveBlindModeConfig({ enabled: true, healthReportMinutes: 2 }), { enabled: true, healthReportMinutes: 2 })
})

test('ignored compatibility switches stay out of the active Console', () => {
  assert.equal('enabled' in Config.dict.sharedStory.dict, false)
  assert.equal('pauseAfterConversationMinutes' in Config.dict.runtime.dict, false)
  assert.equal('staleNarrativeRequestWindowSeconds' in Config.dict.runtime.dict, false)
  assert.equal(Config.dict.runtime.dict.userMessageDebounceSeconds.meta.default, 2)
})

test('runtime and plugin exports share one version constant', () => {
  assert.equal(version, HDS_INTERLUDE_VERSION)
  assert.equal(version, '1.0.1-beta6-rebuild')
})

test('layered colored logs are the Console default and remain optional', () => {
  const logging = Config.dict.logging.dict
  assert.equal(logging.format.meta.default, 'layered')
  assert.equal(logging.colors.meta.default, true)
  assert.equal(logging.colorTheme.meta.default, 'dark')
  assert.equal(logging.kaomoji.meta.default, true)
})

test('model Console centralizes connections and task assignment without exposing IDs', () => {
  const model = Config.dict.model.dict
  assert.deepEqual(Object.keys(model).slice(0, 3), ['vision', 'audio', 'providers'])
  assert.equal('mode' in model, false)
  assert.equal('zhipu' in model, false)
  assert.equal('models' in model, false)
  assert.equal('mainModelId' in model, false)
  assert.equal(model.mainResponseFormat.meta.default, 'json-object')
  assert.equal(model.mainStreamingMode.meta.default, 'off')
  assert.equal(model.vision.dict.mode.meta.default, 'native')
  assert.equal(model.vision.dict.detail.meta.default, 'auto')
  assert.equal(configuredProviders({ providers: [{ label: 'Vision', enabled: true, endpoint: 'https://example.test', model: 'vision', useForVision: true }] } as any)[0].useForVision, true)
})

test('Zhipu official provider mode supplies its fixed endpoint and stream-capable task roles', () => {
  const providers = configuredProviders({ mode: 'openai-compatible', providers: [{
    label: 'Zhipu', enabled: true, mode: 'zhipu-official', apiKey: 'test',
    model: 'glm-5.3-flash', reasoningEffort: 'high', useForMain: true,
  }] } as any)
  assert.equal(providers.length, 1)
  assert.equal(providers[0].endpoint, 'https://open.bigmodel.cn/api/paas/v4/chat/completions')
  assert.equal(providers[0].model, 'glm-5.3-flash')
  assert.equal(providers[0].zhipuOfficial, true)
  assert.equal(providers[0].useForEmbedding, false)
  assert.equal(ZHIPU_FIRST_VISIBLE_TOKEN_TIMEOUT, 45_000)
})

test('MiniMax Anthropic mode uses Messages format and reads text instead of thinking blocks', async () => {
  let sent: any
  const ctx = { http: { post: async (url: string, body: any, options: any) => {
    sent = { url, body, options }
    return { type: 'message', content: [{ type: 'thinking', thinking: 'internal' }, { type: 'text', text: '{"script":"她看向手机。","interaction":{"seen":true,"reply":{"mode":"none"}}}' }],
      usage: { input_tokens: 10, cache_read_input_tokens: 4, output_tokens: 7 } }
  } } }
  const narrator = new OpenAICompatibleNarrator(ctx as any, {
    providers: [{ label: 'MiniMax', mode: 'minimax-anthropic', enabled: true, apiKey: 'test-key', model: 'MiniMax-M3',
      temperature: 0.8, topP: 1, maxTokens: 512, timeout: 10_000, responseFormat: 'prompt-only', extraHeaders: '', extraBody: '', useForMain: true }],
    failover: { enabled: true, strategy: 'priority', maxAttemptsPerProvider: 1, cooldownMinutes: 5 },
    fixedPrompt: '', stylePrompt: '',
  } as any, true)
  const story = { id: 'story', platform: 'onebot', selfId: 'bot', userId: '', channelId: '', status: 'active',
    setting: emptyStorySetting(), state: emptyStoryState(), cursorAt: now, createdAt: now, updatedAt: now }
  const decision = await narrator.decide({ story, phase: 'user-message', from: now, now, userMessage: '你好',
    recentEntries: [], participant: { id: 'onebot:bot:user', storyId: 'story', userId: 'user', state: {}, createdAt: now, updatedAt: now },
    participants: [], dueIntents: [], activeConsequences: [], supersededIntents: [], memories: [],
    images: [{ id: 'image-1', mimeType: 'image/jpeg', dataUri: 'data:image/jpeg;base64,AA==' }], audio: [] } as any)
  assert.equal(decision.script, '她看向手机。')
  assert.equal(sent.url, 'https://api.minimax.cn/anthropic/v1/messages')
  assert.equal(sent.options.headers.authorization, 'Bearer test-key')
  assert.equal(sent.body.model, 'MiniMax-M3')
  assert.equal(sent.body.response_format, undefined)
  assert.equal(sent.body.messages[0].role, 'user')
  assert.ok(JSON.parse(sent.body.messages[0].content[0].text))
  assert.deepEqual(sent.body.messages[0].content[1], { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AA==' } })
  assert.match(sent.body.system, /CURRENT PHASE: USER MESSAGE/)
  assert.deepEqual(parseTokenUsage({ input_tokens: 10, cache_read_input_tokens: 4, output_tokens: 7 }),
    { inputTokens: 14, outputTokens: 7, cachedInputTokens: 4 })
})

test('official provider presets resolve independent Chat Completions endpoints', () => {
  const providers = configuredProviders({ mode: 'openai-compatible', providers: [
    { label: 'OpenAI', enabled: true, mode: 'openai-official', apiKey: 'x', model: 'gpt-5-mini' },
    { label: 'DeepSeek', enabled: true, mode: 'deepseek-official', apiKey: 'x', model: 'deepseek-chat' },
    { label: 'Moonshot', enabled: true, mode: 'moonshot-official', apiKey: 'x', model: 'kimi-k2.5' },
    { label: 'DashScope', enabled: true, mode: 'dashscope-official', apiKey: 'x', model: 'qwen-plus', dashscopeRegion: 'singapore' },
    { label: 'SiliconFlow', enabled: true, mode: 'siliconflow-official', apiKey: 'x', model: 'Qwen/Qwen3-8B' },
    { label: 'OpenRouter', enabled: true, mode: 'openrouter', apiKey: 'x', model: 'openai/gpt-5-mini' },
    { label: 'Gemini', enabled: true, mode: 'gemini-openai', apiKey: 'x', model: 'gemini-2.5-flash' },
  ] } as any)
  assert.deepEqual(providers.map(item => item.endpoint), [
    'https://api.openai.com/v1/chat/completions',
    'https://api.deepseek.com/v1/chat/completions',
    'https://api.moonshot.cn/v1/chat/completions',
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    'https://api.siliconflow.cn/v1/chat/completions',
    'https://openrouter.ai/api/v1/chat/completions',
    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  ])
})

test('DeepSeek official provider exposes independent thinking controls', () => {
  const [provider] = configuredProviders({ mode: 'openai-compatible', providers: [{
    label: 'DeepSeek', enabled: true, mode: 'deepseek-official', apiKey: 'x', model: 'deepseek-chat', useForMain: true,
  }] } as any)
  assert.equal(provider.deepseekOfficial, true)
  assert.equal(provider.deepseekThinking, 'disabled')
  assert.equal(provider.deepseekReasoningEffort, 'low')
})

test('Agency Window exposes only the four bounded scheduling controls', () => {
  const agency = Config.dict.agency.dict
  assert.deepEqual(Object.keys(agency), [
    'enabled', 'maxWindowMinutes', 'minimumProactiveIntervalMinutes', 'maxCandidateHours',
  ])
  assert.equal(agency.enabled.meta.default, true)
  assert.equal(agency.maxWindowMinutes.meta.default, 240)
})

test('Schedule Preplan is lightweight, enabled by default and reuses the compaction provider', () => {
  const schedule = Config.dict.schedulePreplan.dict
  assert.deepEqual(Object.keys(schedule), ['enabled', 'horizonDays', 'variationLevel', 'candidateActivationProbability', 'candidateRevealMinutes', 'reviewAfterLocalHour', 'anchorAutoAdvance'])
  assert.equal(schedule.enabled.meta.default, true)
  assert.equal(schedule.horizonDays.meta.default, 14)
  assert.equal(schedule.variationLevel.meta.default, 'stable')
  assert.equal('modelId' in schedule, false)
  assert.equal('providerId' in schedule, false)
})

test('real model turns require non-empty narrative prose before they can succeed', () => {
  assert.equal(hasRequiredNarrativeScript({ script: '主角收起手机，继续往前走。' }), true)
  assert.equal(hasRequiredNarrativeScript({ script: '   \n' }), false)
  assert.equal(hasRequiredNarrativeScript({ interaction: { seen: true, reply: { mode: 'none' } } }), false)
})

test('memory compaction defaults leave a slightly wider short-conversation buffer', () => {
  const memory = Config.dict.memory.dict
  assert.equal(memory.sceneEntryThreshold.meta.default, 16)
  assert.equal(memory.sceneCharacterThreshold.meta.default, 10_000)
})

test('recent context combines a fifty-entry floor with a one-hour raw-message window', () => {
  const runtime = Config.dict.runtime.dict
  assert.equal(runtime.contextEntryLimit.meta.default, 50)
  assert.equal(runtime.contextTimeWindowMinutes.meta.default, 60)
})

test('Console exposes a separate, optional protagonist perspective layer', () => {
  assert.equal(Config.dict.storyDefaults.dict.perspective.meta.default, '')
})

test('native audio understanding remains an opt-in main-model capability', () => {
  const audio = Config.dict.model.dict.audio.dict
  assert.equal(audio.enabled.meta.default, false)
  assert.equal(audio.outFormat.meta.default, 'mp3')
  assert.equal(audio.maxFileSizeMB.meta.default, 10)
  assert.equal(audio.maxPerMessage.meta.default, 1)
  assert.equal(Config.dict.onebot.dict.voiceTranscription, undefined)
})

test('group willingness is opt-in and remains scoped to each group rule', () => {
  const willingness = Config.dict.onebot.dict.groupChats.inner.dict.willingness.dict
  assert.equal(willingness.enabled.meta.default, false)
  assert.equal(willingness.decayHalfLifeSeconds.meta.default, 180)
  assert.equal(willingness.threshold.meta.default, 0.24)
})

test('group transport accepts its explicit field and the legacy immediate interaction fallback', () => {
  assert.equal(normalizeGroupVisibleReply({ mode: 'immediate', content: '群内回复' }, undefined, 100), '群内回复')
  assert.equal(normalizeGroupVisibleReply(undefined, { seen: true, reply: { mode: 'immediate', content: '兼容回复' } }, 100), '兼容回复')
  assert.equal(normalizeGroupVisibleReply(undefined, { seen: true, reply: { mode: 'none' } }, 100), '')
  assert.equal(normalizeGroupVisibleReply({ mode: 'immediate', content: '[表情]' }, undefined, 100), '')
  assert.equal(normalizeGroupVisibleReply({ mode: 'immediate', content: '第一句<sep>第二句' }, undefined, 100), '第一句<sep/>第二句')
  assert.equal(normalizeGroupVisibleReply({ mode: 'immediate', content: '第一句＜sep＞第二句' }, undefined, 100), '第一句<sep/>第二句')
})

test('reply-mode logs distinguish missing live replies from normal background silence', () => {
  assert.equal(visibleReplyMode({}, 'user-message'), '未提供或无效')
  assert.equal(visibleReplyMode({}, 'conversation-follow-up'), '无可见投递')
  assert.equal(visibleReplyMode({}, 'advance'), '无可见投递')
  assert.equal(visibleReplyMode({ crossConversationActions: [{ participantId: 'friend', mode: 'immediate', content: '在吗' }] }, 'advance'), '主动联系')
  assert.equal(visibleReplyMode({ interaction: { seen: true, reply: { mode: 'none' } } }, 'intent-due'), 'none')
  assert.equal(visibleReplyMode({ interaction: { seen: true, reply: { mode: 'none', actionId: 'reply' } } }, 'user-message'), '未提供或无效')
  assert.equal(visibleReplyMode({ interaction: { seen: true, reply: { mode: 'none', content: '发出去了' } } }, 'user-message'), '未提供或无效')
})

test('a quoted message followed by a completed send cannot be mistaken for silence', () => {
  assert.equal(scriptClaimsVisiblePrivateSend('她打字：“吃了啊”\n\n发出去她才觉得语气有点冲。'), true)
  assert.equal(scriptClaimsVisiblePrivateSend('她打字：“吃了啊” 但没有发出去。'), false)
  assert.equal(scriptClaimsVisiblePrivateSend('她只是想到“吃了啊”，手机还没拿起来。'), false)
})

test('one explicit current-turn private send can recover its literal transport', () => {
  const runtime = { maxMessageCharacters: 500, messageSeparator: '<sep/>' } as any
  const decision = { script: '她之前说“吃了”发出去。现在看到：吃饭了嘛。她敲下“刚吃了麻辣香锅”\n\n发出去她才觉得语气有点冲。',
    interaction: { seen: true, reply: { mode: 'none' as const } } }
  assert.equal(recoverQuotedPrivateSend(decision, '吃饭了嘛', runtime).interaction?.reply.content, '刚吃了麻辣香锅')
  assert.equal(recoverQuotedPrivateSend(decision, '没收到的消息', runtime), decision)
  assert.equal(recoverQuotedPrivateSend({ ...decision, script: decision.script + '她又敲下“还有宽粉”发出去。' }, '吃饭了嘛', runtime).interaction?.reply.mode, 'none')
  assert.equal(recoverQuotedPrivateSend({ ...decision, script: '吃饭了嘛。她写下“没发出去”但没有发出去。' }, '吃饭了嘛', runtime).interaction?.reply.mode, 'none')
})

test('a sole authored private send recovers an omitted interaction field', () => {
  const runtime = { maxMessageCharacters: 500, messageSeparator: '<sep/>' } as any
  const decision = resolveAuthoredActions({ script: '她看见消息，写下 <say id="reply">刚看到啦</say> 发出去。' })
  assert.deepEqual(recoverAuthoredPrivateSend(decision, runtime).interaction,
    { seen: false, reply: { mode: 'immediate', content: '刚看到啦' } })
  assert.equal(recoverAuthoredPrivateSend({ script: '她只想了想。' }, runtime).interaction, undefined)
})

test('normalizeInteraction keeps seen and reply independent so unread silence cannot erase a sent message', () => {
  const runtime = { maxMessageCharacters: 500, messageSeparator: '<sep/>', minimumDelayedReplySeconds: 10, maximumDelayedReplyMinutes: 120 }
  // 已读不回：合法状态，原样保留。
  assert.deepEqual(normalizeInteraction({ seen: true, reply: { mode: 'none' } }, now, runtime as any),
    { seen: true, reply: { mode: 'none' } })
  // 未读沉默：合法状态。
  assert.deepEqual(normalizeInteraction({ seen: false, reply: { mode: 'none' } }, now, runtime as any),
    { seen: false, reply: { mode: 'none' } })
  // 跟进/到期回合协议规定 seen=false，但真实发送的回复不得被抹掉。
  assert.deepEqual(normalizeInteraction({ seen: false, reply: { mode: 'immediate', content: '想起来还没回你' } }, now, runtime as any),
    { seen: false, reply: { mode: 'immediate', content: '想起来还没回你' } })
  // immediate 缺 content 与非法 mode 的既有语义不变。
  assert.deepEqual(normalizeInteraction({ seen: false, reply: { mode: 'immediate' } }, now, runtime as any),
    { seen: false, reply: { mode: 'none' } })
  assert.equal(normalizeInteraction({ seen: true, reply: { mode: 'later' } }, now, runtime as any), undefined)
})

test('delayed replies outside the allowed window still collapse to none regardless of seen', () => {
  const runtime = { maxMessageCharacters: 500, messageSeparator: '<sep/>', minimumDelayedReplySeconds: 10, maximumDelayedReplyMinutes: 120 }
  const sendAt = new Date(now.getTime() + 5 * 60_000).toISOString()
  assert.deepEqual(normalizeInteraction({ seen: false, reply: { mode: 'delayed', content: '晚点说', sendAt } }, now, runtime as any),
    { seen: false, reply: { mode: 'delayed', content: '晚点说', sendAt } })
  const tooSoon = new Date(now.getTime() + 1_000).toISOString()
  assert.deepEqual(normalizeInteraction({ seen: true, reply: { mode: 'delayed', content: '太早', sendAt: tooSoon } }, now, runtime as any),
    { seen: true, reply: { mode: 'none' } })
})
