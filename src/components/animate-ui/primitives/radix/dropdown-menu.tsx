"use client"

import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { AnimatePresence, m, type HTMLMotionProps } from "motion/react"

import { getStrictContext } from "@/lib/get-strict-context"
import { useControlledState } from "@/hooks/use-controlled-state"

type DropdownMenuContextType = {
  isOpen: boolean
  setIsOpen: (o: boolean) => void
}

type DropdownMenuSubContextType = {
  isOpen: boolean
  setIsOpen: (o: boolean) => void
}

const [DropdownMenuProvider, useDropdownMenu] =
  getStrictContext<DropdownMenuContextType>("DropdownMenuContext")

const [DropdownMenuSubProvider, useDropdownMenuSub] =
  getStrictContext<DropdownMenuSubContextType>("DropdownMenuSubContext")

type DropdownMenuProps = React.ComponentProps<typeof DropdownMenuPrimitive.Root>

function DropdownMenu(props: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useControlledState({
    value: props?.open,
    defaultValue: props?.defaultOpen,
    onChange: props?.onOpenChange,
  })
  return (
    <DropdownMenuProvider value={{ isOpen, setIsOpen }}>
      <DropdownMenuPrimitive.Root
        data-slot="dropdown-menu"
        {...props}
        onOpenChange={setIsOpen}
      />
    </DropdownMenuProvider>
  )
}

type DropdownMenuTriggerProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Trigger
>

function DropdownMenuTrigger(props: DropdownMenuTriggerProps) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

type DropdownMenuPortalProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Portal
>

function DropdownMenuPortal(props: DropdownMenuPortalProps) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

type DropdownMenuGroupProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Group
>

function DropdownMenuGroup(props: DropdownMenuGroupProps) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

type DropdownMenuSubProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Sub
>

function DropdownMenuSub(props: DropdownMenuSubProps) {
  const [isOpen, setIsOpen] = useControlledState({
    value: props?.open,
    defaultValue: props?.defaultOpen,
    onChange: props?.onOpenChange,
  })

  return (
    <DropdownMenuSubProvider value={{ isOpen, setIsOpen }}>
      <DropdownMenuPrimitive.Sub
        data-slot="dropdown-menu-sub"
        {...props}
        onOpenChange={setIsOpen}
      />
    </DropdownMenuSubProvider>
  )
}

type DropdownMenuRadioGroupProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.RadioGroup
>

function DropdownMenuRadioGroup(props: DropdownMenuRadioGroupProps) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

type DropdownMenuSubTriggerProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>,
  "asChild"
> &
  HTMLMotionProps<"div">

function DropdownMenuSubTrigger({
  disabled,
  textValue,
  ...props
}: DropdownMenuSubTriggerProps) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      disabled={disabled}
      textValue={textValue}
      asChild
    >
      <m.div
        data-slot="dropdown-menu-sub-trigger"
        data-disabled={disabled}
        {...props}
      />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

type DropdownMenuSubContentProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>,
  "forceMount" | "asChild"
> &
  Omit<
    React.ComponentProps<typeof DropdownMenuPrimitive.Portal>,
    "forceMount"
  > &
  HTMLMotionProps<"div">

function DropdownMenuSubContent({
  loop,
  onEscapeKeyDown,
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  sideOffset,
  alignOffset,
  avoidCollisions,
  collisionBoundary,
  collisionPadding,
  arrowPadding,
  sticky,
  hideWhenDetached,
  transition = { duration: 0.2 },
  style,
  container,
  ...props
}: DropdownMenuSubContentProps) {
  const { isOpen } = useDropdownMenuSub()

  return (
    <AnimatePresence>
      {isOpen && (
        <DropdownMenuPortal forceMount container={container}>
          <DropdownMenuPrimitive.SubContent
            asChild
            forceMount
            loop={loop}
            onEscapeKeyDown={onEscapeKeyDown}
            onPointerDownOutside={onPointerDownOutside}
            onFocusOutside={onFocusOutside}
            onInteractOutside={onInteractOutside}
            sideOffset={sideOffset}
            alignOffset={alignOffset}
            avoidCollisions={avoidCollisions}
            collisionBoundary={collisionBoundary}
            collisionPadding={collisionPadding}
            arrowPadding={arrowPadding}
            sticky={sticky}
            hideWhenDetached={hideWhenDetached}
          >
            <m.div
              key="dropdown-menu-sub-content"
              data-slot="dropdown-menu-sub-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={transition}
              style={{ willChange: "opacity, transform", ...style }}
              {...props}
            />
          </DropdownMenuPrimitive.SubContent>
        </DropdownMenuPortal>
      )}
    </AnimatePresence>
  )
}

type DropdownMenuContentProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.Content>,
  "forceMount" | "asChild"
> &
  Omit<
    React.ComponentProps<typeof DropdownMenuPrimitive.Portal>,
    "forceMount"
  > &
  HTMLMotionProps<"div">

function DropdownMenuContent({
  loop,
  onCloseAutoFocus,
  onEscapeKeyDown,
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  side,
  sideOffset,
  align,
  alignOffset,
  avoidCollisions,
  collisionBoundary,
  collisionPadding,
  arrowPadding,
  sticky,
  hideWhenDetached,
  transition = { duration: 0.2 },
  style,
  container,
  ...props
}: DropdownMenuContentProps) {
  const { isOpen } = useDropdownMenu()

  return (
    <AnimatePresence>
      {isOpen && (
        <DropdownMenuPortal forceMount container={container}>
          <DropdownMenuPrimitive.Content
            asChild
            loop={loop}
            onCloseAutoFocus={onCloseAutoFocus}
            onEscapeKeyDown={onEscapeKeyDown}
            onPointerDownOutside={onPointerDownOutside}
            onFocusOutside={onFocusOutside}
            onInteractOutside={onInteractOutside}
            side={side}
            sideOffset={sideOffset}
            align={align}
            alignOffset={alignOffset}
            avoidCollisions={avoidCollisions}
            collisionBoundary={collisionBoundary}
            collisionPadding={collisionPadding}
            arrowPadding={arrowPadding}
            sticky={sticky}
            hideWhenDetached={hideWhenDetached}
          >
            <m.div
              key="dropdown-menu-content"
              data-slot="dropdown-menu-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={transition}
              style={{ willChange: "opacity, transform", ...style }}
              {...props}
            />
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPortal>
      )}
    </AnimatePresence>
  )
}

type DropdownMenuItemProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.Item>,
  "asChild"
> &
  // `onSelect` is omitted from the motion half on purpose: React's DOM typings
  // give a div an `onSelect` taking a SyntheticEvent, Radix's Item gives it one
  // taking a native Event, and intersecting them produces an overload no call
  // site can satisfy. Radix's is the one that actually fires here.
  Omit<HTMLMotionProps<"div">, "onSelect"> & {
    /**
     * ADDED BY THIS REPO. Upstream omits `asChild` outright and always renders
     * an `m.div`, which this app cannot use: the sign-out row has to BE the
     * `<button type="submit">` inside its form, and a link row has to BE the
     * `<Link>`, or it loses its href and its role. Upstream's `m.div` animates
     * nothing anyway — it carries no `whileHover`, `whileTap`, `initial` or
     * `animate` — so this branch gives up no motion at all.
     *
     * Motion-only props are meaningless here and are not forwarded.
     */
    asChild?: boolean
  }

function DropdownMenuItem({
  disabled,
  onSelect,
  textValue,
  asChild = false,
  children,
  ...props
}: DropdownMenuItemProps) {
  if (asChild) {
    return (
      <DropdownMenuPrimitive.Item
        data-slot="dropdown-menu-item"
        data-disabled={disabled}
        disabled={disabled}
        onSelect={onSelect}
        textValue={textValue}
        asChild
        {...(props as React.ComponentProps<typeof DropdownMenuPrimitive.Item>)}
      >
        {children}
      </DropdownMenuPrimitive.Item>
    )
  }

  return (
    <DropdownMenuPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      textValue={textValue}
      asChild
    >
      <m.div data-slot="dropdown-menu-item" data-disabled={disabled} {...props}>
        {children}
      </m.div>
    </DropdownMenuPrimitive.Item>
  )
}

type DropdownMenuCheckboxItemProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>,
  "asChild"
> &
  HTMLMotionProps<"div">

function DropdownMenuCheckboxItem({
  checked,
  onCheckedChange,
  disabled,
  onSelect,
  textValue,
  ...props
}: DropdownMenuCheckboxItemProps) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      onSelect={onSelect}
      textValue={textValue}
      asChild
    >
      <m.div
        data-slot="dropdown-menu-checkbox-item"
        data-disabled={disabled}
        {...props}
      />
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

type DropdownMenuRadioItemProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>,
  "asChild"
> &
  HTMLMotionProps<"div">

function DropdownMenuRadioItem({
  value,
  disabled,
  onSelect,
  textValue,
  ...props
}: DropdownMenuRadioItemProps) {
  return (
    <DropdownMenuPrimitive.RadioItem
      value={value}
      disabled={disabled}
      onSelect={onSelect}
      textValue={textValue}
      asChild
    >
      <m.div
        data-slot="dropdown-menu-radio-item"
        data-disabled={disabled}
        {...props}
      />
    </DropdownMenuPrimitive.RadioItem>
  )
}

type DropdownMenuLabelProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Label
>

function DropdownMenuLabel(props: DropdownMenuLabelProps) {
  return (
    <DropdownMenuPrimitive.Label data-slot="dropdown-menu-label" {...props} />
  )
}

type DropdownMenuSeparatorProps = React.ComponentProps<
  typeof DropdownMenuPrimitive.Separator
>

function DropdownMenuSeparator(props: DropdownMenuSeparatorProps) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      {...props}
    />
  )
}

type DropdownMenuShortcutProps = React.ComponentProps<"span">

function DropdownMenuShortcut(props: DropdownMenuShortcutProps) {
  return <span data-slot="dropdown-menu-shortcut" {...props} />
}

type DropdownMenuItemIndicatorProps = Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.ItemIndicator>,
  "asChild"
> &
  HTMLMotionProps<"div">

function DropdownMenuItemIndicator(props: DropdownMenuItemIndicatorProps) {
  return (
    <DropdownMenuPrimitive.ItemIndicator
      data-slot="dropdown-menu-item-indicator"
      asChild
    >
      <m.div {...props} />
    </DropdownMenuPrimitive.ItemIndicator>
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  useDropdownMenu,
  useDropdownMenuSub,
  type DropdownMenuProps,
  type DropdownMenuTriggerProps,
  type DropdownMenuContentProps,
  type DropdownMenuItemProps,
  type DropdownMenuItemIndicatorProps,
  type DropdownMenuCheckboxItemProps,
  type DropdownMenuRadioItemProps,
  type DropdownMenuLabelProps,
  type DropdownMenuSeparatorProps,
  type DropdownMenuShortcutProps,
  type DropdownMenuGroupProps,
  type DropdownMenuPortalProps,
  type DropdownMenuSubProps,
  type DropdownMenuSubContentProps,
  type DropdownMenuSubTriggerProps,
  type DropdownMenuRadioGroupProps,
  type DropdownMenuContextType,
  type DropdownMenuSubContextType,
}
