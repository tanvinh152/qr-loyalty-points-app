/**
 * The icon-as-a-prop contract, for the components that take a glyph rather than
 * render one (`StatCard`, `EmptyState`, `SectionCard`, `Input`).
 *
 * It used to be lucide's own `LucideIcon`, which stopped being true the moment
 * one of those call sites started passing an Animate UI icon: an Animate UI
 * icon is not an SVG component with lucide's props, it is a wrapper taking
 * `size`/`animateOnHover`/… and rendering `m.svg` underneath. The two share no
 * props type.
 *
 * Deliberately narrow rather than a union of both libraries' prop types: every
 * one of these components renders `<Icon className="size-N" aria-hidden />` and
 * passes nothing else, so this describes exactly the contract that is used. A
 * union would let a caller pass a lucide-only prop that silently does nothing
 * on the other half of the icon set.
 *
 * Icons themselves are still imported directly at their call sites — this is
 * only the type for the handful of components that receive one.
 */
export type AppIcon = React.ComponentType<{
  className?: string
  "aria-hidden"?: boolean
}>
