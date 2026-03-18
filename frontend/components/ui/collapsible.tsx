"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type CollapsibleContextValue = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null);

function useCollapsibleContext() {
  const context = React.useContext(CollapsibleContext);
  if (!context) {
    throw new Error("Collapsible components must be used within `Collapsible`.");
  }
  return context;
}

type CollapsibleProps = React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function Collapsible({
  className,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  children,
  ...props
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;

  const setOpen = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => {
      const nextOpen = typeof value === "function" ? value(open) : value;
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange, open]
  );

  return (
    <CollapsibleContext.Provider value={{ open, setOpen }}>
      <div data-state={open ? "open" : "closed"} className={cn("space-y-3", className)} {...props}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

function CollapsibleTrigger({ className, onClick, type = "button", ...props }: React.ComponentProps<"button">) {
  const { open, setOpen } = useCollapsibleContext();

  return (
    <button
      type={type}
      data-state={open ? "open" : "closed"}
      aria-expanded={open}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          setOpen((prev) => !prev);
        }
      }}
      {...props}
    />
  );
}

function CollapsibleContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const { open } = useCollapsibleContext();

  if (!open) {
    return null;
  }

  return (
    <div data-state={open ? "open" : "closed"} className={className} {...props}>
      {children}
    </div>
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
