export type FieldDef = {
  id: string;
  key: string;
  label: string;
  type: "texto" | "numero" | "select" | "data";
  options: { value: string; label: string }[] | null;
};

// Campos "select" guardam o value interno em custom_fields — exibição
// sempre resolve pro label configurado em custom_field_definitions.options.
export function formatCustomFieldValue(
  field: FieldDef,
  rawValue: unknown
): string {
  if (rawValue == null || rawValue === "") return "—";
  if (field.type === "select") {
    const option = (field.options ?? []).find((o) => o.value === rawValue);
    return option?.label ?? String(rawValue);
  }
  return String(rawValue);
}

export async function buildCustomFieldsFromForm(
  formData: FormData,
  definitions: { key: string }[]
): Promise<Record<string, string>> {
  const customFields: Record<string, string> = {};
  for (const def of definitions) {
    const value = formData.get(`custom_${def.key}`);
    if (typeof value === "string" && value.trim()) {
      customFields[def.key] = value.trim();
    }
  }
  return customFields;
}
