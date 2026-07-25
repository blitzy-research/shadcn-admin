import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { IconDogeSCM } from '@/assets/brand-icons'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

// The access token is OPTIONAL — the mock connect body is
// `{ workspaceUrl, accessToken? }` (AAP §0.1.3, §0.6.4). An omitted or blank
// token is allowed; only a supplied token must be at least 10 characters.
// `.trim()` is used SOLELY to decide presence/meaningful length (so a
// whitespace-only value counts as absent rather than a valid ten-space token);
// it never mutates the token bytes that are submitted.
const formSchema = z.object({
  workspaceUrl: z.url('Please enter a valid workspace URL.'),
  accessToken: z
    .string()
    .refine((token) => token.trim().length === 0 || token.trim().length >= 10, {
      message: 'Access token must be at least 10 characters.',
    })
    .optional(),
})

type FormValues = z.infer<typeof formSchema>

type ConnectDogeSCMDialogProps = {
  connected?: boolean
  onConnected: () => void
}

// Mock connect call — client-only, no real network request (AAP §0.6.4, §0.9.1).
// Accepts an AbortSignal so an in-flight connect can be cancelled when the dialog
// is closed or the component unmounts. `_values` is intentionally unused in the
// mock (a real API would send it as the request body; lint: argsIgnorePattern
// '^_').
function connectDogeSCM(
  _values: FormValues,
  signal: AbortSignal
): Promise<{ connected: true; connectedAt: string }> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Connect request aborted.', 'AbortError'))
      return
    }

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve({ connected: true, connectedAt: new Date().toISOString() })
    }, 600)

    const handleAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Connect request aborted.', 'AbortError'))
    }

    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

export function ConnectDogeSCMDialog({
  connected = false,
  onConnected,
}: ConnectDogeSCMDialogProps) {
  const [open, setOpen] = useState(false)

  // Guards are held in refs (never in form/component state) so `form.reset()`
  // cannot clear them. `abortControllerRef` doubles as the in-flight lock (used
  // to reject duplicate submissions) and the handle used to cancel a pending
  // connect; `isMountedRef` lets us suppress a stale completion after unmount.
  const abortControllerRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { workspaceUrl: '', accessToken: '' },
    mode: 'onChange',
  })

  const { isSubmitting } = form.formState

  // Abort any in-flight connect when the component unmounts so a stale
  // resolution cannot fire the success toast/callback after teardown.
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [])

  // Cancel a pending connect and release the in-flight lock (used on close).
  const cancelPendingConnect = () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }

  const onSubmit = async (values: FormValues) => {
    // Synchronous, same-frame duplicate guard: ignore additional submissions
    // while a connect is already in flight (covers rapid double-clicks fired
    // before the button's disabled state re-renders).
    if (abortControllerRef.current) return

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const result = await connectDogeSCM(values, controller.signal)

      // Ignore stale completions: only continue if this request is still the
      // current one and the component remains mounted.
      if (!isMountedRef.current || controller.signal.aborted) return

      // Non-sensitive success feedback ONLY — never surface the access token or
      // workspace URL (CWE-200). Show just the mock-derived timestamp.
      showSubmittedData(
        { connectedAt: result.connectedAt },
        'DogeSCM connected successfully:'
      )
      onConnected()
      setOpen(false)
      form.reset()
    } catch {
      // Aborted/cancelled connect — suppress all success side effects.
    } finally {
      // Release the in-flight lock only if this is still the active request, so
      // a superseding submission's controller is never cleared by mistake.
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        // On close (Cancel, X, Escape, outside-click) abort any pending connect
        // BEFORE resetting the form, so a stale resolution cannot fire the
        // toast/callback. The guard is a ref, so `form.reset()` never erases it.
        if (!state) {
          cancelPendingConnect()
        }
        form.reset()
        setOpen(state)
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className={
            connected
              ? 'border border-blue-300 bg-blue-50 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900'
              : ''
          }
        >
          {connected ? 'Connected' : 'Connect'}
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-start'>
          <DialogTitle className='flex items-center gap-2'>
            <IconDogeSCM /> Connect DogeSCM
          </DialogTitle>
          <DialogDescription>
            Authorize access to sync your repositories and track commits.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='connect-dogescm-form'
            // Build the RHF submit handler at event time (not during render) so
            // the ref-backed guards in `onSubmit` are never read during render.
            onSubmit={(event) => form.handleSubmit(onSubmit)(event)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='workspaceUrl'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace URL</FormLabel>
                  <FormControl>
                    <Input
                      type='url'
                      placeholder='https://dogescm.example.com/workspace'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='accessToken'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Token</FormLabel>
                  <FormControl>
                    <Input
                      type='password'
                      placeholder='Enter your access token'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter className='gap-y-2'>
          <DialogClose asChild>
            <Button variant='outline'>Cancel</Button>
          </DialogClose>
          <Button
            type='submit'
            form='connect-dogescm-form'
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className='animate-spin' />}
            Authorize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
