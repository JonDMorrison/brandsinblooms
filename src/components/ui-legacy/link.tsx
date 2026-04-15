import * as React from "react"
import { NavLink as RouterNavLink, Link as RouterLink, NavLinkProps, LinkProps } from "react-router-dom"

// Forward ref wrapper for NavLink
export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(
  (props, ref) => {
    return <RouterNavLink {...props} ref={ref} />
  }
)
NavLink.displayName = "NavLink"

// Forward ref wrapper for Link
export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  (props, ref) => {
    return <RouterLink {...props} ref={ref} />
  }
)
Link.displayName = "Link"