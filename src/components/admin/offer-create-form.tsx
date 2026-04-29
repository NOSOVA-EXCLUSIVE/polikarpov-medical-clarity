"use client";

import { useMemo, useState } from "react";
import type { ProductCode } from "@prisma/client";

import type { ProductDefaultOffer } from "@/features/products/catalog";

type OfferCreateFormProps = {
  action: string;
  defaultProductCode: ProductCode;
  defaultDurationMinutes?: number;
  defaultOfferByProductCode: Record<ProductCode, ProductDefaultOffer>;
};

export function OfferCreateForm({
  action,
  defaultProductCode,
  defaultDurationMinutes = 45,
  defaultOfferByProductCode
}: OfferCreateFormProps) {
  const initialOffer = useMemo(
    () => defaultOfferByProductCode[defaultProductCode] ?? defaultOfferByProductCode.SECOND_OPINION,
    [defaultOfferByProductCode, defaultProductCode]
  );
  const [productCode, setProductCode] = useState<ProductCode>(defaultProductCode);
  const [amountMajor, setAmountMajor] = useState<string>(String(initialOffer.amountMajor));
  const [currency, setCurrency] = useState<"RUB" | "EUR">(initialOffer.currency);

  return (
    <form action={action} className="form-grid" method="post">
      <label className="field">
        <span>РџСЂРѕРґСѓРєС‚</span>
        <select
          value={productCode}
          name="productCode"
          onChange={(event) => {
            const nextProductCode = event.target.value as ProductCode;
            const nextOffer =
              defaultOfferByProductCode[nextProductCode] ?? defaultOfferByProductCode.SECOND_OPINION;
            setProductCode(nextProductCode);
            setAmountMajor(String(nextOffer.amountMajor));
            setCurrency(nextOffer.currency);
          }}
        >
          <option value="SECOND_OPINION">РџСЂРѕРґСѓРєС‚ 1</option>
          <option value="MEDICAL_ROUTE">РџСЂРѕРґСѓРєС‚ 2</option>
          <option value="RECOVERY_4_WEEKS">РџСЂРѕРґСѓРєС‚ 3</option>
          <option value="PERSONAL_SUPPORT">РџСЂРѕРґСѓРєС‚ 4</option>
        </select>
      </label>
      <label className="field">
        <span>РњРѕРґРµР»СЊ РѕРїР»Р°С‚С‹</span>
        <select defaultValue="ONE_TIME" name="chargeModel">
          <option value="ONE_TIME">Р Р°Р·РѕРІР°СЏ</option>
          <option value="PACKAGE">РџР°РєРµС‚</option>
          <option value="RECURRING_READY">Р“РѕС‚РѕРІРѕ Рє РїСЂРѕРґР»РµРЅРёСЋ</option>
        </select>
      </label>
      <label className="field">
        <span>РЎСѓРјРјР°</span>
        <input
          min="1"
          name="amountMajor"
          step="0.01"
          type="number"
          value={amountMajor}
          onChange={(event) => setAmountMajor(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Р’Р°Р»СЋС‚Р°</span>
        <select name="currency" value={currency} onChange={(event) => setCurrency(event.target.value as "RUB" | "EUR")}>
          <option value="RUB">RUB</option>
          <option value="EUR">EUR</option>
        </select>
      </label>
      <label className="field field--full">
        <span>Р”Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ / РѕР±СЉС‘Рј РІ РјРёРЅСѓС‚Р°С…</span>
        <input defaultValue={defaultDurationMinutes} min="1" name="durationMinutes" type="number" />
      </label>
      <div className="field--full">
        <button className="button" type="submit">
          РЎРѕР·РґР°С‚СЊ РїРµСЂСЃРѕРЅР°Р»СЊРЅСѓСЋ СЃСЃС‹Р»РєСѓ
        </button>
      </div>
    </form>
  );
}
