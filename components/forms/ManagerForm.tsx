"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignManager,
  type ManagerActionState,
} from "@/lib/actions/managers";

const initialState: ManagerActionState = {};

export function ManagerForm({ farmId }: { farmId: string }) {
  const [state, formAction] = useActionState(assignManager, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="farm_id" value={farmId} />

      <Field
        label="Manager name"
        htmlFor="display_name"
        error={state.fieldErrors?.display_name?.[0]}
      >
        <Input
          id="display_name"
          name="display_name"
          required
          maxLength={80}
          placeholder="e.g. Joseph Mwangi"
        />
      </Field>

      <Field
        label="WhatsApp number"
        htmlFor="whatsapp_e164"
        error={state.fieldErrors?.whatsapp_e164?.[0]}
      >
        <Input
          id="whatsapp_e164"
          name="whatsapp_e164"
          required
          inputMode="tel"
          placeholder="+254712345678"
          pattern="^\+[1-9][0-9]{7,14}$"
        />
        <p className="text-muted-foreground text-xs">
          Use international format starting with <code>+</code> and country
          code. Example: <code>+254712345678</code>.
        </p>
      </Field>

      {state.message ? (
        <p className="text-destructive text-sm">{state.message}</p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Assigning…" : "Assign manager"}
    </Button>
  );
}
