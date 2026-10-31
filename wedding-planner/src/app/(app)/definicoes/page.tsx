"use client";

import { PageHeader } from "@/components/page";
import { AccountCard, PreferencesForm, UsersCard, WeddingForm } from "@/components/settings/settings-forms";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Definições" description="Dados do casamento, preferências, utilizadores autorizados e a sua conta." />
      <div className="grid max-w-3xl gap-4">
        <WeddingForm />
        <PreferencesForm />
        <UsersCard />
        <AccountCard />
      </div>
    </>
  );
}
