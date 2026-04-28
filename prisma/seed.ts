import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ChargeModel, MessageMode, PrismaClient, ProductCode } from "@prisma/client";
import { hashStaffPassword } from "@/lib/auth/password";

const prisma = new PrismaClient();

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  const source = readFileSync(envPath, "utf8");

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (!name || process.env[name]) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[name] = value;
  }
}

function getSeedEnv() {
  loadEnvLocal();

  return {
    adminSeedEmail: process.env.ADMIN_SEED_EMAIL?.trim(),
    adminSeedPassword: process.env.ADMIN_SEED_PASSWORD?.trim(),
    adminSeedName: process.env.ADMIN_SEED_NAME?.trim() || "Practice Admin"
  };
}

async function main() {
  const seedEnv = getSeedEnv();

  await prisma.productConfig.upsert({
    where: { productCode: ProductCode.SECOND_OPINION },
    update: {},
    create: {
      productCode: ProductCode.SECOND_OPINION,
      slug: "second-opinion",
      displayName: "Expert Second Opinion",
      isPublic: true,
      isActivelySold: true,
      chargeModelDefault: ChargeModel.ONE_TIME,
      messageMode: MessageMode.CLARIFICATION_WINDOW,
      clarificationWindowHours: 72,
      patientMessageLimit: 3,
      sortOrder: 10
    }
  });

  await prisma.productConfig.upsert({
    where: { productCode: ProductCode.MEDICAL_ROUTE },
    update: {},
    create: {
      productCode: ProductCode.MEDICAL_ROUTE,
      slug: "medical-route",
      displayName: "Medical Route and Treatment Plan",
      isPublic: true,
      isActivelySold: false,
      chargeModelDefault: ChargeModel.ONE_TIME,
      messageMode: MessageMode.CLARIFICATION_WINDOW,
      clarificationWindowHours: 168,
      patientMessageLimit: 5,
      sortOrder: 20
    }
  });

  await prisma.productConfig.upsert({
    where: { productCode: ProductCode.RECOVERY_4_WEEKS },
    update: {},
    create: {
      productCode: ProductCode.RECOVERY_4_WEEKS,
      slug: "recovery-4-weeks",
      displayName: "Recovery Support for 4 Weeks",
      isPublic: true,
      isActivelySold: true,
      chargeModelDefault: ChargeModel.PACKAGE,
      messageMode: MessageMode.SUPPORT_PACKAGE,
      sortOrder: 30
    }
  });

  await prisma.productConfig.upsert({
    where: { productCode: ProductCode.PERSONAL_SUPPORT },
    update: {},
    create: {
      productCode: ProductCode.PERSONAL_SUPPORT,
      slug: "personal-support",
      displayName: "Personal Support for Complex Cases",
      isPublic: true,
      isActivelySold: false,
      chargeModelDefault: ChargeModel.RECURRING_READY,
      messageMode: MessageMode.SUPPORT_PACKAGE,
      sortOrder: 40
    }
  });

  await prisma.appSetting.upsert({
    where: { key: "system.defaults" },
    update: {},
    create: {
      key: "system.defaults",
      valueJson: {
        heldSlotTtlMinutes: 20,
        offerTtlHours: 72,
        portalAccessTtlHours: 24,
        materialsTtlHours: 168,
        defaultCurrency: "EUR"
      }
    }
  });

  if (seedEnv.adminSeedEmail && seedEnv.adminSeedPassword) {
    await prisma.user.upsert({
      where: { email: seedEnv.adminSeedEmail },
      update: {
        name: seedEnv.adminSeedName,
        role: "ADMIN",
        passwordHash: hashStaffPassword(seedEnv.adminSeedPassword),
        isActive: true
      },
      create: {
        email: seedEnv.adminSeedEmail,
        name: seedEnv.adminSeedName,
        role: "ADMIN",
        passwordHash: hashStaffPassword(seedEnv.adminSeedPassword),
        isActive: true
      }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
