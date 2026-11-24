import { NewPatientForm } from "~/app/_components/new-patient-form";

export default function NewPatientPage() {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-5 px-4 py-6">
      <header>
        <h1 className="text-3xl font-bold">নতুন রোগী</h1>
        <p className="text-slate-600">১ মিনিটে শুরু করুন। কোনো লগইন লাগবে না।</p>
      </header>
      <NewPatientForm />
    </main>
  );
}
