import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { ConnectDogeSCMDialog } from './connect-dogescm-dialog'

// Spread the original module so `cn` survives for the primitives; only the
// simulated latency is neutralized. Hoisted because `vi.mock` factories run
// before module initialization, and the last case swaps in a deferred promise.
const sleepMock = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('@/lib/utils', async (orig) => ({
  ...(await orig()),
  sleep: sleepMock,
}))

// Hoisted because `vi.mock` factories run before module scope is initialized.
// The shim invokes `success` because the dialog applies every post-connect
// effect from inside that callback, which is what makes `onConnected`
// observable here.
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

  it('authorizes once, resists dismissal while pending, and notifies the page exactly once', async () => {
    const onConnected = vi.fn()
    let releaseConnect = () => {}
    sleepMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseConnect = () => resolve()
        })
    )

    const { getByRole, getByLabelText } = await render(
      <ConnectDogeSCMDialog connected={false} onConnected={onConnected} />
    )

    await userEvent.click(getByRole('button', { name: /^Connect$/i }))
    const urlInput = getByRole('textbox', { name: /Workspace URL/i })
    await userEvent.fill(urlInput, VALID_URL)
    await userEvent.fill(getByLabelText(/Access Token/i), VALID_TOKEN)

    // Two activations inside a single task: validation resolves asynchronously,
    // so Authorize has not re-rendered as disabled yet and only the component's
    // latch can hold this to one authorization. `userEvent` serializes its
    // actions and cannot express that race, hence the native activation.
    const authorize = getByRole('button', { name: /Authorize/i })
    const authorizeElement = authorize.element() as HTMLElement
    authorizeElement.click()
    authorizeElement.click()

    await expect.element(authorize).toBeDisabled()
    await expect
      .element(getByRole('button', { name: /Cancel/i }))
      .toBeDisabled()
    await expect
      .element(getByRole('button', { name: /^Close$/i }))
      .not.toBeInTheDocument()
    expect(sleepMock).toHaveBeenCalledOnce()
    expect(toastPromise).toHaveBeenCalledOnce()

    await userEvent.keyboard('{Escape}')
    await expect
      .element(getByRole('heading', { level: 2, name: /Connect DogeSCM/i }))
      .toBeInTheDocument()
    await expect.element(urlInput).toHaveValue(VALID_URL)

    await userEvent.click(urlInput)
    await userEvent.keyboard('{Enter}')
    expect(sleepMock).toHaveBeenCalledOnce()
    expect(toastPromise).toHaveBeenCalledOnce()
    expect(onConnected).not.toHaveBeenCalled()

    releaseConnect()

    await vi.waitFor(() => expect(onConnected).toHaveBeenCalledOnce())
    expect(toastPromise).toHaveBeenCalledOnce()
    await expect
      .element(getByRole('heading', { level: 2, name: /Connect DogeSCM/i }))
      .not.toBeInTheDocument()
  })

  it('keeps the access token out of serializable markup and exposes field metadata', async () => {
    const { getByRole, getByLabelText } = await render(
      <ConnectDogeSCMDialog connected={false} onConnected={vi.fn()} />
    )

    await userEvent.click(getByRole('button', { name: /^Connect$/i }))

    const urlInput = getByRole('textbox', { name: /Workspace URL/i })
    const tokenInput = getByLabelText(/Access Token/i)
    await userEvent.fill(urlInput, VALID_URL)
    await userEvent.fill(tokenInput, VALID_TOKEN)

    const urlElement = urlInput.element() as HTMLInputElement
    const tokenElement = tokenInput.element() as HTMLInputElement
    const dialog = tokenElement.closest('[data-slot="dialog-content"]')!

    // The live control is the only place the secret may exist. A controlled
    // input would also mirror it into the `value` content attribute, putting it
    // into every serialization of the element, the dialog and the document.
    expect(tokenElement.value).toBe(VALID_TOKEN)
    expect(tokenElement.type).toBe('password')
    expect(tokenElement.getAttribute('value')).toBeNull()
    expect(tokenElement.defaultValue).toBe('')
    expect(tokenElement.outerHTML).not.toContain(VALID_TOKEN)
    expect(dialog.innerHTML).not.toContain(VALID_TOKEN)
    expect(document.body.innerHTML).not.toContain(VALID_TOKEN)

    for (const element of [urlElement, tokenElement]) {
      // Declining autofill keeps a workspace address and a machine token out of
      // the browser's stored profile and password manager.
      expect(element.getAttribute('autocomplete')).toBe('off')
      // Required state is exposed to assistive technology only: the native
      // attribute would hand validation to the browser and suppress the
      // schema's own messages.
      expect(element.getAttribute('aria-required')).toBe('true')
      expect(element.hasAttribute('required')).toBe(false)

      const describedBy = element.getAttribute('aria-describedby')!
      expect(describedBy.split(' ')).toHaveLength(1)
      for (const id of describedBy.split(' ')) {
        expect(document.getElementById(id)).not.toBeNull()
      }
    }
  })

  it('announces validation errors and keeps every described-by reference resolvable', async () => {
    const { getByRole, getByText, getByLabelText } = await render(
      <ConnectDogeSCMDialog connected={false} onConnected={vi.fn()} />
    )

    await userEvent.click(getByRole('button', { name: /^Connect$/i }))

    const urlInput = getByRole('textbox', { name: /Workspace URL/i })
    const tokenInput = getByLabelText(/Access Token/i)
    await userEvent.fill(urlInput, 'dogescm.example.com')
    await userEvent.fill(tokenInput, 'short')

    const urlError = getByText(URL_ERROR)
    const tokenError = getByText(TOKEN_ERROR)
    await expect.element(urlError).toBeInTheDocument()
    await expect.element(tokenError).toBeInTheDocument()

    // Without a role the messages render silently, because they appear while
    // the user is still typing rather than in response to a submit.
    expect(urlError.element().getAttribute('role')).toBe('alert')
    expect(tokenError.element().getAttribute('role')).toBe('alert')

    for (const element of [urlInput.element(), tokenInput.element()]) {
      expect(element.getAttribute('aria-invalid')).toBe('true')

      // In the error state the description and the message are both referenced,
      // so both ids have to resolve to a rendered element.
      const describedBy = element.getAttribute('aria-describedby')!
      expect(describedBy.split(' ')).toHaveLength(2)
      for (const id of describedBy.split(' ')) {
        expect(document.getElementById(id)).not.toBeNull()
      }
    }
  })
})
