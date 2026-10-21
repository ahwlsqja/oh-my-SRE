import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import tokens from "./tokens.json";

export const statusSemantics = tokens.statuses;
export type Status = keyof typeof statusSemantics;
type Role = keyof typeof tokens.roles;

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "neutral" | "contrast" | "outline" | "ghost" | "ghost-muted";
    size?: "small" | "normal" | "large";
  }
>(function Button({ variant = "neutral", size = "normal", type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      data-component="button-v2"
      data-variant={variant}
      data-size={size}
      {...props}
    />
  );
});

export function Tag({
  status,
  tone = "muted",
  children,
}: {
  status?: Status;
  tone?: Role;
  children?: ReactNode;
}) {
  const semantic = status ? statusSemantics[status] : undefined;
  return (
    <span data-component="tag" data-tone={semantic?.role ?? tone}>
      {children ?? semantic?.label}
    </span>
  );
}

const Content = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof DialogPrimitive.Content> & { layout?: "case" | "compact" }
>(function Content({ children, layout = "compact", className, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-component="dialog-overlay" />
      <DialogPrimitive.Content
        data-component="dialog-v2"
        data-sds-layout={layout}
        ref={ref}
        {...props}
      >
        <div data-slot="dialog-container" className={className}>
          <div data-slot="dialog-content">{children}</div>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export const Dialog = {
  Root: DialogPrimitive.Root,
  Trigger: ({ children }: { children: ReactNode }) => (
    <DialogPrimitive.Trigger asChild>{children}</DialogPrimitive.Trigger>
  ),
  Close: ({ children }: { children: ReactNode }) => (
    <DialogPrimitive.Close asChild>{children}</DialogPrimitive.Close>
  ),
  Content,
  Title: DialogPrimitive.Title,
  Description: DialogPrimitive.Description,
};

export function Select({
  options,
  onValueChange,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "size"> & {
  options: { value: string; label: string }[];
  onValueChange: (value: string) => void;
}) {
  return (
    <div data-component="select-v2">
      <span data-slot="select-v2-value">
        <select
          {...props}
          data-slot="select-v2-value-text"
          onChange={(event) => onValueChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
      <span data-slot="select-v2-chevron" aria-hidden="true">
        ⌄
      </span>
    </div>
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  compact = false,
}: {
  items: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <div data-component="tabs" data-sds-compact={compact || undefined}>
      <div data-slot="tabs-list" role="group" aria-label={label}>
        {items.map((item) => (
          <span key={item.value} data-slot="tabs-trigger-wrapper">
            <button
              type="button"
              data-slot="tabs-trigger"
              data-selected={value === item.value ? "" : undefined}
              aria-pressed={value === item.value}
              onClick={() => onChange(item.value)}
            >
              {item.label}
              {item.count !== undefined && <span className="sds-tab-count">{item.count}</span>}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export function ObservationTimeline({ name, history }: { name: string; history: string }) {
  const states: Record<string, Status> = { s: "stable", p: "partial", u: "observation_gap" };
  return (
    <div data-component="observation-history">
      <div
        className="observation-bar"
        role="img"
        aria-label={`${name}, 예시 관측 ${history.length}회. 정상이나 회복의 증명이 아닙니다.`}
      >
        {Array.from(history).map((state, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={`observation-segment ${state}`}
            title={`${index + 1}: ${statusSemantics[states[state]].label}`}
          />
        ))}
      </div>
      <div className="observation-range">
        <span>이전</span>
        <span>{history.length}회 관측</span>
        <span>최근</span>
      </div>
    </div>
  );
}
