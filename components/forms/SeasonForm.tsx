"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createSeason,
  type SeasonActionState,
} from "@/lib/actions/seasons";
import { SEASON_STATUSES } from "@/lib/validators/season";

type SeasonFormProps = {
  farmId: string;
};

const initialState: SeasonActionState = {};

export function SeasonForm({ farmId }: SeasonFormProps) {
  const [state, formAction] = useActionState(createSeason, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="farm_id" value={farmId} />

      <Field label="Season name" htmlFor="name" error={state.fieldErrors?.name?.[0]}>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          placeholder="e.g. Long rains 2026"
        />
      </Field>

      <Field
        label="Crop type"
        htmlFor="crop_type"
        error={state.fieldErrors?.crop_type?.[0]}
      >
        <Input
          id="crop_type"
          name="crop_type"
          required
          maxLength={80}
          placeholder="e.g. Maize"
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label="Start date"
          htmlFor="start_date"
          error={state.fieldErrors?.start_date?.[0]}
        >
          <Input
            id="start_date"
            name="start_date"
            type="date"
            required
          />
        </Field>

        <Field
          label="End date"
          htmlFor="end_date"
          error={state.fieldErrors?.end_date?.[0]}
        >
          <Input id="end_date" name="end_date" type="date" required />
        </Field>
      </div>

      <Field
        label="Status"
        htmlFor="status"
        error={state.fieldErrors?.status?.[0]}
      >
        <select
          id="status"
          name="status"
          defaultValue="planned"
          className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {SEASON_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          Setting to <strong>active</strong> auto-closes any other active season
          on this farm.
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
      {pending ? "Saving…" : "Create season"}
    </Button>
  );
}
