"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createFarm,
  updateFarm,
  type FarmActionState,
} from "@/lib/actions/farms";
import { OWNERSHIP_TYPES } from "@/lib/validators/farm";

type FarmFormInitial = {
  id: string;
  name: string;
  location: string;
  size_acres: string;
  ownership_type: "owned" | "rented";
  latitude: string | null;
  longitude: string | null;
};

type FarmFormProps = {
  initial?: FarmFormInitial;
};

const initialState: FarmActionState = {};

export function FarmForm({ initial }: FarmFormProps) {
  const action = initial ? updateFarm : createFarm;
  const [state, formAction] = useActionState(action, initialState);

  const [lat, setLat] = useState(initial?.latitude ?? "");
  const [lng, setLng] = useState(initial?.longitude ?? "");
  const [geoState, setGeoState] = useState<
    "idle" | "loading" | "ok" | "denied" | "error"
  >("idle");

  function useMyLocation() {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGeoState("error");
      return;
    }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setGeoState("ok");
      },
      (err) => {
        setGeoState(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <Field
        label="Farm name"
        htmlFor="name"
        error={state.fieldErrors?.name?.[0]}
      >
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={initial?.name}
          placeholder="e.g. Karen Plot"
        />
      </Field>

      <Field
        label="Location"
        htmlFor="location"
        error={state.fieldErrors?.location?.[0]}
      >
        <Input
          id="location"
          name="location"
          required
          maxLength={200}
          defaultValue={initial?.location}
          placeholder="e.g. Karen, Nairobi"
        />
      </Field>

      <Field
        label="Size (acres)"
        htmlFor="size_acres"
        error={state.fieldErrors?.size_acres?.[0]}
      >
        <Input
          id="size_acres"
          name="size_acres"
          type="number"
          step="0.001"
          min="0"
          required
          defaultValue={initial?.size_acres}
          placeholder="e.g. 2.5"
        />
      </Field>

      <Field
        label="Ownership"
        htmlFor="ownership_type"
        error={state.fieldErrors?.ownership_type?.[0]}
      >
        <select
          id="ownership_type"
          name="ownership_type"
          required
          defaultValue={initial?.ownership_type ?? "owned"}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {OWNERSHIP_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === "owned" ? "Owned" : "Rented"}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="space-y-3 rounded-md border border-dashed p-4">
        <legend className="px-1 text-sm font-medium text-neutral-700">
          Geolocation <span className="text-neutral-400">(optional)</span>
        </legend>
        <p className="text-xs text-neutral-500">
          Coordinates let us plot the farm on a map later. Leave blank if
          you&apos;re not sure — you can always add them on edit.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Latitude"
            htmlFor="latitude"
            error={state.fieldErrors?.latitude?.[0]}
          >
            <Input
              id="latitude"
              name="latitude"
              type="number"
              step="0.000001"
              min={-90}
              max={90}
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="-1.286389"
              inputMode="decimal"
            />
          </Field>
          <Field
            label="Longitude"
            htmlFor="longitude"
            error={state.fieldErrors?.longitude?.[0]}
          >
            <Input
              id="longitude"
              name="longitude"
              type="number"
              step="0.000001"
              min={-180}
              max={180}
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="36.817223"
              inputMode="decimal"
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={useMyLocation}
            disabled={geoState === "loading"}
          >
            {geoState === "loading" ? "Locating…" : "Use my location"}
          </Button>
          {lat && lng ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setLat("");
                setLng("");
                setGeoState("idle");
              }}
            >
              Clear
            </Button>
          ) : null}
          <GeoStatus state={geoState} />
        </div>
      </fieldset>

      {state.message ? (
        <p className="text-destructive text-sm">{state.message}</p>
      ) : null}

      <SubmitButton label={initial ? "Save changes" : "Create farm"} />
    </form>
  );
}

function GeoStatus({
  state,
}: {
  state: "idle" | "loading" | "ok" | "denied" | "error";
}) {
  if (state === "ok")
    return <span className="text-xs text-emerald-700">Location captured.</span>;
  if (state === "denied")
    return (
      <span className="text-xs text-amber-700">
        Browser blocked location access — enter coordinates manually.
      </span>
    );
  if (state === "error")
    return (
      <span className="text-xs text-amber-700">
        Couldn&apos;t get a location fix — enter manually.
      </span>
    );
  return null;
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

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}
