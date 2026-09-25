import { appearanceClassName, appearanceStyle, resolveAppearance } from "@/app/lib/appearance";
import type { FormSpec } from "@/app/lib/definitions";

export function FormMiniPreview({ spec }: { spec: FormSpec }) {
  const appearance = resolveAppearance(spec);
  const fields = spec.steps.flatMap((step) => step.fields).slice(0, 3);

  return (
    <div
      className={`${appearanceClassName(appearance)} pointer-events-none space-y-2 rounded-lg p-3 text-left`}
      style={appearanceStyle(appearance)}
      data-formsquid-theme={appearance.theme}
      aria-hidden="true"
    >
      <p className="truncate text-xs font-medium">{spec.title}</p>
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <p className="truncate text-[10px] text-muted-foreground">{field.label}</p>
          <div className="h-6 rounded-md border border-input bg-background/40" />
        </div>
      ))}
      <div className={appearance.submitWidth === "full" ? "pt-1" : "flex justify-start pt-1"}>
        <div className={`h-6 rounded-md bg-primary ${appearance.submitWidth === "full" ? "w-full" : "w-16"}`} />
      </div>
    </div>
  );
}
