import { PageHeader } from "./PageHeader";

type PlaceholderProps = {
  title: string;
  subtitle?: string;
};

export function Placeholder({ title, subtitle }: PlaceholderProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-8 text-sm text-slate-400">
        Sección en construcción. Aquí conectaremos los datos del backend.
      </div>
    </div>
  );
}
