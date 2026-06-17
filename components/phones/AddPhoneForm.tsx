"use client";

import { useActionState, useMemo, useState } from "react";

import { PageHeader } from "@/components/ui/PageHeader";
import { addPhone } from "@/lib/phones/addPhoneAction";

type AddPhoneFormState = { ok: true } | { ok: false; error: string };

const initialState: AddPhoneFormState = { ok: true };

const BRANDS = ["Apple", "Samsung", "Tecno", "Infinix", "Itel", "Xiaomi", "Oppo", "Vivo", "Huawei", "Nokia"];
const STORAGE_OPTIONS = ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"];
const IPHONE_MODELS = [
  "iPhone 7",
  "iPhone 7 Plus",
  "iPhone 8",
  "iPhone 8 Plus",
  "iPhone X",
  "iPhone XR",
  "iPhone XS",
  "iPhone XS Max",
  "iPhone 11",
  "iPhone 11 Pro",
  "iPhone 11 Pro Max",
  "iPhone SE 2nd Gen",
  "iPhone 12 Mini",
  "iPhone 12",
  "iPhone 12 Pro",
  "iPhone 12 Pro Max",
  "iPhone 13 Mini",
  "iPhone 13",
  "iPhone 13 Pro",
  "iPhone 13 Pro Max",
  "iPhone SE 3rd Gen",
  "iPhone 14",
  "iPhone 14 Plus",
  "iPhone 14 Pro",
  "iPhone 14 Pro Max",
  "iPhone 15",
  "iPhone 15 Plus",
  "iPhone 15 Pro",
  "iPhone 15 Pro Max",
  "iPhone 16",
  "iPhone 16 Plus",
  "iPhone 16 Pro",
  "iPhone 16 Pro Max",
  "iPhone 16e",
  "iPhone 17",
  "iPhone 17 Air",
  "iPhone 17 Pro",
  "iPhone 17 Pro Max",
];

export default function AddPhoneForm() {
  const [state, formAction, pending] = useActionState(addPhone, initialState);
  const [brandChoice, setBrandChoice] = useState("Apple");
  const [customBrand, setCustomBrand] = useState("");
  const [modelChoice, setModelChoice] = useState("iPhone 13");
  const [customModel, setCustomModel] = useState("");
  const [storageChoice, setStorageChoice] = useState("128GB");
  const [customStorage, setCustomStorage] = useState("");

  const brand = brandChoice === "Other" ? customBrand : brandChoice;
  const model = useMemo(() => {
    if (brandChoice === "Apple" && modelChoice !== "Custom") return modelChoice;
    return customModel;
  }, [brandChoice, customModel, modelChoice]);
  const storage = storageChoice === "Custom" ? customStorage : storageChoice;
  const isApple = brandChoice === "Apple";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Add Phone" subtitle="Record a new handset quickly with IMEI, model, and GHS pricing." />

      <form className="rounded-lg border bg-card p-4 shadow-sm sm:p-5" action={formAction}>
        <input type="hidden" name="brand" value={brand} />
        <input type="hidden" name="model" value={model} />
        <input type="hidden" name="storage" value={storage} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">IMEI</span>
            <input name="imei" required className="h-11 rounded-lg border bg-background px-3" placeholder="e.g. 3567..." />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Brand</span>
            <select value={brandChoice} onChange={(event) => setBrandChoice(event.target.value)} className="h-11 rounded-lg border bg-background px-3">
              {BRANDS.map((brandName) => (
                <option key={brandName} value={brandName}>{brandName}</option>
              ))}
              <option value="Other">Other / Type manually</option>
            </select>
          </label>

          {brandChoice === "Other" ? (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Custom brand</span>
              <input value={customBrand} onChange={(event) => setCustomBrand(event.target.value)} required className="h-11 rounded-lg border bg-background px-3" placeholder="Brand name" />
            </label>
          ) : null}

          {isApple ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">iPhone model</span>
              <select value={modelChoice} onChange={(event) => setModelChoice(event.target.value)} className="h-11 rounded-lg border bg-background px-3">
                {IPHONE_MODELS.map((modelName) => (
                  <option key={modelName} value={modelName}>{modelName}</option>
                ))}
                <option value="Custom">Type custom model</option>
              </select>
            </label>
          ) : null}

          {!isApple || modelChoice === "Custom" ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Model</span>
              <input value={customModel} onChange={(event) => setCustomModel(event.target.value)} required className="h-11 rounded-lg border bg-background px-3" placeholder={isApple ? "iPhone model" : "Model name"} />
            </label>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Storage</span>
            <select value={storageChoice} onChange={(event) => setStorageChoice(event.target.value)} className="h-11 rounded-lg border bg-background px-3">
              {STORAGE_OPTIONS.map((storageValue) => (
                <option key={storageValue} value={storageValue}>{storageValue}</option>
              ))}
              <option value="Custom">Custom</option>
            </select>
          </label>

          {storageChoice === "Custom" ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Custom storage</span>
              <input value={customStorage} onChange={(event) => setCustomStorage(event.target.value)} className="h-11 rounded-lg border bg-background px-3" placeholder="e.g. 2TB" />
            </label>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Color</span>
            <input name="color" className="h-11 rounded-lg border bg-background px-3" placeholder="Black (optional)" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Condition</span>
            <select name="condition" defaultValue="New" className="h-11 rounded-lg border bg-background px-3">
              <option value="New">Brand New</option>
              <option value="UK Used">UK Used</option>
            </select>
          </label>

          {isApple ? (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Battery health</span>
              <input name="battery_health" className="h-11 rounded-lg border bg-background px-3" placeholder="e.g. 90%" />
            </label>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Cost Price (GHS)</span>
            <input name="cost_price" required type="number" step="0.01" min="0" className="h-11 rounded-lg border bg-background px-3" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Selling Price (GHS)</span>
            <input name="selling_price" required type="number" step="0.01" min="0" className="h-11 rounded-lg border bg-background px-3" />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <select name="status" defaultValue="Available" className="h-11 rounded-lg border bg-background px-3">
              <option value="Available">Available</option>
              <option value="Damaged">Damaged</option>
              <option value="Returned">Returned by Dealer</option>
              <option value="With Dealer">With Dealer</option>
              <option value="Sold">Sold</option>
            </select>
          </label>
        </div>

        {state.ok === false ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}

        <button disabled={pending} type="submit" className="mt-4 h-11 w-full rounded-lg bg-primary px-4 font-semibold text-primary-foreground active:opacity-90 disabled:opacity-60 sm:w-auto">
          {pending ? "Saving..." : "Save phone"}
        </button>

        <div className="mt-2 text-xs text-muted-foreground">Tip: Apple models and storage are prefilled for faster stock entry.</div>
      </form>
    </div>
  );
}
