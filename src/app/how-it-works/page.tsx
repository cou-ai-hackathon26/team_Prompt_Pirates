import { Walkthrough } from "./walkthrough";

export default function HowItWorksPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-3xl font-bold">কিভাবে কাজ করে</h1>
        <p className="text-slate-600">একটি পরিবার কীভাবে ডেঙ্গুসাথী ব্যবহার করে, ধাপে ধাপে দেখুন (প্রায় ৪৫ সেকেন্ড)</p>
      </header>
      <Walkthrough />
    </main>
  );
}
