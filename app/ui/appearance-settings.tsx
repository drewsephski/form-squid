"use client";

import { Button } from "@/components/ui/button";
import { defaultAppearance, resolveAppearance, type Appearance } from "@/app/lib/appearance";
import type { FormSpec } from "@/app/lib/definitions";

const options = {
  theme: [
    ["light", "Light"],
    ["dark", "Dark"],
  ],
  accent: [
    ["neutral", "Neutral"],
    ["blue", "Blue"],
    ["violet", "Violet"],
    ["green", "Green"],
    ["orange", "Orange"],
    ["rose", "Rose"],
  ],
  radius: [
    ["none", "Square"],
    ["md", "Soft"],
    ["xl", "Round"],
  ],
  width: [
    ["sm", "Compact"],
    ["md", "Standard"],
    ["lg", "Wide"],
  ],
  submitWidth: [
    ["auto", "Left"],
    ["full", "Full width"],
  ],
} as const;

const labels = {
  theme: "Theme",
  accent: "Accent",
  radius: "Radius",
  width: "Form width",
  submitWidth: "Button alignment",
} as const;

export function AppearanceSettings({ spec, onSpec }: { spec: FormSpec; onSpec: (spec: FormSpec) => void }) {
  const appearance = resolveAppearance(spec);

  function handleChange<Key extends keyof Appearance>(key: Key, value: Appearance[Key]) {
    const next = { ...defaultAppearance, ...spec.appearance, [key]: value };
    onSpec({ ...spec, appearance: next });
  }

  return (
    <div className="space-y-4">
      {(Object.keys(options) as Array<keyof typeof options>).map((key) => (
        <fieldset key={key} className="space-y-2">
          <legend className="text-sm font-medium">{labels[key]}</legend>
          <div className="flex flex-wrap gap-2">
            {options[key].map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={appearance[key] === value ? "default" : "outline"}
                aria-pressed={appearance[key] === value}
                onClick={() => handleChange(key, value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
