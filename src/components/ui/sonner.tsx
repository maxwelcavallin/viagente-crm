"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        // Borda esquerda de destaque 3px na cor semântica conforme o tipo
        // (seção 5 do design system) — nunca cor sozinha, o ícone do
        // sonner (configurado acima) já diferencia sucesso/erro/aviso.
        classNames: {
          toast: "cn-toast rounded-xl! border-l-[3px]!",
          success: "border-l-status-success!",
          error: "border-l-status-danger!",
          warning: "border-l-status-warning!",
          info: "border-l-status-info!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
