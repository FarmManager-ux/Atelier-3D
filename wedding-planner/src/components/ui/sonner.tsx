"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Notificações de sucesso e erro, no estilo da aplicação. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      richColors={false}
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border !bg-card !text-foreground !shadow-md !font-sans",
          success: "!border-sage-300",
          error: "!border-[#e2b8b1]",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
