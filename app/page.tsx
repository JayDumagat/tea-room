"use client";

import dynamic from "next/dynamic";

const VirtualOffice = dynamic(() => import("@/components/virtual-office"), {
  ssr: false,
  loading: () => <main>Loading virtual office...</main>,
});

export default function Home() {
  return <VirtualOffice />;
}
