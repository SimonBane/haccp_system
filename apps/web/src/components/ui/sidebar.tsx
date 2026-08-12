"use client"

import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { useDrawerSwipe } from "@/hooks/use-drawer-swipe"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

const SIDEBAR_WIDTH = "16rem"

/**
 * There is no desktop collapse. Six flat nav items do not earn a hide/show
 * affordance, and the one that existed never persisted — it wrote a cookie
 * nothing ever read. What remains is the mobile drawer, which is a different
 * mechanism entirely: a panel behind the content, revealed by translating the
 * content off it.
 */
type SidebarContextProps = {
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

function SidebarProvider({
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const isMobile = useIsMobile()
  // Derived rather than reset in an effect: crossing to desktop mid-session
  // must not strand an open drawer, and the desktop tree has no scrim to
  // dismiss it with.
  const [openMobileState, setOpenMobile] = React.useState(false)
  const openMobile = isMobile && openMobileState

  // Desktop has nothing to toggle — the sidebar is always there.
  const toggleSidebar = React.useCallback(() => {
    if (!isMobile) return
    setOpenMobile((open) => !open)
  }, [isMobile, setOpenMobile])

  // The gesture writes the panel position straight to this element, so the
  // context no longer carries per-frame drag state — and no longer re-renders
  // every `useSidebar()` consumer sixty times a second while dragging.
  const { rootRef } = useDrawerSwipe({
    open: openMobile,
    onOpenChange: setOpenMobile,
    enabled: isMobile,
    mode: "anywhere",
  })

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [isMobile, openMobile, setOpenMobile, toggleSidebar]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        ref={rootRef}
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          // Fixed height, never scrolls: the shell's scroll region lives
          // inside SidebarInset. Nothing here may set transform, filter,
          // backdrop-filter, will-change, contain or perspective — any of
          // them makes this a containing block and detaches every portalled
          // fixed overlay from the viewport.
          //
          // Desktop: h-full against the html/body percentage chain.
          // Mobile: globals.css pins this box to the visual viewport
          // (`--app-vv-top` / `--app-vv-height`) so iOS toolbar / focus
          // shifts cannot letterbox the drawer and content.
          "group/sidebar-wrapper relative flex h-full w-full overflow-hidden",
          "has-data-[variant=inset]:bg-sidebar max-md:bg-sidebar",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  className,
  children,
  dir,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
}) {
  const { isMobile } = useSidebar()

  if (isMobile) {
    return (
      <MobileSidebar side={side} variant={variant} {...props}>
        {children}
      </MobileSidebar>
    )
  }

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* Holds the column open in flow; the panel itself is fixed. */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          "relative w-(--sidebar-width) bg-transparent",
          "group-data-[side=right]:rotate-180"
        )}
      />
      <div
        data-slot="sidebar-container"
        data-side={side}
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) data-[side=left]:left-0 data-[side=right]:right-0 md:flex",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "p-2"
            : "group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="flex size-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function MobileSidebar({
  side = "left",
  variant = "sidebar",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
}) {
  const { openMobile } = useSidebar()
  const ref = React.useRef<HTMLDivElement>(null)
  const restoreTo = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (openMobile) {
      restoreTo.current = document.activeElement as HTMLElement | null
      // Next frame: `inert` clears in this same commit, and focus() on a
      // still-inert element is silently dropped.
      //
      // preventScroll, because iOS scrolls the layout viewport to reveal a
      // focus target even with `html { overflow: hidden }` — which slides every
      // fixed layer off the top and is one of the ways the safe-area strips end
      // up unpainted.
      const frame = requestAnimationFrame(() =>
        ref.current?.focus({ preventScroll: true }),
      )
      return () => cancelAnimationFrame(frame)
    }

    restoreTo.current?.focus?.()
    restoreTo.current = null
  }, [openMobile])

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      // The panel is always mounted, sitting behind the content. Without this
      // its links stay in the tab order and are read out by screen readers
      // while invisible. `inert` covers aria-hidden too — setting both is how
      // you get "aria-hidden on a focused ancestor" warnings.
      inert={!openMobile}
      data-sidebar="sidebar"
      data-slot="sidebar"
      data-mobile="true"
      data-state={openMobile ? "open" : "closed"}
      data-variant={variant}
      data-side={side}
      className={cn(
        // Absolute on mobile: the wrapper is the visual-viewport-locked shell
        // (see globals.css). Fixed would ignore that box and re-letterbox.
        "absolute inset-y-0 z-10 flex w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground outline-none md:hidden",
        side === "left" ? "left-0" : "right-0",
        className
      )}
      {...props}
    >
      <div
        data-slot="sidebar-inner"
        className="flex size-full flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        {children}
      </div>
    </div>
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  const { isMobile, openMobile } = useSidebar()

  return (
    <main
      data-slot="sidebar-inset"
      // Focus containment while the drawer is open, without a focus trap:
      // an inert subtree is unreachable by tab, pointer and screen reader.
      // The scrim is a sibling of this element precisely so it stays tappable.
      inert={isMobile && openMobile}
      className={cn(
        // No h-full: the wrapper is a stretch row, so this already resolves to
        // the wrapper's height minus its own margins. h-full would overflow by
        // the 8px of md:m-2 on the desktop inset card.
        "relative flex w-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background",
        // The drawer reveal itself — translate, transition and the
        // drag-time suppression — lives in globals.css under
        // [data-slot="sidebar-inset"], so the panel and the scrim cannot
        // drift apart.
        "max-md:z-20 max-md:rounded-l-xl",
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:ring-1 md:peer-data-[variant=inset]:ring-border",
        className
      )}
      {...props}
    />
  )
}

