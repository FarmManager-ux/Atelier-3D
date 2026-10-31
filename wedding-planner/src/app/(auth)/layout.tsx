import { Heart } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-sage-100 text-gold-600"><Heart className="size-6 fill-current" /></span>
        <p className="font-serif text-3xl font-semibold text-sage-900">O Nosso Casamento</p>
        <p className="text-sm text-muted-foreground">Área privada dos noivos</p>
      </div>
      {children}
    </main>
  );
}
