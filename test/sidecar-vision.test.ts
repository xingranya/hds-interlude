import assert from 'node:assert/strict'
import test from 'node:test'
import { OpenAICompatibleNarrator, systemPrompt, toPromptPayload } from '../src/narrator'
import { emptyStorySetting, emptyStoryState, InterludeStory, NarrativeRequest } from '../src/types'
import { recoverClaimedSticker, scriptClaimsStickerSend } from '../src/service'

const now = new Date('2026-08-31T10:00:00.000Z')

function request(overrides: Partial<NarrativeRequest> = {}): NarrativeRequest {
  const story: InterludeStory = {
    id: 'story', platform: 'onebot', selfId: 'bot', userId: '', channelId: '', status: 'active',
    setting: emptyStorySetting(), state: emptyStoryState(), cursorAt: now, createdAt: now, updatedAt: now,
  }
  return {
    phase: 'user-message', story, from: now, now, userMessage: '看看这张图', participant: null,
    participants: [], shareParticipantDetails: false, dueIntents: [], activeConsequences: [], supersededIntents: [], memories: [], recentEntries: [],
    ...overrides,
  }
}

test('sidecar observations remain in the current event and never become native image input', () => {
  const payload = toPromptPayload(request({
    images: [],
    visualObservations: ['1. 一只橘猫趴在键盘上。'],
  })) as any
  assert.deepEqual(payload.incomingEvent.event.visualObservations, ['1. 一只橘猫趴在键盘上。'])
  assert.equal(payload.incomingEvent.event.content, '看看这张图')
  assert.match(systemPrompt('user-message', '', '', '', '', ''), /visualObservations/)
})

test('a dedicated vision provider receives OpenAI image_url content and returns bounded plain observations', async () => {
  const calls: any[] = []
  const ctx = {
    http: {
      post: async (_endpoint: string, body: any) => {
        calls.push(body)
        return { choices: [{ message: { content: '1. 图片中是一只趴在键盘上的橘猫。' } }] }
      },
    },
  }
  const narrator = new OpenAICompatibleNarrator(ctx as any, {
    providers: [{
      label: 'Vision', enabled: true, endpoint: 'https://example.test/v1/chat/completions', apiKey: 'key', model: 'vision-model',
      temperature: 0.8, topP: 1, maxTokens: 4096, timeout: 20_000, responseFormat: 'json-object', extraHeaders: '', extraBody: '',
      useForVision: true,
    }],
    failover: { enabled: true, strategy: 'priority', maxAttemptsPerProvider: 1, cooldownMinutes: 5 },
  } as any, true)
  assert.equal(narrator.visionAvailable(), true)
  const observed = await narrator.describeImages([{ id: 'image-1', mimeType: 'image/jpeg', dataUri: 'data:image/jpeg;base64,AA==' }], '看看这张图', 'low')
  assert.deepEqual(observed, ['1. 图片中是一只趴在键盘上的橘猫。'])
  assert.equal(calls.length, 1)
  assert.equal(calls[0].temperature, 0.2)
  assert.equal(calls[0].messages[1].content[1].type, 'image_url')
  assert.equal(calls[0].messages[1].content[1].image_url.detail, 'low')
})

test('sticker describer supports prompt-only transport while retaining its JSON text contract', async () => {
  const calls: any[] = []
  const ctx = { http: { post: async (_endpoint: string, body: any) => {
    calls.push(body)
    return { choices: [{ message: { content: '{"description":"一只挥手的猫","aliases":["打招呼"]}' } }] }
  } } }
  const narrator = new OpenAICompatibleNarrator(ctx as any, {
    providers: [{ label: 'Sticker', enabled: true, endpoint: 'https://example.test/v1/chat/completions', apiKey: 'key', model: 'vision-model', temperature: 0.8, topP: 1, maxTokens: 4096, timeout: 20_000, responseFormat: 'json-object', extraHeaders: '', extraBody: '', useForStickers: true }],
    failover: { enabled: true, strategy: 'priority', maxAttemptsPerProvider: 1, cooldownMinutes: 5 },
  } as any, true)
  const description = await narrator.describeSticker('data:image/png;base64,AA==', 'image/png', 'hello.png', false, 'prompt-only')
  assert.equal(description?.description, '一只挥手的猫')
  assert.equal('response_format' in calls[0], false)
})

test('MiniMax Anthropic sticker describer sends an image block and reads JSON text', async () => {
  let sent: any
  const ctx = { http: { post: async (url: string, body: any) => {
    sent = { url, body }
    return { content: [{ type: 'thinking', thinking: 'hidden' }, { type: 'text', text: '{"description":"一只惊讶的小猫","aliases":["震惊"]}' }] }
  } } }
  const narrator = new OpenAICompatibleNarrator(ctx as any, {
    providers: [{ label: 'MiniMax', mode: 'minimax-anthropic', enabled: true, apiKey: 'test', model: 'MiniMax-M3',
      temperature: 0.8, topP: 1, maxTokens: 512, timeout: 20_000, responseFormat: 'prompt-only', extraHeaders: '', extraBody: '', useForStickers: true }],
    failover: { enabled: true, strategy: 'priority', maxAttemptsPerProvider: 1, cooldownMinutes: 5 },
  } as any, true)
  const result = await narrator.describeSticker('data:image/png;base64,AA==', 'image/png', 'cat.png', false)
  assert.deepEqual(result, { description: '一只惊讶的小猫', aliases: ['震惊'] })
  assert.equal(sent.url, 'https://api.minimax.cn/anthropic/v1/messages')
  assert.deepEqual(sent.body.messages[0].content[1], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AA==' } })
})

test('only a completed sticker send in prose needs a real local media action', () => {
  assert.equal(scriptClaimsStickerSend('她把那张猫咪表情包拖了进去，又敲了一句发完。'), true)
  assert.equal(scriptClaimsStickerSend('她把那张猫咪表情包又点了一下，弹出发送框，她点了发送。'), true)
  assert.equal(scriptClaimsStickerSend('对方说“发一张可爱的表情包给我看看”，她想了想但没发送。'), false)
  assert.equal(scriptClaimsStickerSend('她记得刚才发了一张猫图，但对方说没收到。'), false)
})

test('an unambiguous claimed sticker is mapped to its real local asset', () => {
  const decision = { script: '她把那张猫咪表情包又点了一下，弹出发送框，她点了发送。一只卡通小猫咪趴在桌面上，伸出舌头微笑。' } as any
  const cat = { assetId: 'yuexin-cat/kitten-0', description: '一只卡通小猫咪趴在桌面上，伸出舌头微笑的表情包。' } as any
  assert.equal(recoverClaimedSticker(decision, [cat]).localMedia?.assetId, cat.assetId)
  assert.equal(recoverClaimedSticker(decision, [cat, { ...cat, assetId: 'duplicate' }]), decision)
  assert.equal(recoverClaimedSticker({ ...decision, script: '她想发一张表情包，但没发送。' }, [cat]).localMedia, undefined)
})
