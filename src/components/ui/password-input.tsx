import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Password input con un "ojito" que revela la contraseña SOLO mientras
 * se mantiene presionado el botón (mouse o touch). Al soltar vuelve a ocultar.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof Input>
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña mientras mantienes presionado"}
        tabIndex={-1}
        onMouseDown={(e) => {
          e.preventDefault();
          show();
        }}
        onMouseUp={hide}
        onMouseLeave={hide}
        onTouchStart={(e) => {
          e.preventDefault();
          show();
        }}
        onTouchEnd={hide}
        onTouchCancel={hide}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
