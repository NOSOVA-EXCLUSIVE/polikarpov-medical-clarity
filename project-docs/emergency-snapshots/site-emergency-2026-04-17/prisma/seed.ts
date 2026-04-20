import { ChargeModel, MessageMode, PrismaClient, ProductCode } from "@prisma/client";
import { env } from "@/lib/env/server";
import { hashStaffPassword } from "@/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
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

  if (env.ADMIN_SEED_EMAIL && env.ADMIN_SEED_PASSWORD) {
    await prisma.user.upsert({
      where: { email: env.ADMIN_SEED_EMAIL },
      update: {
        name: env.ADMIN_SEED_NAME,
        role: "ADMIN",
        passwordHash: hashStaffPassword(env.ADMIN_SEED_PASSWORD),
        isActive: true
      },
      create: {
        email: env.ADMIN_SEED_EMAIL,
        name: env.ADMIN_SEED_NAME,
        role: "ADMIN",
        passwordHash: hashStaffPassword(env.ADMIN_SEED_PASSWORD),
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
