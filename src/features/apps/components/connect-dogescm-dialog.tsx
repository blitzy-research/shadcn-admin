import { useRef, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const formSchema = z.object({
  workspaceUrl: z.url('Please enter a valid workspace URL.'),
  accessToken: z
    .string()
    .min(10, 'Access token must be at least 10 characters.'),
})

type ConnectDogeSCMForm = z.infer<typeof formSchema>

type ConnectDogeSCMDialogProps = {
  connected: boolean
  onConnected: () => void
}

// Mocks POST /api/integrations/dogescm/connect
async function connectDogeSCM(_payload: ConnectDogeSCMForm) {
  await sleep(1500)
  return { connected: true, connectedAt: new Date().toISOString() }
}

export function ConnectDogeSCMDialog({
  connected,
  onConnected,
}: ConnectDogeSCMDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  // A second activation can reach the form before `isLoading` has re-rendered
  // Authorize into its disabled state — a rapid double click is enough, because
  // validation resolves asynchronously. This latch is render-independent, so it
  // is what actually keeps a single authorization in flight per session.
  const authorizing = useRef(false)
  // The access token is rendered uncontrolled (see its field below), so React
  // never writes its value into the DOM and `form.reset()` cannot clear it.
  // React Hook Form's own ref is no help either — for a `Controller` field it
  // wraps focus helpers rather than exposing the node — so the element is
  // captured here and cleared directly.
  const accessTokenRef = useRef<HTMLInputElement | null>(null)

  const form = useForm<ConnectDogeSCMForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { workspaceUrl: '', accessToken: '' },
    mode: 'onChange',
  })

  // Clearing the live node as well as the form state is what stops a typed
  // credential from outliving a dismissal, including across the window in which
  // the dialog is still mounted while it animates out.
  const resetForm = () => {
    form.reset()

    if (accessTokenRef.current) {
      accessTokenRef.current.value = ''
    }
  }

  const onSubmit = (data: ConnectDogeSCMForm) => {
    if (authorizing.current) return

    authorizing.current = true
    setIsLoading(true)

    toast.promise(connectDogeSCM(data), {
      loading: 'Connecting to DogeSCM…',
      success: () => {
        authorizing.current = false
        setIsLoading(false)
        onConnected()
        setOpen(false)
        resetForm()
        return 'DogeSCM connected successfully.'
      },
      error: 'Error',
    })
  }

  // Radix reports only its own interactions through onOpenChange, which is why
  // the programmatic close in the success callback resets the form separately.
  // Both resets are required: this one clears a typed access token whenever the
  // user dismisses the dialog, so no credential survives into a reopen.
  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
        // Submitting is terminal on success, so every dismissal Radix reports
        // here — Cancel, Escape, an outside pointer-down, the close button — is
        // ignored while an authorization is in flight. That is what stops a
        // resolved attempt from notifying the page, clearing a newer form or
        // closing a session the user has already dismissed or reopened.
        if (isLoading && !state) return

        resetForm()
        setOpen(state)
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className={`${connected ? 'border border-blue-300 bg-blue-50 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900' : ''}`}
        >
          {connected ? 'Connected' : 'Connect'}
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md' showCloseButton={!isLoading}>
        <DialogHeader className='text-start'>
          <DialogTitle>Connect DogeSCM</DialogTitle>
          <DialogDescription>
            Authorize access to sync repositories and track commits.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='connect-dogescm-form'
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
                    {/* `aria-required` rather than the native attribute: native
                        constraint validation would pre-empt the submit and
                        replace the schema's messages with browser bubbles.
                        Autofill is declined because a workspace address is not
                        one of the profile values a browser stores. */}
                    <Input
                      placeholder='https://acme.dogescm.com'
                      autoComplete='off'
                      aria-required='true'
                      {...field}
                    />
                  </FormControl>
                  {/* FormControl always points `aria-describedby` at this
                      element's id, so it has to be rendered for the reference
                      to resolve. */}
                  <FormDescription>
                    The address of the DogeSCM workspace to sync.
                  </FormDescription>
                  {/* `alert` is what gets an error that appears mid-typing
                      announced; the element only exists while there is one. */}
                  <FormMessage role='alert' />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='accessToken'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Token</FormLabel>
                  {/* Deliberately uncontrolled: passing `value` makes React
                      mirror the secret into the `value` content attribute, which
                      puts it in every DOM serialization for as long as the
                      dialog is open. Spreading the rest of the field keeps React
                      Hook Form in charge of validation and focus, and
                      `autoComplete='off'` keeps a machine token out of the
                      browser's password manager. */}
                  <FormControl>
                    <Input
                      type='password'
                      autoComplete='off'
                      aria-required='true'
                      name={field.name}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={(node) => {
                        field.ref(node)
                        accessTokenRef.current = node
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    A DogeSCM personal access token with repository read access.
                  </FormDescription>
                  <FormMessage role='alert' />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter className='gap-y-2'>
          <DialogClose asChild>
            <Button variant='outline' disabled={isLoading}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type='submit'
            form='connect-dogescm-form'
            disabled={isLoading}
          >
            {isLoading && <Loader2 className='animate-spin' />}
            Authorize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
