import type { FormSpec } from "@/app/lib/definitions";

export interface FormTemplate {
  slug: string;
  name: string;
  description: string;
  category: string;
  spec: FormSpec;
}
