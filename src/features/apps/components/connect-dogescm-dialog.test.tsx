import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { ConnectDogeSCMDialog } from './connect-dogescm-dialog'

// Neutralize the mocked connect latency while preserving every other export of
// `@/lib/utils` — `cn` in particular, which every vendored primitive relies on.
vi.mock('@/lib/utils', async (orig) => ({
  ...(await orig()),
  sleep: vi.fn(() => Promise.resolve()),
}))

// The dialog applies every post-connect effect from inside `toast.promise`'s
// `success` callback, so the shim has to actually invoke it for `onConnected`
// to become observable.
const toastPromise = vi.hoisted(() =>
  vi.fn((p: Promise<unknown>, opts: { success?: () => unknown }) => {
    p.then(() => opts.success?.())
  })
)

vi.mock('sonner', () => ({ toast: { promise: toastPromise } }))

const URL_ERROR = 'Please enter a valid workspace URL.'
const TOKEN_ERROR = 'Access token must be at least 10 characters.'
const VALID_URL = 'https://acme.dogescm.com'
const VALID_TOKEN = 'dogescm-token-123'

describe('ConnectDogeSCMDialog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the trigger labelled Connect when not connected', async () => {
    const { getByRole } = await render(
      <ConnectDogeSCMDialog connected={false} onConnected={vi.fn()} />
    )

    await expect
      .element(getByRole('button', { name: /^Connect$/i }))
      .toBeInTheDocument()
  })

  it('renders the trigger labelled Connected when connected', async () => {
    const { getByRole } = await render(
      <ConnectDogeSCMDialog connected onConnected={vi.fn()} />
    )

    await expect
      .element(getByRole('button', { name: /^Connected$/i }))
      .toBeInTheDocument()
  })

  it('opens the dialog with its title, description and both fields', async () => {
    const { getByRole, getByText, getByLabelText } = await render(
      <ConnectDogeSCMDialog connected={false} onConnected={vi.fn()} />
    )

    await userEvent.click(getByRole('button', { name: /^Connect$/i }))

    await expect
      .element(getByRole('heading', { level: 2, name: /Connect DogeSCM/i }))
      .toBeInTheDocument()
    await expect
      .element(getByText(/Authorize access to sync repositories/i))
      .toBeInTheDocument()
    await expect
      .element(getByRole('textbox', { name: /Workspace URL/i }))
      .toBeInTheDocument()
    await expect.element(getByLabelText(/Access Token/i)).toBeInTheDocument()
  })

  it('validates on change and clears the messages once the values are valid', async () => {
    const { getByRole, getByText, getByLabelText } = await render(
      <ConnectDogeSCMDialog connected={false} onConnected={vi.fn()} />
    )

    await userEvent.click(getByRole('button', { name: /^Connect$/i }))

    const urlInput = getByRole('textbox', { name: /Workspace URL/i })
    const tokenInput = getByLabelText(/Access Token/i)
    const urlError = getByText(URL_ERROR)
    const tokenError = getByText(TOKEN_ERROR)

    await userEvent.fill(urlInput, 'dogescm.example.com')
    await userEvent.fill(tokenInput, 'short')

    await expect.element(urlError).toBeInTheDocument()
    await expect.element(tokenError).toBeInTheDocument()

    await userEvent.fill(urlInput, VALID_URL)
    await userEvent.fill(tokenInput, VALID_TOKEN)

    await expect.element(urlError).not.toBeInTheDocument()
    await expect.element(tokenError).not.toBeInTheDocument()
  })

  it('closes on Cancel without connecting', async () => {
    const onConnected = vi.fn()
    const { getByRole, getByLabelText } = await render(
      <ConnectDogeSCMDialog connected={false} onConnected={onConnected} />
    )

    await userEvent.click(getByRole('button', { name: /^Connect$/i }))
    await userEvent.fill(getByLabelText(/Access Token/i), VALID_TOKEN)
    await userEvent.click(getByRole('button', { name: /Cancel/i }))

    await expect
      .element(getByRole('heading', { level: 2, name: /Connect DogeSCM/i }))
      .not.toBeInTheDocument()
    expect(onConnected).not.toHaveBeenCalled()
  })

  it('resets both fields when the dialog is reopened', async () => {
    const { getByRole, getByLabelText } = await render(
      <ConnectDogeSCMDialog connected={false} onConnected={vi.fn()} />
    )

    await userEvent.click(getByRole('button', { name: /^Connect$/i }))
    await userEvent.fill(
      getByRole('textbox', { name: /Workspace URL/i }),
      VALID_URL
    )
    await userEvent.fill(getByLabelText(/Access Token/i), VALID_TOKEN)
    await userEvent.click(getByRole('button', { name: /Cancel/i }))

    await userEvent.click(getByRole('button', { name: /^Connect$/i }))

    await expect
      .element(getByRole('textbox', { name: /Workspace URL/i }))
      .toHaveValue('')
    await expect.element(getByLabelText(/Access Token/i)).toHaveValue('')
  })

  it('authorizes successfully and notifies the page exactly once', async () => {
    const onConnected = vi.fn()
    const { getByRole, getByLabelText } = await render(
      <ConnectDogeSCMDialog connected={false} onConnected={onConnected} />
    )

    await userEvent.click(getByRole('button', { name: /^Connect$/i }))
    await userEvent.fill(
      getByRole('textbox', { name: /Workspace URL/i }),
      VALID_URL
    )
    await userEvent.fill(getByLabelText(/Access Token/i), VALID_TOKEN)
    await userEvent.click(getByRole('button', { name: /Authorize/i }))

    await vi.waitFor(() => expect(onConnected).toHaveBeenCalledOnce())
    expect(toastPromise).toHaveBeenCalledOnce()
  })
})
