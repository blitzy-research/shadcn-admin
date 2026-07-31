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

  const form = useForm<ConnectDogeSCMForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { workspaceUrl: '', accessToken: '' },
    mode: 'onChange',
  })

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
        form.reset()
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

        form.reset()
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
                    <Input placeholder='https://acme.dogescm.com' {...field} />
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
                    <Input type='password' {...field} />
                  </FormControl>
                  <FormMessage />
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
