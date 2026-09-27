"use client";

import { Eye, EyeOff } from "lucide-react";
import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/*
  PasswordInput
  =============
  Passwords stay masked by default. The adjacent button only changes how the
  field is rendered in this browser; it does not alter validation, form data,
  or how the password is handled by the server.
*/
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const action = visible ? "Hide password" : "Show password";

    return (
      <div className="relative mt-1.5">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(
            "h-11 w-full rounded-md border border-border-strong bg-white px-3 pr-12 text-body text-ink",
            "placeholder:text-slate-light focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:bg-sage disabled:text-slate",
            "aria-[invalid=true]:border-danger",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-slate hover:text-pine focus-visible:outline-none"
          aria-label={action}
          aria-pressed={visible}
        >
          {visible ? <EyeOff aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";
