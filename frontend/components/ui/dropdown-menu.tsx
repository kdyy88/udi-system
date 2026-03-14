"use client"

import * as React from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function DropdownMenu({ children }: { children: React.ReactNode }) {
  return <Popover>{children}</Popover>
}

function DropdownMenuTrigger({ className, ...props }: React.ComponentProps<typeof PopoverTrigger>) {
  return (
    <PopoverTrigger
      className={cn("outline-hidden", className)}
      {...props}
    />
  )
}

function DropdownMenuContent({ className, align = "end", ...props }: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent
      align={align}
      className={cn("w-56 p-1", className)}
      {...props}
    />
  )
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("px-2 py-1.5 text-sm font-medium", className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
}

type DropdownMenuItemProps = React.ComponentProps<"button"> & {
  inset?: boolean
}

function DropdownMenuItem({ className, inset = false, ...props }: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center rounded-md px-2 py-1.5 text-sm outline-hidden transition-colors hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-50",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}