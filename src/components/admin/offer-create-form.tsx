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
        <span>Продукт</span>
        <select
          name="productCode"
          value={productCode}
          onChange={(event) => {
            const nextProductCode = event.target.value as ProductCode;
            const nextOffer =
              defaultOfferByProductCode[nextProductCode] ?? defaultOfferByProductCode.SECOND_OPINION;
            setProductCode(nextProductCode);
            setAmountMajor(String(nextOffer.amountMajor));
            setCurrency(nextOffer.currency);
          }}
        >
          <option value="SECOND_OPINION">Продукт 1</option>
          <option value="MEDICAL_ROUTE">Продукт 2</option>
          <option value="RECOVERY_4_WEEKS">Продукт 3</option>
          <option value="PERSONAL_SUPPORT">Продукт 4</option>
        </select>
      </label>
      <label className="field">
        <span>Модель оплаты</span>
        <select defaultValue="ONE_TIME" name="chargeModel">
          <option value="ONE_TIME">Разовая</option>
          <option value="PACKAGE">Пакет</option>
          <option value="RECURRING_READY">Готово к продлению</option>
        </select>
      </label>
      <label className="field">
        <span>Сумма</span>
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
        <span>Валюта</span>
        <select
          name="currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value as "RUB" | "EUR")}
        >
          <option value="RUB">RUB</option>
          <option value="EUR">EUR</option>
        </select>
      </label>
      <label className="field field--full">
        <span>Длительность / объём в минутах</span>
        <input defaultValue={defaultDurationMinutes} min="1" name="durationMinutes" type="number" />
      </label>
      <div className="field--full">
        <button className="button" type="submit">
          Создать персональную ссылку
        </button>
      </div>
    </form>
  );
}