/**
 * Dims the content panel as the drawer comes out, and closes it on tap.
 *
 * A sibling of `SidebarInset` rather than a child: the inset goes `inert`
 * while the drawer is open, and an inert subtree is not hit-testable, so a
 * scrim inside it would pass taps straight through to the sidebar behind.
 * It carries the same transform as the panel so it covers exactly that and
 * never the drawer.
 */
function SidebarScrim({ label }: { label: string }) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar()

  return (
    <button
      type="button"
      data-slot="sidebar-scrim"
      aria-label={label}
      tabIndex={isMobile && openMobile ? 0 : -1}
      aria-hidden={!(isMobile && openMobile)}
      onClick={() => setOpenMobile(false)}
      className={cn(
        // Absolute + opacity/translate: same visual-viewport shell as the
        // sidebar (globals.css). Must not be `fixed` or it detaches from it.
        "absolute inset-0 z-30 touch-none bg-black/40 md:hidden",
        // Only clickable once committed open, so a drag cannot land a tap.
        openMobile ? "pointer-events-auto" : "pointer-events-none"
      )}
    />
  )
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn("h-8 w-full bg-background shadow-none", className)}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-auto",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col px-2 py-0.5", className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & React.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "mb-1 flex h-6 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-group-label",
      sidebar: "group-label",
    },
  })
}

function SidebarGroupAction({
  className,
  render,
  ...props
}: useRender.ComponentProps<"button"> & React.ComponentProps<"button">) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          "absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-group-action",
      sidebar: "group-action",
    },
  })
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] group-has-data-[sidebar=menu-action]/menu-item:pr-8 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:hover:bg-sidebar-accent data-open:hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground [&_svg]:size-[1.125rem] [&_svg]:shrink-0 [&>span:last-child]:truncate",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "h-11 text-sm md:h-8",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * No `tooltip` prop: it existed to name an icon that had lost its label in the
 * collapsed rail, and there is no collapsed rail. Every item shows its label.
 */
function SidebarMenuButton({
  render,
  isActive = false,
  variant = "default",
  size = "default",
  className,
  ...props
}: useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & {
    isActive?: boolean
  } & VariantProps<typeof sidebarMenuButtonVariants>) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(sidebarMenuButtonVariants({ variant, size }), className),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-menu-button",
      sidebar: "menu-button",
      size,
      active: isActive,
    },
  })
}

function SidebarMenuAction({
  className,
  render,
  showOnHover = false,
  ...props
}: useRender.ComponentProps<"button"> &
  React.ComponentProps<"button"> & {
    showOnHover?: boolean
  }) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        className: cn(
          "absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
          showOnHover &&
            "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100 md:opacity-0",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-menu-action",
      sidebar: "menu-action",
    },
  })
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 peer-data-active/menu-button:text-sidebar-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean
}) {
  // Random width between 50 to 90%.
  const [width] = React.useState(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  })

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("group/menu-sub-item relative", className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  render,
  size = "md",
  isActive = false,
  className,
  ...props
}: useRender.ComponentProps<"a"> &
  React.ComponentProps<"a"> & {
    size?: "sm" | "md"
    isActive?: boolean
  }) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          "flex h-10 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 md:h-7 text-sidebar-foreground ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[size=md]:text-sm data-[size=sm]:text-xs data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
          className
        ),
      },
      props
    ),
    render,
    state: {
      slot: "sidebar-menu-sub-button",
      sidebar: "menu-sub-button",
      size,
      active: isActive,
    },
  })
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarScrim,
  SidebarSeparator,
  useSidebar,
}
