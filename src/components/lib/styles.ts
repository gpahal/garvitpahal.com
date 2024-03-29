import { cva } from 'class-variance-authority'

export const linkStyles = cva(
  'underline-offset-[3px] decoration-neutral-7 hocus-visible:outline-none text-opacity-100',
  {
    variants: {
      variant: {
        unstyled: 'no-underline',
        highlighted: 'underline hocus-visible:decoration-neutral-8',
        'hover-highlighted': 'no-underline hocus-visible:underline',
        link: 'text-link-10 no-underline hocus-visible:text-link-11',
      },
    },
    defaultVariants: {
      variant: 'highlighted',
    },
  },
)

export const buttonStyles = cva(
  'relative inline-flex items-center justify-center font-semimedium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-10 focus-visible:ring-offset-1',
  {
    variants: {
      variant: {
        outline: 'text-fg shadow-sm border border-neutral-6 hocus-visible:bg-bg-emphasis-3',
        ghost: 'text-fg hover:bg-bg-emphasis-3',
        inverted: 'bg-fg text-bg shadow-sm hocus-visible:bg-fg-muted',
        'link-unstyled': linkStyles({ variant: 'unstyled' }),
        'link-highlighted': linkStyles({ variant: 'highlighted' }),
        'link-hover-highlighted': linkStyles({ variant: 'hover-highlighted' }),
        link: linkStyles({ variant: 'link' }),
        info: 'bg-info-9 text-info-fg shadow-sm hocus-visible:bg-info-10',
        warn: 'bg-warn-9 text-warn-fg shadow-sm hocus-visible:bg-warn-10',
        error: 'bg-error-9 text-error-fg shadow-sm hocus-visible:bg-error-10',
      },
      size: {
        sm: 'h-[1.875rem] rounded-[0.33rem] px-[0.875rem] text-sm',
        md: 'h-9 rounded-[0.375rem] px-[1.05rem] text-base',
        lg: 'h-10 rounded-[0.42rem] px-[1.25rem] text-lg',
        xl: 'h-11 rounded-[0.475rem] px-[1.45rem] text-xl',
      },
      shape: {
        rect: '',
        square: 'px-0',
      },
      rounded: {
        default: '',
        full: 'rounded-full',
      },
    },
    compoundVariants: [
      {
        size: 'sm',
        shape: 'square',
        className: 'w-8',
      },
      {
        size: 'md',
        shape: 'square',
        className: 'w-9',
      },
      {
        size: 'lg',
        shape: 'square',
        className: 'w-10',
      },
    ],
    defaultVariants: {
      variant: 'outline',
      size: 'md',
      shape: 'rect',
      rounded: 'default',
    },
  },
)

export const buttonSpinnerStyles = cva('text-inherit', {
  variants: {
    size: {
      sm: 'size-3.5',
      md: 'size-4',
      lg: 'size-[1.125rem]',
      xl: 'size-5',
    },
  },
  defaultVariants: {
    size: 'md',
  },
})
