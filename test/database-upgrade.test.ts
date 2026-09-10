import assert from 'node:assert/strict'
import test from 'node:test'
import { registerTables } from '../src/database'

test('existing installations extend raw script entries with persistent embeddings', () => {
  const calls: Array<{ name: string, fields: Record<string, unknown> }> = []
  const tables: Record<string, any> = {
    interlude_story: { fields: {} },
    interlude_script_entry: { fields: { content: {} } },
    interlude_web_observation: { fields: {} },
    interlude_overlay_snapshot: { fields: {} },
    interlude_sticker: { fields: {} },
    interlude_schedule_preplan: { fields: {} },
  }
  const ctx = {
    model: {
      tables,
      extend(name: string, fields: Record<string, unknown>) {
        calls.push({ name, fields })
        tables[name] ??= { fields: {} }
        Object.assign(tables[name].fields, fields)
      },
    },
  } as any
  registerTables(ctx)
  assert.deepEqual(calls, [{ name: 'interlude_script_entry', fields: { embedding: 'json' } }])
})

test('knowledge evidence is an additive nullable field and reload does not rebuild it', () => {
  const calls: any[] = []
  const tables: Record<string, any> = {
    interlude_story: { fields: {} }, interlude_fact: { fields: { content: {} } },
    interlude_script_entry: { fields: { embedding: {} } },
    interlude_web_observation: {}, interlude_overlay_snapshot: {}, interlude_sticker: {}, interlude_schedule_preplan: {},
  }
  const ctx = { model: { tables, extend(name: string, fields: any) {
    calls.push({ name, fields }); Object.assign(tables[name].fields, fields)
  } } } as any
  registerTables(ctx)
  registerTables(ctx)
  assert.deepEqual(calls, [{ name: 'interlude_fact', fields: { knowledge: 'json' } }])
})
