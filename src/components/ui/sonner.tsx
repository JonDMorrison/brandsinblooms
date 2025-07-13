
import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      visibleToasts={3}
      position="bottom-right"
      duration={3000}
      toastOptions={{
        style: {
          backgroundColor: '#ffffff',
          color: '#000000',
          border: '1px solid #e5e7eb',
        },
        classNames: {
          toast:
            "group toast group-[.toaster]:!bg-white group-[.toaster]:!text-gray-900 group-[.toaster]:!border-gray-200 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:!text-gray-600",
          actionButton:
            "group-[.toast]:!bg-primary group-[.toast]:!text-white",
          cancelButton:
            "group-[.toast]:!bg-gray-100 group-[.toast]:!text-gray-900",
          success: "group-[.toast]:!bg-white group-[.toast]:!text-green-600 group-[.toast]:!border-green-200",
          error: "group-[.toast]:!bg-white group-[.toast]:!text-red-600 group-[.toast]:!border-red-200",
          warning: "group-[.toast]:!bg-white group-[.toast]:!text-gray-600 group-[.toast]:!border-gray-200",
          info: "group-[.toast]:!bg-white group-[.toast]:!text-blue-600 group-[.toast]:!border-blue-200",
          closeButton: "group-[.toast]:!bg-gray-100 group-[.toast]:!text-gray-600",
        },
        closeButton: true,
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
