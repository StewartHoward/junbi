/** Small shared pieces for accessible forms. */
export function FieldError({ id, msg }: { id: string; msg?: string }) {
  return msg ? (
    <p id={id} className="error" role="alert">
      {msg}
    </p>
  ) : null;
}

export function errProps(name: string, errors?: Partial<Record<string, string>>) {
  const msg = errors?.[name];
  return { "aria-invalid": msg ? true : undefined, "aria-describedby": msg ? `${name}-err` : undefined } as const;
}
