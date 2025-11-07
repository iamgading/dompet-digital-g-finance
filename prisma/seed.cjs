// prisma/seed.cjs

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Profil default
const DEFAULT_PROFILE_NAME = "Pribadi";

// Pocket default
const DEFAULT_POCKETS = [
  {
    name: "Tabungan",
    color: "#0ea5e9",
    icon: "piggy-bank",
    order: 1,
  },
  {
    name: "Kebutuhan Pokok",
    color: "#22c55e",
    icon: "shopping-basket",
    order: 2,
  },
  {
    name: "Invest",
    color: "#06b6d4",
    icon: "trending-up",
    order: 3,
  },
  {
    name: "E-Money",
    color: "#a855f7",
    icon: "smartphone",
    order: 4,
  },
];

async function main() {
  // 1. Cari profile default, kalau belum ada → buat
  let defaultProfile = await prisma.profile.findFirst({
    where: { name: DEFAULT_PROFILE_NAME },
  });

  if (!defaultProfile) {
    defaultProfile = await prisma.profile.create({
      data: {
        name: DEFAULT_PROFILE_NAME,
        desc: "Profil default",
      },
    });
  }

  // 2. Pastikan userPref ada dan menunjuk ke profile aktif
  let userPref = await prisma.userPref.findFirst();

  if (!userPref) {
    userPref = await prisma.userPref.create({
      data: {
        activeProfileId: defaultProfile.id,
      },
    });
  } else if (!userPref.activeProfileId) {
    userPref = await prisma.userPref.update({
      where: { id: userPref.id },
      data: { activeProfileId: defaultProfile.id },
    });
  }

  const activeProfileId = userPref.activeProfileId || defaultProfile.id;

  // 3. Cari pocket yang sudah ada untuk profile ini
  const existingPockets = await prisma.pocket.findMany({
    where: {
      profileId: activeProfileId,
      name: { in: DEFAULT_POCKETS.map((p) => p.name) },
    },
    select: { name: true },
  });

  const existingNames = new Set(existingPockets.map((p) => p.name));

  // 4. Siapkan pocket yang belum ada
  const pocketsToCreate = DEFAULT_POCKETS
    .filter((p) => !existingNames.has(p.name))
    .map((p) => ({
      ...p,
      monthlyBudget: 0,
      goalAmount: 0,
      balance: 0,
      isActive: true,
      profileId: activeProfileId,
    }));

  if (pocketsToCreate.length > 0) {
    await prisma.pocket.createMany({
      data: pocketsToCreate,
    });
  }

  console.log("✅ Seed selesai!");
  console.log("   Profile aktif:", defaultProfile.name, defaultProfile.id);
  console.log(
    "   Pocket dibuat:",
    pocketsToCreate.length > 0
      ? pocketsToCreate.map((p) => p.name).join(", ")
      : "(tidak ada pocket baru, semua sudah ada)"
  );
}

// eksekusi
main()
  .catch((err) => {
    console.error("❌ Seed gagal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
