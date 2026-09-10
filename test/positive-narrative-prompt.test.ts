import assert from 'node:assert/strict'
import test from 'node:test'
import { systemPrompt } from '../src/narrator'

test('live writing is guided by event density instead of elapsed-time length quotas', () => {
  const prompt = systemPrompt('user-message', '', '', '', '', '')
  assert.match(prompt, /Length and detail follow what actually happens/)
  assert.match(prompt, /including during a rapid exchange/)
  assert.match(prompt, /quiet interval also has its own occupation/)
  assert.match(prompt, /length of the sent words does not set the depth or length/)
  assert.match(prompt, /When no prior original passage is available/)
  assert.doesNotMatch(prompt, /may consist mainly of dialogue|interval can pass lightly/)
  assert.doesNotMatch(prompt, /400-700 characters/)
})

test('the visible reply remains an event inside one causal script', () => {
  const prompt = systemPrompt('user-message', '', '', '', '', '')
  assert.match(prompt, /next passage AFTER the last completed original/)
  assert.match(prompt, /write speech once, inside the living script/)
  assert.match(prompt, /same causal passage/)
})

test('continuity evolves positively without forced novelty templates', () => {
  const prompt = systemPrompt('user-message', '', '', '', '', '')
  assert.match(prompt, /an exchange can stay open/)
  assert.match(prompt, /motives remain implicit/)
  assert.doesNotMatch(prompt, /fresh piece of writing/)
  assert.doesNotMatch(prompt, /putting the phone away/)
})

test('dense dialogue continues from changed beats without a fixed reply ceremony', () => {
  const prompt = systemPrompt('user-message', '', '', '', '', '')
  assert.match(prompt, /first change not yet written/)
  assert.match(prompt, /need not be restated, but remain present wherever they touch her attention or mood/)
  assert.doesNotMatch(prompt, /Keep a consideration, draft, or typing moment/)
  assert.doesNotMatch(prompt, /First write the life that has unfolded/)
})

test('M5 exposes only the transport channel available to the current phase', () => {
  const privateTurn = systemPrompt('user-message', '', '', '', '', '')
  const groupTurn = systemPrompt('user-message', '', '', '', '', '', false, false, false, false, false, undefined, false, undefined, false, false, false, true)
  const advance = systemPrompt('advance', '', '', '', '', '')
  assert.match(privateTurn, /For this private turn, return interaction/)
  assert.doesNotMatch(privateTurn, /return groupReply as/)
  assert.match(groupTurn, /return groupReply as/)
  assert.doesNotMatch(groupTurn, /For this private turn, return interaction/)
  assert.match(groupTurn, /actually posts to the group/)
  assert.doesNotMatch(groupTurn, /actually sends a private reply/)
  assert.doesNotMatch(advance, /For this private turn, return interaction/)
})
