import { listPockets } from "@/app/actions/finance";
import { ImportTransactionsPage } from "@/components/transactions/import-transactions-page";
import { getActiveProfile, listProfiles } from "@/app/actions/profile";

export default async function TransactionsImportPage() {
  const [pocketsResult, activeProfileResult, profilesResult] = await Promise.all([
    listPockets(),
    getActiveProfile(),
    listProfiles(),
  ]);
  if (!pocketsResult.success) {
    throw new Error(pocketsResult.error);
  }

  if (!activeProfileResult.success) {
    throw new Error(activeProfileResult.error);
  }

  if (!profilesResult.success) {
    throw new Error(profilesResult.error);
  }

  const activeProfile = {
    id: activeProfileResult.data.id,
    name: activeProfileResult.data.name,
    desc: activeProfileResult.data.desc ?? null,
  };

  const profiles = profilesResult.data.map((profile) => ({
    id: profile.id,
    name: profile.name,
    desc: profile.desc ?? null,
  }));

  return (
    <ImportTransactionsPage
      pockets={pocketsResult.data}
      activeProfile={activeProfile}
      profiles={profiles}
    />
  );
}
