// @vitest-environment jsdom
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import type {
  PairingSnapshot,
  ResetIdentitySnapshot,
  RevokeSnapshot,
  SessionsSnapshot,
} from '@deepseek-ai/dsh-api-remotes/client'
import { apply, inject, NS } from '../src/client/index.ts'
import { RemoteControlSettingsTab } from '../src/client/RemoteControlSettingsTab.tsx'
import type { RemoteControlSettingsTabInjected } from '../src/client/RemoteControlSettingsTab.tsx'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

const PAIRING: PairingSnapshot = {
  status: 'pairing',
  code: '123456',
  expiresAt: 1_000_000,
  phoneRelayUrl: 'ws://relay.example.com',
  qrDataUrl: 'data:image/png;base64,qr',
}
const SESSIONS: SessionsSnapshot = {
  sessions: [{ sessionId: 'token-1', deviceName: 'my-phone', createdAt: 1_000_000 }],
}

type RemoteResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  class RemoteService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'remote')
    }
  }
  new RemoteService(ctx)
  const pairing = vi.fn<() => Promise<RemoteResult<PairingSnapshot>>>()
    .mockResolvedValue({ ok: true, value: PAIRING })
  const sessions = vi.fn<() => Promise<RemoteResult<SessionsSnapshot>>>()
    .mockResolvedValue({ ok: true, value: SESSIONS })
  const revoke = vi.fn<(sessionId: string) => Promise<RemoteResult<RevokeSnapshot>>>()
    .mockResolvedValue({ ok: true, value: { revoked: true } })
  const resetIdentity = vi.fn<() => Promise<RemoteResult<ResetIdentitySnapshot>>>()
    .mockResolvedValue({ ok: true, value: { deviceId: 'fresh-id' } })
  ctx.provide('remote.remoteControl', { pairing, sessions, revoke, resetIdentity })
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, pairing, sessions, revoke, resetIdentity }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.plugins.tab': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-remote-control browser plugin', () => {
  it('declares only the services used by the pairing Remote contribution', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.remoteControl'])
  })

  it('registers a localized tab without reading the Remote eagerly', async () => {
    const b = await bench()
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const entry = b.slots.entries('settings.plugins.tab')[0]!
    expect(entry.component).toBe(RemoteControlSettingsTab)
    expect(entry.options).toMatchObject({ id: 'remote', order: 20 })
    expect(entry.locale).toBe(NS)
    expect(resolveSlotLabel(entry.options.label)).toBe('远程控制')
    expect(b.pairing).not.toHaveBeenCalled()

    const injected = (entry.inject as unknown as () => RemoteControlSettingsTabInjected)()
    await expect(injected.pairing()).resolves.toEqual(PAIRING)
    await expect(injected.sessions()).resolves.toEqual(SESSIONS)
    await expect(injected.revoke('token-1')).resolves.toEqual({ revoked: true })
    await expect(injected.resetIdentity()).resolves.toEqual({ deviceId: 'fresh-id' })
    expect(b.pairing).toHaveBeenCalledOnce()

    b.pairing.mockResolvedValueOnce({ ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } })
    await expect(injected.pairing()).rejects.toThrow('remoteControl.pairing failed: REMOTE_ERROR: unavailable')
    await b.ctx.fiber.dispose()
  })
})
