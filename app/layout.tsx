import type { Metadata } from "next";

// Slice 1 (scaffold): no fonts, no stylesheet. The look of the product is
// MyNMCLicensure's own and comes from legacy/mynmclicensure/css/style.css
// when the first real surface is built (rebuild.md §3.2) — not from
// MyNclex. This file grows then.
//
// "Quademia", never "QAcademy", in anything a reader sees (AGENTS.md UI
// convention #5).
export const metadata: Metadata = {
  title: "MyNMCLicensure | Quademia",
  description:
    "MyNMCLicensure — NMC Ghana licensure exam prep for nursing students. A Quademia product.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
