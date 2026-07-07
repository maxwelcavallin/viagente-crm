import type { FieldDef } from "./contact-form-dialog";

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
