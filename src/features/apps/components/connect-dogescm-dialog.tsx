import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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

const formSchema = z.object({
  workspaceUrl: z.url('Please enter a valid workspace URL.'),
  accessToken: z
    .string()
    .min(10, 'Access token must be at least 10 characters.'),
})

type FormValues = z.infer<typeof formSchema>

type ConnectDogeSCMDialogProps = {
  connected?: boolean
  onConnected: () => void
}

// Mock connect call — client-only, no real network request (AAP §0.6.4, §0.9.1).
// `_values` is intentionally unused in the mock (lint: argsIgnorePattern '^_').
function connectDogeSCM(_values: FormValues) {
  return new Promise<{ connected: true; connectedAt: string }>((resolve) => {
    setTimeout(
      () => resolve({ connected: true, connectedAt: new Date().toISOString() }),
      600
    )
  })
}

export function ConnectDogeSCMDialog({
  connected = false,
  onConnected,
}: ConnectDogeSCMDialogProps) {
  const [open, setOpen] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { workspaceUrl: '', accessToken: '' },
    mode: 'onChange',
  })

  const onSubmit = async (values: FormValues) => {
    const result = await connectDogeSCM(values)
    showSubmittedData(
      { ...values, connectedAt: result.connectedAt },
      'DogeSCM connected successfully:'
    )
    onConnected()
    setOpen(false)
    form.reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(state) => {
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
            onSubmit={form.handleSubmit(onSubmit)}
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
          <Button type='submit' form='connect-dogescm-form'>
            Authorize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
