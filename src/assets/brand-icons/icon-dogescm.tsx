import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'

export function IconDogeSCM({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role='img'
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
      width='24'
      height='24'
      className={cn('[&>path]:stroke-current', className)}
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      {...props}
    >
      <title>DogeSCM</title>
      <path strokeWidth='0' d='M0 0h24v24H0z' fill='none' />
      <path d='M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' />
      <path d='M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' />
      <path d='M17 8m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' />
      <path d='M7 8v8' />
      <path d='M9 18h4a4 4 0 0 0 4 -4v-4' />
      <path d='M9.5 9.5l2.5 2.5l-2.5 2.5' />
    </svg>
  )
}
