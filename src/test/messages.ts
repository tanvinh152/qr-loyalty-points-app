/**
 * The message-catalog stand-in for tests that assert BEHAVIOUR rather than copy.
 *
 * Every lookup answers with its own key, so an assertion reads
 * `expect(res.message).toBe("forbidden")` — naming the rule — instead of
 * pinning a Vietnamese sentence that a copy edit would break.
 *
 * Component tests do the opposite on purpose: they import the real `en` catalog,
 * because what a member can read IS the thing under test there.
 */
// `any` is the point: the return value stands in for whichever slice of the
// message catalog the module under test reaches for, and every one of them has
// a different shape. Typing it as `Messages["validation"]` would force a cast at
// each of the dozen call sites instead of one here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function keyed(callable: readonly string[] = []): any {
  return new Proxy(
    {},
    {
      get: (_target, key) => {
        const name = String(key)
        // Some messages are functions — `admin.media.tooLarge(MAX_IMAGE_MB)`,
        // `validation.tierRequired(name)`. A bare string would throw at the
        // call site, so those are named explicitly.
        return callable.includes(name) ? () => name : name
      },
    },
  )
}
