import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      dir="rtl"
      offset={82}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#1e1b1b] group-[.toaster]:text-white group-[.toaster]:border-[#393434] group-[.toaster]:shadow-2xl font-sans text-xs sm:text-sm font-semibold",
          description: "group-[.toast]:text-white/70",
          actionButton: "group-[.toast]:bg-[#e50914] group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-[#393434] group-[.toast]:text-white",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
