// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RemoteControlSettingsTab, type RemoteControlSettingsTabProps } from '../src/client/RemoteControlSettingsTab.tsx'
import type {
  ConnectionActionSnapshot,
  PairingSnapshot,
  ResetIdentitySnapshot,
  RevokeSnapshot,
  SessionsSnapshot,
  SetRelayUrlSnapshot,
  TestConnectionSnapshot,
} from '@firefly0621/dsh-remote-control/types'

afterEach(cleanup)

function props(overrides?: {
  pairing?: PairingSnapshot
  sessions?: SessionsSnapshot
  confirm?: () => boolean
  testConnection?: () => Promise<TestConnectionSnapshot>
  setRelayUrl?: (url: string) => Promise<SetRelayUrlSnapshot>
  connect?: () => Promise<ConnectionActionSnapshot>
  disconnect?: () => Promise<ConnectionActionSnapshot>
}): RemoteControlSettingsTabProps {
  const pairing = vi.fn<() => Promise<PairingSnapshot>>()
    .mockResolvedValue(overrides?.pairing ?? {
      status: 'pairing',
      code: '654321',
      expiresAt: 2_000_000,
      relayUrl: 'ws://relay.example.com',
      qrDataUrl: 'data:image/png;base64,qr',
    })
  const sessions = vi.fn<() => Promise<SessionsSnapshot>>()
    .mockResolvedValue(overrides?.sessions ?? {
      sessions: [{ sessionId: 'token-1', deviceName: 'my-phone', createdAt: 1_000_000 }],
    })
  const revoke = vi.fn<(sessionId: string) => Promise<RevokeSnapshot>>().mockResolvedValue({ revoked: true })
  const resetIdentity = vi.fn<() => Promise<ResetIdentitySnapshot>>().mockResolvedValue({ deviceId: 'fresh-id' })
  const testConnection = vi.fn<() => Promise<TestConnectionSnapshot>>(overrides?.testConnection ?? (async () => ({ ok: true, message: 'relay reachable' })))
  const setRelayUrl = vi.fn<(url: string) => Promise<SetRelayUrlSnapshot>>(overrides?.setRelayUrl ?? (async () => ({ ok: true })))
  const connect = vi.fn<() => Promise<ConnectionActionSnapshot>>(overrides?.connect ?? (async () => ({ ok: true })))
  const disconnect = vi.fn<() => Promise<ConnectionActionSnapshot>>(overrides?.disconnect ?? (async () => ({ ok: true })))
  if (overrides?.confirm !== undefined) {
    vi.spyOn(globalThis, 'confirm').mockImplementation(overrides.confirm)
  } else {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true)
  }
  return {
    pairing,
    connect,
    disconnect,
    sessions,
    revoke,
    resetIdentity,
    testConnection,
    setRelayUrl,
    t: (key: string) => key,
  } as unknown as RemoteControlSettingsTabProps
}

describe('RemoteControlSettingsTab', () => {
  it('renders the pairing code, QR, and bound devices', async () => {
    render(<RemoteControlSettingsTab {...props()} />)
    expect(await screen.findByText('654321')).toBeTruthy()
    expect(screen.getByAltText('qrAlt')).toBeTruthy()
    expect(await screen.findByText('my-phone')).toBeTruthy()
    expect(screen.getByText(/ws:\/\/relay\.example\.com/)).toBeTruthy()
  })

  it('shows an error state when the Remote read fails and recovers via retry', async () => {
    const p = props()
    ;(p.pairing as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    render(<RemoteControlSettingsTab {...p} />)
    expect(await screen.findByRole('alert')).toBeTruthy()
    ;(p.pairing as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'pairing',
      code: '654321',
      phoneRelayUrl: 'ws://relay.example.com',
    })
    fireEvent.click(screen.getByText('retry'))
    expect(await screen.findByText('654321')).toBeTruthy()
  })

  it('revokes a session through the injected face', async () => {
    const p = props()
    render(<RemoteControlSettingsTab {...p} />)
    fireEvent.click(await screen.findByLabelText('revoke'))
    expect(p.revoke).toHaveBeenCalledWith('token-1')
  })

  it('resets the device identity through the injected face', async () => {
    const p = props()
    render(<RemoteControlSettingsTab {...p} />)
    fireEvent.click(await screen.findByText('reset'))
    expect(p.resetIdentity).toHaveBeenCalledOnce()
  })

  it('runs the connection test and reports the result', async () => {
    const p = props()
    render(<RemoteControlSettingsTab {...p} />)
    fireEvent.click(await screen.findByText('testConnection'))
    expect(p.testConnection).toHaveBeenCalledOnce()
    expect(await screen.findByText(/testOk/)).toBeTruthy()
  })

  it('reports a failed connection test with the relay message', async () => {
    const p = props({
      testConnection: async () => ({ ok: false, message: 'relay not connected' }),
    })
    render(<RemoteControlSettingsTab {...p} />)
    fireEvent.click(await screen.findByText('testConnection'))
    expect(await screen.findByText(/relay not connected/)).toBeTruthy()
  })

  it('saves a new relay address through the injected face', async () => {
    const p = props()
    render(<RemoteControlSettingsTab {...p} />)
    await screen.findByText('654321')
    const input = screen.getByPlaceholderText('addressPlaceholder') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'wss://other.example.com' } })
    fireEvent.click(screen.getByText('save'))
    expect(p.setRelayUrl).toHaveBeenCalledWith('wss://other.example.com')
  })

  it('still shows pairing status when the device list read fails', async () => {
    const p = props()
    ;(p.sessions as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('relay not connected'))
    render(<RemoteControlSettingsTab {...p} />)
    expect(await screen.findByText('654321')).toBeTruthy()
    expect(screen.getByText('devicesEmpty')).toBeTruthy()
  })

  it('shows a connect button when disconnected and connects through the face', async () => {
    const p = props({ pairing: { status: 'disconnected', relayUrl: 'ws://relay.example.com' } })
    render(<RemoteControlSettingsTab {...p} />)
    fireEvent.click(await screen.findByText('connect'))
    expect(p.connect).toHaveBeenCalledOnce()
    expect(screen.queryByText('654321')).toBeNull()
  })

  it('disconnects through the face when paired', async () => {
    const p = props()
    render(<RemoteControlSettingsTab {...p} />)
    fireEvent.click(await screen.findByText('disconnect'))
    expect(p.disconnect).toHaveBeenCalledOnce()
  })
})
