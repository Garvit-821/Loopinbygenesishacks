import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, collisionPadding = 12, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'z-dialog max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[13rem] overflow-y-auto rounded-card bg-surface p-1.5 text-ink shadow-raised outline-none',
          'origin-[--radix-dropdown-menu-content-transform-origin]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'duration-150 motion-reduce:animate-none',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});

const itemClasses = cn(
  'relative flex min-h-11 cursor-default select-none items-center gap-3 rounded-[0.625rem] px-3 text-body text-ink outline-none',
  'transition-colors data-[highlighted]:bg-surface-3 data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
  '[&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-ink-2',
);

export interface DropdownMenuItemProps extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  destructive?: boolean;
}

export const DropdownMenuItem = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Item>, DropdownMenuItemProps>(
  function DropdownMenuItem({ className, destructive = false, ...props }, ref) {
    return (
      <DropdownMenuPrimitive.Item
        ref={ref}
        className={cn(itemClasses, destructive && 'text-danger [&_svg]:text-danger', className)}
        {...props}
      />
    );
  },
);

export const DropdownMenuCheckboxItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(function DropdownMenuCheckboxItem({ className, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.CheckboxItem ref={ref} className={cn(itemClasses, 'pr-10', className)} {...props}>
      {children}
      <DropdownMenuPrimitive.ItemIndicator className="absolute right-3 flex">
        <Check aria-hidden="true" className="!text-accent-ink" strokeWidth={2.5} />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.CheckboxItem>
  );
});

export const DropdownMenuRadioItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.RadioItem ref={ref} className={cn(itemClasses, 'pr-10', className)} {...props}>
      {children}
      <DropdownMenuPrimitive.ItemIndicator className="absolute right-3 flex">
        <Check aria-hidden="true" className="!text-accent-ink" strokeWidth={2.5} />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.RadioItem>
  );
});

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Label>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(function DropdownMenuLabel({ className, ...props }, ref) {
  return <DropdownMenuPrimitive.Label ref={ref} className={cn('px-3 pb-1 pt-2 text-footnote font-medium text-ink-3', className)} {...props} />;
});

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return <DropdownMenuPrimitive.Separator ref={ref} className={cn('-mx-1.5 my-1.5 h-px bg-line-soft', className)} {...props} />;
});
